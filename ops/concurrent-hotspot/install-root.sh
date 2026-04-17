#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
TARGET_USER=""
TARGET_HOME=""

if [ -n "${PKEXEC_UID:-}" ]; then
    TARGET_USER=$(id -nu "$PKEXEC_UID")
fi

if [ -z "$TARGET_USER" ] && [ -n "${SUDO_USER:-}" ]; then
    TARGET_USER=$SUDO_USER
fi

if [ -z "$TARGET_USER" ]; then
    TARGET_USER=dandwan
fi

TARGET_HOME=$(getent passwd "$TARGET_USER" | cut -d: -f6)
DEFAULT_SSID="$(hostname) 热点"
DEFAULT_PSK=$(python3 -c 'import secrets, string; chars = string.ascii_letters + string.digits; print("".join(secrets.choice(chars) for _ in range(16)))')

pacman -S --noconfirm --needed hostapd dnsmasq >/dev/null

install -Dm0755 "$SCRIPT_DIR/concurrent-hotspot.py" /usr/local/libexec/concurrent-hotspot.py
install -Dm0755 "$SCRIPT_DIR/hotspotctl" /usr/local/bin/hotspotctl
install -Dm0644 "$SCRIPT_DIR/concurrent-hotspot.service" /etc/systemd/system/concurrent-hotspot.service
install -Dm0755 "$SCRIPT_DIR/90-concurrent-hotspot-sync" /etc/NetworkManager/dispatcher.d/90-concurrent-hotspot-sync
install -Dm0644 "$SCRIPT_DIR/rootfs/etc/conf.d/wireless-regdom" /etc/conf.d/wireless-regdom
install -Dm0644 "$SCRIPT_DIR/rootfs/etc/modprobe.d/cfg80211.conf" /etc/modprobe.d/cfg80211.conf
install -Dm0644 "$SCRIPT_DIR/concurrent-hotspot-tray.desktop" "$TARGET_HOME/.config/autostart/concurrent-hotspot-tray.desktop"
chown "$TARGET_USER:$TARGET_USER" "$TARGET_HOME/.config/autostart/concurrent-hotspot-tray.desktop"
sed "s/__HOTSPOT_USER__/$TARGET_USER/g" "$SCRIPT_DIR/49-concurrent-hotspot.rules.in" >/etc/polkit-1/rules.d/49-concurrent-hotspot.rules
chmod 0644 /etc/polkit-1/rules.d/49-concurrent-hotspot.rules

ENSURE_JSON=$(python3 /usr/local/libexec/concurrent-hotspot.py ensure-connection --ssid "$DEFAULT_SSID" --psk "$DEFAULT_PSK" --owner "$TARGET_USER")
CREATED=$(printf '%s\n' "$ENSURE_JSON" | python3 -c 'import json,sys; print("yes" if json.load(sys.stdin)["created"] else "no")')

systemctl daemon-reload

echo "已为用户安装并发热点：$TARGET_USER"
if [ "$CREATED" = "yes" ]; then
    echo "默认热点名称：$DEFAULT_SSID"
    echo "默认热点密码：$DEFAULT_PSK"
else
    echo "已保留现有的 NetworkManager 热点配置：并发热点"
fi
