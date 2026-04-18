---
name: device-info
description: 获取当前设备时间、日期、位置与方向信息。
author: ChatroomAI
version: "0.1.0"
requires-read-before-call: false
---

# Device Info

## Overview

用于读取手机端的基础设备信息，包括系统时间、时区、屏幕信息、设备方向，以及位置（若权限可用）。

## Scripts

### scripts/get_device_info.internal

返回 JSON，主要字段：

- `systemTime`: epoch、ISO、本地时间、时区
- `device`: userAgent、platform、language、viewport、screen
- `orientation`: 方向类型与角度（不可用时返回 unavailable 信息）
- `location`: 经纬度与精度（权限拒绝或不可用时返回 `available: false` 与原因）

可选参数：

- `--no-location`：跳过位置读取
- `--no-orientation`：跳过方向读取
- `--location-timeout-ms <number>`：位置读取超时时间（毫秒）

## Output Format

脚本输出 JSON 对象。
