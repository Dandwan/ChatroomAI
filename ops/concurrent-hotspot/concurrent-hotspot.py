#!/usr/bin/env python3

import argparse
import configparser
import json
import os
import re
import signal
import subprocess
import sys
import time
from pathlib import Path


SERVICE_NAME = "concurrent-hotspot.service"
CONNECTION_ID = "并发热点"
LEGACY_CONNECTION_IDS = ("Concurrent Hotspot",)
AP_IFACE = "ap0"
RUNTIME_DIR = Path("/run/concurrent-hotspot")
HOSTAPD_CONF = RUNTIME_DIR / "hostapd.conf"
HOSTAPD_PID = RUNTIME_DIR / "hostapd.pid"
DNSMASQ_CONF = RUNTIME_DIR / "dnsmasq.conf"
DNSMASQ_PID = RUNTIME_DIR / "dnsmasq.pid"
STATE_FILE = RUNTIME_DIR / "state.json"
REGULATORY_DB = Path("/usr/lib/firmware/regulatory.db")
FALLBACK_COUNTRY_CODE = "CN"
AP_ADDR = "10.42.0.1/24"
AP_GATEWAY = "10.42.0.1"
AP_SUBNET = "10.42.0.0/24"
DHCP_START = "10.42.0.10"
DHCP_END = "10.42.0.200"


class HotspotError(RuntimeError):
    pass


def run(cmd, check=True, capture_output=True):
    return subprocess.run(
        cmd,
        check=check,
        capture_output=capture_output,
        text=True,
    )


def run_checked(cmd):
    try:
        return run(cmd, check=True)
    except subprocess.CalledProcessError as exc:
        stderr = (exc.stderr or "").strip()
        stdout = (exc.stdout or "").strip()
        detail = stderr or stdout or f"command failed: {' '.join(cmd)}"
        raise HotspotError(detail) from exc


def log_info(message):
    print(message, flush=True)


def read_text_if_exists(path):
    try:
        return Path(path).read_text(encoding="utf-8").strip()
    except FileNotFoundError:
        return None


def file_contains(path, needle):
    text = read_text_if_exists(path)
    return bool(text and needle in text)


def parse_iw_dev():
    output = run_checked(["iw", "dev"]).stdout
    interfaces = []
    current = None

    for raw_line in output.splitlines():
        line = raw_line.rstrip()
        stripped = line.strip()
        if stripped.startswith("Interface "):
            if current:
                interfaces.append(current)
            current = {"name": stripped.split()[1]}
            continue
        if current is None:
            continue
        if stripped.startswith("type "):
            current["type"] = stripped.split()[1]
        elif stripped.startswith("ssid "):
            current["ssid"] = stripped[5:]
        elif stripped.startswith("channel "):
            match = re.search(r"channel (\d+) \((\d+) MHz\)", stripped)
            if match:
                current["channel"] = int(match.group(1))
                current["frequency"] = int(match.group(2))
    if current:
        interfaces.append(current)
    return interfaces


def parse_iw_link(iface):
    result = run(["iw", "dev", iface, "link"], check=False)
    if result.returncode != 0:
        return {}

    info = {}
    for raw_line in result.stdout.splitlines():
        line = raw_line.strip()
        if line.startswith("Connected to "):
            info["bssid"] = line.split()[2].lower()
        elif line.startswith("SSID: "):
            info["ssid"] = line[6:]
        elif line.startswith("freq: "):
            try:
                info["frequency"] = int(float(line[6:]))
            except ValueError:
                pass
    return info


def known_connection_ids():
    return (CONNECTION_ID, *LEGACY_CONNECTION_IDS)


def iw_frequency_line(frequency):
    output = run_checked(["iw", "list"]).stdout
    target = f"* {frequency}.0 MHz"
    for raw_line in output.splitlines():
        line = raw_line.strip()
        if line.startswith(target):
            return line
    return None


def frequency_allows_ap(uplink):
    line = iw_frequency_line(uplink["frequency"])
    if not line:
        return {"line": None, "no_ir": False, "radar_detection": False}
    lowered = line.lower()
    return {
        "line": line,
        "no_ir": "no ir" in lowered,
        "radar_detection": "radar detection" in lowered,
    }


def uplink_supports_ap(uplink):
    return not frequency_allows_ap(uplink)["no_ir"]


def iface_exists(name):
    return any(item.get("name") == name for item in parse_iw_dev())


def get_uplink_iface():
    for iface in parse_iw_dev():
        if iface.get("type") == "managed" and iface.get("ssid"):
            iface.update(parse_iw_link(iface["name"]))
            return iface
    raise HotspotError("没有找到已连接的 Wi-Fi 上游接口")


def get_wifi_band(frequency):
    if frequency < 5000:
        return "bg"
    return "a"


