---
name: runtime-shell
description: 通过已安装运行时直接执行 Node/Python 命令，并支持命令输出持续查看。
author: ChatroomAI
version: "0.1.0"
---

# Runtime Shell

## Overview

用于直接调用已安装的 Node / Python 运行时，支持两种模式：

1. 命令模式（`mode=command`）：提交命令并等待一段时间返回输出。
2. 查看模式（`mode=view`）：查看上一条命令当前输出，可选等待后再查看。

## Scripts

### scripts/runtime_exec.internal

参数说明：

- `--mode <command|view>`：必填
- `--runtime <node|python>`：必填
- `--label <string>`：可选，会话标签。不传时按语言走默认会话
- `--wait-ms <number>`：可选，等待毫秒数（命令模式/查看模式都可用）
- `--command <string>`：命令模式必填

命令模式行为：

- 同一 `runtime + label` 会话再次调用命令模式时，会终止旧进程并启动新进程。
- 若等待时间到了命令仍在运行，进程不会停止，可在查看模式继续读取输出。

查看模式行为：

- 读取同一会话最近一次命令的 stdout/stderr。
- 可通过 `--wait-ms` 先等待一段时间再读取，便于观察长耗时命令。

## Output Format

输出 JSON，常见字段：

- `ok`
- `mode`
- `runtime`
- `label`
- `running`
- `pid`
- `stdout`
- `stderr`
- `command`
- `startedAt`
- `updatedAt`