def wait_for_nm_device(iface, timeout=5.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        devices = run_checked(["nmcli", "-t", "-f", "DEVICE", "device", "status"]).stdout.splitlines()
        if iface in devices:
            return
        time.sleep(0.2)
    raise HotspotError(f"NetworkManager 没有及时识别到接口 {iface}")


def nm_device_state(iface):
    result = run(["nmcli", "-g", "GENERAL.STATE", "device", "show", iface], check=False)
    if result.returncode != 0:
        return None
    value = (result.stdout or "").strip()
    match = re.search(r"\(([^)]+)\)", value)
    if match:
        return match.group(1)
    return value or None


def wait_for_nm_device_state(iface, states, timeout=10.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        state = nm_device_state(iface)
        if state in states:
            return state
        time.sleep(0.2)
    final_state = nm_device_state(iface) or "missing"
    raise HotspotError(f"NetworkManager 没有及时把 {iface} 准备好（当前状态：{final_state}）")


def connection_exists():
    output = run_checked(["nmcli", "-t", "-f", "NAME", "connection", "show"]).stdout.splitlines()
    return any(item in output for item in known_connection_ids())


def resolve_connection_id():
    output = run_checked(["nmcli", "-t", "-f", "NAME", "connection", "show"]).stdout.splitlines()
    for item in known_connection_ids():
        if item in output:
            return item
    return CONNECTION_ID


def active_connection_names():
    output = run_checked(["nmcli", "-t", "-f", "NAME", "connection", "show", "--active"]).stdout
    return [line for line in output.splitlines() if line]


def active_connection_for_device(iface):
    result = run(["nmcli", "-g", "GENERAL.CONNECTION", "device", "show", iface], check=False)
    if result.returncode != 0:
        return None
    value = (result.stdout or "").strip()
    if not value or value == "--":
        return None
    return value


def split_nmcli_terse(line):
    fields = []
    current = []
    escaped = False
    for char in line:
        if escaped:
            current.append(char)
            escaped = False
        elif char == "\\":
            escaped = True
        elif char == ":":
            fields.append("".join(current))
            current = []
        else:
            current.append(char)
    fields.append("".join(current))
    return fields


def parse_frequency(value):
    match = re.search(r"(\d+)", value or "")
    return int(match.group(1)) if match else None


def parse_int(value):
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def scan_wifi_networks(iface, rescan=True):
    output = run_checked(
        [
            "nmcli",
            "-t",
            "-e",
            "yes",
            "-f",
            "BSSID,SSID,FREQ,CHAN,SIGNAL,SECURITY",
            "device",
            "wifi",
            "list",
            "ifname",
            iface,
            "--rescan",
            "yes" if rescan else "no",
        ]
    ).stdout

    networks = []
    for raw_line in output.splitlines():
        if not raw_line.strip():
            continue
        parts = split_nmcli_terse(raw_line)
        if len(parts) != 6:
            continue
        bssid, ssid, freq, channel, signal, security = parts
        networks.append(
            {
                "bssid": bssid.lower(),
                "ssid": ssid,
                "frequency": parse_frequency(freq),
                "channel": parse_int(channel),
                "signal": parse_int(signal),
                "security": security,
            }
        )
    return networks


def find_network_by_bssid(networks, bssid):
    if not bssid:
        return None
    target = bssid.lower()
    for network in networks:
        if network["bssid"].lower() == target:
            return network
    return None


def find_same_ssid_24g_candidates(uplink, rescan=True):
    networks = scan_wifi_networks(uplink["name"], rescan=rescan)
    current_network = find_network_by_bssid(networks, uplink.get("bssid"))
    current_security = current_network.get("security") if current_network else None

    candidates = []
    for network in networks:
        if network.get("ssid") != uplink.get("ssid"):
            continue
        if not network.get("frequency") or network["frequency"] >= 5000:
            continue
        if uplink.get("bssid") and network["bssid"].lower() == uplink["bssid"].lower():
            continue
        if current_security is not None and network.get("security") != current_security:
            continue
        candidates.append(network)

    candidates.sort(
        key=lambda item: (
            -(item.get("signal") or -1),
            item.get("channel") or 999,
            item.get("bssid") or "",
        )
    )
    return {
        "current_network": current_network,
        "current_security": current_security,
        "candidates": candidates,
    }


def wait_for_uplink_reconnect(iface, expected_ssid, max_frequency=4999, timeout=15.0):
    deadline = time.time() + timeout
    last_seen = None
    while time.time() < deadline:
        try:
            uplink = get_uplink_iface()
        except HotspotError:
            time.sleep(0.5)
            continue
        if uplink.get("name") != iface:
            time.sleep(0.5)
            continue
        last_seen = uplink
        if uplink.get("ssid") == expected_ssid and uplink.get("frequency") and uplink["frequency"] <= max_frequency:
            return uplink
        time.sleep(0.5)

    if last_seen:
        raise HotspotError(
            f"已尝试切换到 2.4GHz，但接口 {iface} 当前仍连接在 {last_seen.get('frequency', '未知')} MHz / "
            f"信道 {last_seen.get('channel', '未知')}"
        )
    raise HotspotError(f"已尝试切换到 2.4GHz，但接口 {iface} 没有在超时内重新连上")


def maybe_move_uplink_to_24g(uplink):
    if not uplink.get("ssid") or not uplink.get("frequency") or uplink["frequency"] < 5000:
        return uplink, None

    scan = find_same_ssid_24g_candidates(uplink, rescan=True)
    candidates = scan["candidates"]
    if not candidates:
        return uplink, "已扫描当前 SSID，但没有发现可复用当前连接配置的 2.4GHz BSSID。"

    connection_name = active_connection_for_device(uplink["name"])
    if not connection_name:
        return uplink, "找不到当前上游接口对应的 NetworkManager 连接配置，无法自动切到 2.4GHz。"

    target = candidates[0]
    try:
        log_info(
            f"检测到同 SSID 的 2.4GHz 候选，准备把 {uplink['name']} 从 "
            f"{uplink['frequency']} MHz / 信道 {uplink['channel']} 切到 "
            f"{target['frequency']} MHz / 信道 {target['channel']}（{target['bssid']}）"
        )
        run_checked(
            [
                "nmcli",
                "--wait",
                "12",
                "connection",
                "up",
                connection_name,
                "ifname",
                uplink["name"],
                "ap",
                target["bssid"],
            ]
        )
        switched = wait_for_uplink_reconnect(uplink["name"], uplink["ssid"])
        log_info(
            f"已切换到 2.4GHz 上游：{switched.get('ssid')} "
            f"{switched.get('frequency')} MHz / 信道 {switched.get('channel')}"
        )
        return (
            switched,
            f"已自动切换到同 SSID 的 2.4GHz BSSID {target['bssid']}（{target['frequency']} MHz / 信道 {target['channel']}）。",
        )
    except HotspotError as exc:
        return (
            uplink,
            f"已发现同 SSID 的 2.4GHz BSSID {target['bssid']}（{target['frequency']} MHz / 信道 {target['channel']}），但自动切换失败：{exc}",
        )


def service_is_active():
    result = run(["systemctl", "is-active", "--quiet", SERVICE_NAME], check=False, capture_output=False)
    return result.returncode == 0


def hotspot_is_active():
    return pid_is_alive(read_pid(HOSTAPD_PID))


def ensure_runtime_dir():
    RUNTIME_DIR.mkdir(mode=0o755, parents=True, exist_ok=True)


def write_runtime_file(path, content, mode=0o600):
    ensure_runtime_dir()
    path.write_text(content, encoding="utf-8")
    os.chmod(path, mode)


def read_pid(path):
    try:
        return int(path.read_text(encoding="utf-8").strip())
    except (FileNotFoundError, ValueError):
        return None


def pid_is_alive(pid):
    if not pid:
        return False
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def stop_pidfile(path, timeout=5.0):
    pid = read_pid(path)
    if not pid:
        path.unlink(missing_ok=True)
        return
    try:
        os.kill(pid, signal.SIGTERM)
    except ProcessLookupError:
        path.unlink(missing_ok=True)
        return
    deadline = time.time() + timeout
    while time.time() < deadline:
        if not pid_is_alive(pid):
            path.unlink(missing_ok=True)
            return
        time.sleep(0.2)
    try:
        os.kill(pid, signal.SIGKILL)
    except ProcessLookupError:
        pass
    path.unlink(missing_ok=True)


def read_state():
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except FileNotFoundError:
        return {}
    except json.JSONDecodeError:
        return {}


def write_state(data):
    write_runtime_file(STATE_FILE, json.dumps(data), mode=0o644)


def read_sysctl(name):
    return run_checked(["sysctl", "-n", name]).stdout.strip()


def set_sysctl(name, value):
    run_checked(["sysctl", "-q", "-w", f"{name}={value}"])


def find_connection_file():
    base = Path("/etc/NetworkManager/system-connections")
    for path in base.glob("*.nmconnection"):
        parser = configparser.ConfigParser(interpolation=None)
        parser.read(path, encoding="utf-8")
        if parser.get("connection", "id", fallback="") in known_connection_ids():
            return path
    raise HotspotError(f"找不到热点配置“{CONNECTION_ID}”对应的 NetworkManager 配置文件")


def parse_regdoms():
    result = run(["iw", "reg", "get"], check=False)
    if result.returncode != 0:
        return []

    regdoms = []
    current = None
    for raw_line in result.stdout.splitlines():
        line = raw_line.strip()
        if line == "global":
            current = {"scope": "global", "self_managed": False}
            regdoms.append(current)
            continue
        if line.startswith("phy#"):
            current = {
                "scope": line.split()[0],
                "self_managed": "(self-managed)" in line,
            }
            regdoms.append(current)
            continue
        if current and line.startswith("country "):
            match = re.match(r"country\s+([A-Z0-9]{2}):\s*(.*)", line)
            if match:
                current["country"] = match.group(1)
                current["dfs_region"] = match.group(2)
    return regdoms


def find_regdom(scope_prefix):
    for item in parse_regdoms():
        if item["scope"].startswith(scope_prefix):
            return item
    return None


def hotspot_country_code():
    global_regdom = find_regdom("global") or {}
    country = global_regdom.get("country")
    if country and country != "00":
        return country
    return FALLBACK_COUNTRY_CODE


def current_boot_regdb_failed():
    result = run(["journalctl", "-b", "--no-pager", "-o", "cat"], check=False)
    if result.returncode != 0:
        return False
    text = result.stdout.lower()
    return "failed to load regulatory.db" in text or "direct firmware load for regulatory.db failed" in text


def build_no_ir_message(uplink, fallback_note=None):
    ap_support = frequency_allows_ap(uplink)
    regdom = find_regdom("phy#") or find_regdom("global") or {}
    country = regdom.get("country", "unknown")
    managed = " (self-managed)" if regdom.get("self_managed") else ""

    message = (
        f"当前上游 Wi-Fi 使用 {uplink['frequency']} MHz / 信道 {uplink['channel']}，"
        "但该网卡当前把这个信道标记为 no-IR，不能在同信道上主动发起 AP。"
    )
    if country != "unknown":
        message += f" 当前监管域是 country {country}{managed}。"
    if ap_support["line"]:
        message += f" 驱动视图: {ap_support['line']}."
    if current_boot_regdb_failed() and REGULATORY_DB.exists():
        message += " 本次开机时 cfg80211 没有成功加载 regulatory.db，而 wireless-regdb 已在之后安装；请先重启后再重试。"
    global_regdom = find_regdom("global") or {}
    if global_regdom.get("country") == "CN" and regdom.get("country") == "00" and regdom.get("self_managed"):
        message += " 已经验证过把全局监管域切到 CN 也不会改变这块 Intel 网卡当前的 self-managed PHY 监管域。"
    if fallback_note:
        message += f" {fallback_note}"
    if ap_support["radar_detection"]:
        message += " 这个信道还是 DFS 雷达信道，而标准 AP 模式不能依赖 IR_CONCURRENT / DFS_CONCURRENT 的放宽规则。"
    message += " 若仍需普通热点，只能改用 2.4GHz 上游、USB 共享网络或第二块 Wi-Fi 网卡。"
    return message


def collect_diagnostics():
    status = collect_status()
    regdom_conf_present = file_contains("/etc/conf.d/wireless-regdom", 'WIRELESS_REGDOM="CN"')
    cfg80211_conf_present = file_contains("/etc/modprobe.d/cfg80211.conf", "ieee80211_regdom=CN")
    diagnostics = {
        "service_active": status["service_active"],
        "hotspot_active": status["hotspot_active"],
        "ap_iface_exists": status["ap_iface_exists"],
        "regulatory_db_present": REGULATORY_DB.exists(),
        "cfg80211_regdom_param": read_text_if_exists("/sys/module/cfg80211/parameters/ieee80211_regdom"),
        "wireless_regdom_conf_present": regdom_conf_present,
        "cfg80211_regdom_conf_present": cfg80211_conf_present,
        "regdoms": parse_regdoms(),
        "boot_regdb_failed": current_boot_regdb_failed(),
    }

    diagnostics.update(status)

    if "uplink_frequency" in status and status["uplink_frequency"]:
        ap_support = frequency_allows_ap({"frequency": status["uplink_frequency"]})
        diagnostics["uplink_frequency_line"] = ap_support["line"]
        diagnostics["uplink_no_ir"] = ap_support["no_ir"]
    else:
        diagnostics["uplink_frequency_line"] = None
        diagnostics["uplink_no_ir"] = None

    diagnostics["same_ssid_24g_candidates"] = []
    if "uplink_iface" in status and status.get("uplink_ssid") and status.get("uplink_frequency", 0) >= 5000:
        try:
            fallback_scan = find_same_ssid_24g_candidates(
                {
                    "name": status["uplink_iface"],
                    "ssid": status["uplink_ssid"],
                    "frequency": status["uplink_frequency"],
                    "bssid": status.get("uplink_bssid"),
                },
                rescan=False,
            )
            diagnostics["same_ssid_24g_candidates"] = fallback_scan["candidates"][:3]
        except HotspotError:
            diagnostics["same_ssid_24g_candidates"] = []

    phy_regdom = next((item for item in diagnostics["regdoms"] if item["scope"].startswith("phy#")), None)
    global_regdom = next((item for item in diagnostics["regdoms"] if item["scope"] == "global"), None)

    findings = []
    recommendations = []

    if diagnostics["boot_regdb_failed"] and diagnostics["regulatory_db_present"]:
        findings.append("本次开机时 cfg80211 曾加载 regulatory.db 失败；因为现在文件已经存在，说明需要重启一次后再复测。")
        recommendations.append("先重启系统，再执行 `hotspotctl doctor` 和 `hotspotctl start` 复测。")

    if diagnostics["uplink_no_ir"] and "uplink_frequency" in diagnostics:
        findings.append(
            f"当前上游信道 {diagnostics['uplink_channel']} / {diagnostics['uplink_frequency']} MHz 仍被驱动标记为 no-IR，Linux 侧不能在这个信道上主动开启 AP。"
        )
        if global_regdom and global_regdom.get("country") == "CN":
            findings.append("即使全局监管域已经是 CN，这块无线 PHY 仍保持 self-managed 的 country 00，5GHz 普通 AP 约束没有放开。")

    if phy_regdom and phy_regdom.get("country") == "00" and phy_regdom.get("self_managed"):
        findings.append("无线 PHY 仍是 self-managed 的 country 00；Intel 固件可能会覆盖用户手动设置的监管域。")
        recommendations.append("如果重启后仍是 country 00 且 5GHz 仍 no-IR，就不要再强行改驱动，改用 2.4GHz 上游、USB 共享网络或第二块网卡。")

    if regdom_conf_present or cfg80211_conf_present:
        recommendations.append("已经写入了 CN 的持久监管域配置；需要重启后才能让 cfg80211 模块参数在新开机时生效。")
    elif not diagnostics["cfg80211_regdom_param"] or diagnostics["cfg80211_regdom_param"] == "00":
        recommendations.append("当前没有看到持久 cfg80211 监管域配置；只有在确认你所在国家代码后，才值得考虑持久设置。")

    if not findings:
        findings.append("当前没有发现明显的 regdb/no-IR 异常；可以直接再尝试启动热点。")

    diagnostics["findings"] = findings
    diagnostics["recommendations"] = recommendations
    diagnostics["phy_regdom"] = phy_regdom
    diagnostics["global_regdom"] = global_regdom
    return diagnostics


def print_doctor(as_json=False):
    diagnostics = collect_diagnostics()
    if as_json:
        print(json.dumps(diagnostics, ensure_ascii=False))
        return

    lines = [
        "并发热点诊断",
        f"服务已启动: {diagnostics['service_active']}",
        f"热点已启动: {diagnostics['hotspot_active']}",
        f"regulatory.db 已存在: {diagnostics['regulatory_db_present']}",
        f"cfg80211 监管域参数: {diagnostics.get('cfg80211_regdom_param') or 'unknown'}",
        f"已写入 /etc/conf.d/wireless-regdom: {diagnostics['wireless_regdom_conf_present']}",
        f"已写入 /etc/modprobe.d/cfg80211.conf: {diagnostics['cfg80211_regdom_conf_present']}",
        f"本次开机加载 regdb 失败: {diagnostics['boot_regdb_failed']}",
    ]

    if diagnostics.get("global_regdom"):
        item = diagnostics["global_regdom"]
        lines.append(f"全局监管域: country {item.get('country', 'unknown')} ({item.get('dfs_region', 'unknown')})")

    if diagnostics.get("phy_regdom"):
        item = diagnostics["phy_regdom"]
        managed = " self-managed" if item.get("self_managed") else ""
        lines.append(f"无线 PHY 监管域: country {item.get('country', 'unknown')} ({item.get('dfs_region', 'unknown')}){managed}")

    if "uplink_iface" in diagnostics:
        lines.extend(
            [
                f"上游接口: {diagnostics['uplink_iface']}",
                f"上游 SSID: {diagnostics.get('uplink_ssid', '')}",
                f"上游信道: {diagnostics.get('uplink_channel', '')}",
                f"上游频率: {diagnostics.get('uplink_frequency', '')}",
                f"上游信道 no-IR: {diagnostics.get('uplink_no_ir')}",
            ]
        )
    if diagnostics.get("uplink_frequency_line"):
        lines.append(f"驱动频点条目: {diagnostics['uplink_frequency_line']}")
    if diagnostics["same_ssid_24g_candidates"]:
        candidates = ", ".join(
            f"{item['bssid']}@{item['frequency']}MHz/信道{item['channel']}/信号{item['signal']}"
            for item in diagnostics["same_ssid_24g_candidates"]
        )
        lines.append(f"同 SSID 的 2.4GHz 候选: {candidates}")
    if diagnostics.get("uplink_error"):
        lines.append(f"上游错误: {diagnostics['uplink_error']}")

    lines.append("")
    lines.append("诊断结论:")
    lines.extend(f"- {item}" for item in diagnostics["findings"])
    if diagnostics["recommendations"]:
        lines.append("")
        lines.append("建议:")
        lines.extend(f"- {item}" for item in diagnostics["recommendations"])
    print("\n".join(lines))


def read_hotspot_profile():
    parser = configparser.ConfigParser(interpolation=None)
    parser.read(find_connection_file(), encoding="utf-8")

    profile = {
        "ssid": parser.get("wifi", "ssid", fallback="").strip(),
        "key_mgmt": parser.get("wifi-security", "key-mgmt", fallback="").strip(),
        "psk": parser.get("wifi-security", "psk", fallback="").strip(),
    }
    if not profile["ssid"]:
        raise HotspotError(f"热点配置“{resolve_connection_id()}”没有设置 SSID")
    return profile


def hostapd_hw_mode(frequency):
    return "g" if frequency < 5000 else "a"


def write_hostapd_config(uplink, profile):
    lines = [
        f"interface={AP_IFACE}",
        "driver=nl80211",
        f"ssid={profile['ssid']}",
        f"country_code={hotspot_country_code()}",
        "ieee80211d=1",
        f"hw_mode={hostapd_hw_mode(uplink['frequency'])}",
        f"channel={uplink['channel']}",
        "auth_algs=1",
        "wmm_enabled=1",
        "ignore_broadcast_ssid=0",
    ]
    if frequency_allows_ap(uplink)["radar_detection"]:
        lines.append("ieee80211h=1")
    if profile.get("key_mgmt") == "wpa-psk" and profile.get("psk"):
        lines.extend(
            [
                "wpa=2",
                "wpa_key_mgmt=WPA-PSK",
                "rsn_pairwise=CCMP",
                f"wpa_passphrase={profile['psk']}",
            ]
        )
    write_runtime_file(HOSTAPD_CONF, "\n".join(lines) + "\n")


def write_dnsmasq_config():
    lines = [
        f"interface={AP_IFACE}",
        "bind-interfaces",
        f"listen-address={AP_GATEWAY}",
        f"dhcp-range={DHCP_START},{DHCP_END},255.255.255.0,12h",
        f"dhcp-option=option:router,{AP_GATEWAY}",
        f"dhcp-option=option:dns-server,{AP_GATEWAY}",
    ]
    write_runtime_file(DNSMASQ_CONF, "\n".join(lines) + "\n")


def configure_forwarding(uplink_iface):
    run(["iptables", "-D", "FORWARD", "-i", AP_IFACE, "-o", uplink_iface, "-j", "ACCEPT"], check=False)
    run(
        [
            "iptables",
            "-D",
            "FORWARD",
            "-i",
            uplink_iface,
            "-o",
            AP_IFACE,
            "-m",
            "conntrack",
            "--ctstate",
            "RELATED,ESTABLISHED",
            "-j",
            "ACCEPT",
        ],
        check=False,
    )
    run(
        ["iptables", "-t", "nat", "-D", "POSTROUTING", "-s", AP_SUBNET, "-o", uplink_iface, "-j", "MASQUERADE"],
        check=False,
    )

    run_checked(["iptables", "-I", "FORWARD", "1", "-i", AP_IFACE, "-o", uplink_iface, "-j", "ACCEPT"])
    run_checked(
        [
            "iptables",
            "-I",
            "FORWARD",
            "1",
            "-i",
            uplink_iface,
            "-o",
            AP_IFACE,
            "-m",
            "conntrack",
            "--ctstate",
            "RELATED,ESTABLISHED",
            "-j",
            "ACCEPT",
        ]
    )
    run_checked(["iptables", "-t", "nat", "-I", "POSTROUTING", "1", "-s", AP_SUBNET, "-o", uplink_iface, "-j", "MASQUERADE"])


def remove_forwarding(uplink_iface):
    run(["iptables", "-D", "FORWARD", "-i", AP_IFACE, "-o", uplink_iface, "-j", "ACCEPT"], check=False)
    run(
        [
            "iptables",
            "-D",
            "FORWARD",
            "-i",
            uplink_iface,
            "-o",
            AP_IFACE,
            "-m",
            "conntrack",
            "--ctstate",
            "RELATED,ESTABLISHED",
            "-j",
            "ACCEPT",
        ],
        check=False,
    )
    run(
        ["iptables", "-t", "nat", "-D", "POSTROUTING", "-s", AP_SUBNET, "-o", uplink_iface, "-j", "MASQUERADE"],
        check=False,
    )


def wait_for_pidfile(path, timeout=5.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        pid = read_pid(path)
        if pid_is_alive(pid):
            return pid
        time.sleep(0.2)
    raise HotspotError(f"{path.name} 没有按时创建")


def start_hostapd():
    run_checked(["hostapd", "-B", "-P", str(HOSTAPD_PID), str(HOSTAPD_CONF)])
    wait_for_pidfile(HOSTAPD_PID)


def start_dnsmasq():
    run_checked(["dnsmasq", f"--conf-file={DNSMASQ_CONF}", f"--pid-file={DNSMASQ_PID}"])
    wait_for_pidfile(DNSMASQ_PID)


def create_connection(ssid, psk, owner):
    run_checked(
        [
            "nmcli",
            "connection",
            "add",
            "type",
            "wifi",
            "ifname",
            AP_IFACE,
            "con-name",
            CONNECTION_ID,
            "autoconnect",
            "no",
            "ssid",
            ssid,
        ]
    )
    modify_args = [
        "nmcli",
        "connection",
        "modify",
        CONNECTION_ID,
        "connection.interface-name",
        AP_IFACE,
        "802-11-wireless.mode",
        "ap",
        "ipv4.method",
        "shared",
        "ipv6.method",
        "disabled",
        "wifi-sec.key-mgmt",
        "wpa-psk",
        "wifi-sec.psk",
        psk,
        "connection.autoconnect",
        "no",
    ]
    if owner:
        modify_args.extend(["connection.permissions", f"user:{owner}"])
    run_checked(modify_args)


def ensure_connection(ssid, psk, owner):
    if connection_exists():
        current_id = resolve_connection_id()
        if current_id != CONNECTION_ID:
            run_checked(["nmcli", "connection", "modify", current_id, "connection.id", CONNECTION_ID])
        modify_args = [
            "nmcli",
            "connection",
            "modify",
            CONNECTION_ID,
            "connection.interface-name",
            AP_IFACE,
            "802-11-wireless.mode",
            "ap",
            "ipv4.method",
            "shared",
            "ipv6.method",
            "disabled",
            "connection.autoconnect",
            "no",
        ]
        if owner:
            modify_args.extend(["connection.permissions", f"user:{owner}"])
        run_checked(modify_args)
        return False

    create_connection(ssid=ssid, psk=psk, owner=owner)
    return True


def ensure_ap_iface():
    if iface_exists(AP_IFACE):
        delete_ap_iface()
        time.sleep(0.5)
    uplink = get_uplink_iface()
    run_checked(["iw", "dev", uplink["name"], "interface", "add", AP_IFACE, "type", "__ap"])
    run(["nmcli", "device", "set", AP_IFACE, "managed", "no"], check=False)


def delete_ap_iface():
    if iface_exists(AP_IFACE):
        run(["ip", "link", "set", AP_IFACE, "down"], check=False)
        run(["nmcli", "device", "set", AP_IFACE, "managed", "no"], check=False)
        time.sleep(0.1)
        run_checked(["iw", "dev", AP_IFACE, "del"])


def sync_connection_channel():
    uplink = get_uplink_iface()
    if "channel" not in uplink or "frequency" not in uplink:
        raise HotspotError(f"无法确定接口 {uplink['name']} 当前连接的信道")
    fallback_note = None
    if not uplink_supports_ap(uplink):
        uplink, fallback_note = maybe_move_uplink_to_24g(uplink)
    if not uplink_supports_ap(uplink):
        raise HotspotError(build_no_ir_message(uplink, fallback_note=fallback_note))
    band = get_wifi_band(uplink["frequency"])
    run_checked(
        [
            "nmcli",
            "connection",
            "modify",
            resolve_connection_id(),
            "connection.interface-name",
            AP_IFACE,
            "802-11-wireless.mode",
            "ap",
            "802-11-wireless.band",
            band,
            "802-11-wireless.channel",
            str(uplink["channel"]),
            "ipv4.method",
            "shared",
            "ipv6.method",
            "disabled",
            "connection.autoconnect",
            "no",
        ]
    )
    return uplink


def backend_start():
    try:
        profile = read_hotspot_profile()
        uplink = sync_connection_channel()
        ensure_ap_iface()
        write_hostapd_config(uplink, profile)
        write_dnsmasq_config()
        prev_ip_forward = read_sysctl("net.ipv4.ip_forward")
        set_sysctl("net.ipv4.ip_forward", "1")
        write_state({"uplink_iface": uplink["name"], "ipv4_forward": prev_ip_forward})
        start_hostapd()
        run_checked(["ip", "addr", "flush", "dev", AP_IFACE])
        run_checked(["ip", "addr", "add", AP_ADDR, "dev", AP_IFACE])
        run_checked(["ip", "link", "set", AP_IFACE, "up"])
        start_dnsmasq()
        configure_forwarding(uplink["name"])
        print(
            json.dumps(
                {
                    "service": "started",
                    "uplink_iface": uplink["name"],
                    "uplink_ssid": uplink.get("ssid"),
                    "channel": uplink.get("channel"),
                    "ap_iface": AP_IFACE,
                    "secured": bool(profile.get("key_mgmt") == "wpa-psk" and profile.get("psk")),
                }
            )
        )
    except Exception:
        state = read_state()
        stop_pidfile(DNSMASQ_PID)
        stop_pidfile(HOSTAPD_PID)
        if state.get("uplink_iface"):
            remove_forwarding(state["uplink_iface"])
        if "ipv4_forward" in state:
            try:
                set_sysctl("net.ipv4.ip_forward", str(state["ipv4_forward"]))
            except HotspotError:
                pass
        STATE_FILE.unlink(missing_ok=True)
        try:
            delete_ap_iface()
        except HotspotError:
            pass
        raise


def backend_stop():
    state = read_state()
    stop_pidfile(DNSMASQ_PID)
    stop_pidfile(HOSTAPD_PID)
    if state.get("uplink_iface"):
        remove_forwarding(state["uplink_iface"])
    if "ipv4_forward" in state:
        try:
            set_sysctl("net.ipv4.ip_forward", str(state["ipv4_forward"]))
        except HotspotError:
            pass
    STATE_FILE.unlink(missing_ok=True)
    delete_ap_iface()
    print(json.dumps({"service": "stopped", "ap_iface": AP_IFACE}))


def backend_sync():
    if not service_is_active():
        return
    backend_stop()
    backend_start()


def backend_dispatch(iface, state):
    if iface == AP_IFACE:
        return
    if state not in {"up", "dhcp4-change", "dhcp6-change", "connectivity-change", "reapply"}:
        return
    if not hotspot_is_active():
        return
    try:
        uplink = get_uplink_iface()
    except HotspotError:
        return
    if uplink["name"] != iface:
        return
    run(["systemctl", "reload", SERVICE_NAME], check=False, capture_output=False)


def user_service_action(action):
    try:
        run_checked(["systemctl", action, SERVICE_NAME])
    except HotspotError as exc:
        if action in {"start", "restart", "reload"}:
            detail = last_service_error()
            if detail:
                raise HotspotError(detail) from exc
        raise


def last_service_error():
    result = run(["journalctl", "-u", SERVICE_NAME, "-n", "60", "--no-pager", "-o", "cat"], check=False)
    if result.returncode != 0:
        return None
    lines = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    ignore_prefixes = (
        "Starting ",
        "Started ",
        "Failed to start ",
        "concurrent-hotspot.service:",
    )
    for line in reversed(lines):
        if line.startswith(ignore_prefixes):
            continue
        return line
    return None


def collect_status():
    status = {
        "service_active": service_is_active(),
        "hotspot_active": hotspot_is_active(),
        "connection_id": resolve_connection_id(),
        "ap_iface": AP_IFACE,
    }

    try:
        uplink = get_uplink_iface()
        status.update(
            {
                "uplink_iface": uplink["name"],
                "uplink_ssid": uplink.get("ssid"),
                "uplink_bssid": uplink.get("bssid"),
                "uplink_channel": uplink.get("channel"),
                "uplink_frequency": uplink.get("frequency"),
            }
        )
    except HotspotError as exc:
        status["uplink_error"] = str(exc)

    status["ap_iface_exists"] = iface_exists(AP_IFACE)
    return status


def print_status(brief=False, as_json=False):
    status = collect_status()
    if as_json:
        print(json.dumps(status, ensure_ascii=False))
        return
    if brief:
        if status["service_active"]:
            print("已开启")
        else:
            print("已关闭")
        return

    lines = [
        f"服务已启动: {status['service_active']}",
        f"热点已启动: {status['hotspot_active']}",
        f"热点配置名: {status['connection_id']}",
        f"热点接口: {status['ap_iface']}",
        f"热点接口存在: {status['ap_iface_exists']}",
    ]
    if "uplink_iface" in status:
        lines.extend(
            [
                f"上游接口: {status['uplink_iface']}",
                f"上游 SSID: {status.get('uplink_ssid', '')}",
                f"上游信道: {status.get('uplink_channel', '')}",
                f"上游频率: {status.get('uplink_frequency', '')}",
            ]
        )
    if "uplink_error" in status:
        lines.append(f"上游错误: {status['uplink_error']}")
    print("\n".join(lines))


def open_settings(mobile=False):
    kcm = "kcm_mobile_hotspot" if mobile else "kcm_networkmanagement"
    candidates = [
        ["kcmshell6", kcm],
        ["systemsettings", kcm],
    ]
    for cmd in candidates:
        try:
            subprocess.Popen(cmd)
            return
        except FileNotFoundError:
            continue
    raise HotspotError("没有找到 KDE 系统设置启动器")


def run_tray():
    from PySide6.QtCore import QProcess, QTimer
    from PySide6.QtGui import QAction, QIcon
    from PySide6.QtWidgets import QApplication, QMenu, QSystemTrayIcon

    app = QApplication(sys.argv)
    app.setQuitOnLastWindowClosed(False)

    class TrayController:
        def __init__(self):
            self.process = None
            self.tray = QSystemTrayIcon()
            self.menu = QMenu()
            self.toggle_action = QAction("启用热点")
            self.settings_action = QAction("打开网络连接设置")
            self.mobile_settings_action = QAction("打开热点设置")
            self.refresh_action = QAction("刷新状态")
            self.quit_action = QAction("退出")

            self.toggle_action.triggered.connect(self.toggle_hotspot)
            self.settings_action.triggered.connect(lambda: self.safe_open_settings(False))
            self.mobile_settings_action.triggered.connect(lambda: self.safe_open_settings(True))
            self.refresh_action.triggered.connect(self.refresh)
            self.quit_action.triggered.connect(app.quit)

            self.menu.addAction(self.toggle_action)
            self.menu.addAction(self.settings_action)
            self.menu.addAction(self.mobile_settings_action)
            self.menu.addSeparator()
            self.menu.addAction(self.refresh_action)
            self.menu.addAction(self.quit_action)

            self.tray.setContextMenu(self.menu)
            self.tray.activated.connect(self.handle_activation)

            self.timer = QTimer()
            self.timer.timeout.connect(self.refresh)
            self.timer.start(3000)

            self.refresh()
            self.tray.show()

        def icon(self, active):
            names = ["gnome-netstatus-idle", "network-wireless-hotspot"] if active else [
                "gnome-netstatus-disconn",
                "network-wireless-disconnected",
                "network-offline",
            ]
            for name in names:
                icon = QIcon.fromTheme(name)
                if not icon.isNull():
                    return icon
            return app.style().standardIcon(app.style().StandardPixmap.SP_ComputerIcon)

        def refresh(self):
            status = collect_status()
            active = status["service_active"]
            self.tray.setIcon(self.icon(active))
            self.toggle_action.setText("停用热点" if active else "启用热点")

            uplink = status.get("uplink_ssid", "未连接")
            channel = status.get("uplink_channel", "未知")
            hotspot = "已开启" if active else "已关闭"
            self.tray.setToolTip(f"并发热点 {hotspot}\n上游: {uplink}\n信道: {channel}")

        def handle_activation(self, reason):
            if reason == QSystemTrayIcon.ActivationReason.Trigger:
                self.toggle_hotspot()

        def launch_action(self, action):
            cmd = ["/usr/local/bin/hotspotctl", action]
            self.process = QProcess()
            self.process.setProcessChannelMode(QProcess.ProcessChannelMode.MergedChannels)
            self.process.finished.connect(self.handle_process_finished)
            self.process.start(cmd[0], cmd[1:])

        def toggle_hotspot(self):
            action = "stop" if service_is_active() else "start"
            self.launch_action(action)

        def handle_process_finished(self, exit_code, _exit_status):
            output = bytes(self.process.readAllStandardOutput()).decode("utf-8", errors="replace").strip()
            self.refresh()
            if exit_code != 0:
                message = output.splitlines()[-1] if output else "热点操作失败"
                self.tray.showMessage("并发热点", message, QSystemTrayIcon.MessageIcon.Warning)

        def safe_open_settings(self, mobile):
            try:
                open_settings(mobile=mobile)
            except HotspotError as exc:
                self.tray.showMessage("并发热点", str(exc), QSystemTrayIcon.MessageIcon.Warning)

    TrayController()
    sys.exit(app.exec())


def build_parser():
    parser = argparse.ArgumentParser(description="并发热点控制器")
    subparsers = parser.add_subparsers(dest="command", required=True)

    for command in ("start", "stop", "restart"):
        subparsers.add_parser(command)

    subparsers.add_parser("toggle")
    subparsers.add_parser("tray")

    status_parser = subparsers.add_parser("status")
    status_parser.add_argument("--brief", action="store_true")
    status_parser.add_argument("--json", action="store_true")

    doctor_parser = subparsers.add_parser("doctor")
    doctor_parser.add_argument("--json", action="store_true")

    settings_parser = subparsers.add_parser("settings")
    settings_parser.add_argument("--mobile", action="store_true")

    ensure_parser = subparsers.add_parser("ensure-connection")
    ensure_parser.add_argument("--ssid", required=True)
    ensure_parser.add_argument("--psk", required=True)
    ensure_parser.add_argument("--owner", default="")

    subparsers.add_parser("backend-start")
    subparsers.add_parser("backend-stop")
    subparsers.add_parser("backend-sync")

    dispatch_parser = subparsers.add_parser("backend-dispatch")
    dispatch_parser.add_argument("iface")
    dispatch_parser.add_argument("state")

    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()

    try:
        if args.command in {"start", "stop", "restart"}:
            user_service_action(args.command)
        elif args.command == "toggle":
            user_service_action("stop" if service_is_active() else "start")
        elif args.command == "status":
            print_status(brief=args.brief, as_json=args.json)
        elif args.command == "doctor":
            print_doctor(as_json=args.json)
        elif args.command == "settings":
            open_settings(mobile=args.mobile)
        elif args.command == "ensure-connection":
            created = ensure_connection(ssid=args.ssid, psk=args.psk, owner=args.owner)
            print(json.dumps({"created": created, "connection_id": CONNECTION_ID}, ensure_ascii=False))
        elif args.command == "backend-start":
            backend_start()
        elif args.command == "backend-stop":
            backend_stop()
        elif args.command == "backend-sync":
            backend_sync()
        elif args.command == "backend-dispatch":
            backend_dispatch(args.iface, args.state)
        elif args.command == "tray":
            run_tray()
    except HotspotError as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
