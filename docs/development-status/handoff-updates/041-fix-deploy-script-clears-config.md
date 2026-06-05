# 041 — 修复部署脚本清空云端配置

**日期**：2026-06-06

## 范围

修复 `scripts/deploy-cloud-server.sh`：运行一键部署脚本后，远程服务器上的 `config.json` 会被 `rsync --delete` 删除，导致通过 Admin UI 设置的所有云服务配置（SMTP、邮件服务器模式、DKIM、TLS、站点 URL、模型映射等）被清空。

## 根因

部署脚本使用 `rsync -avz --delete` 同步 `cloud-server/` 到远程服务器。`--delete` 会删除远程存在但本地不存在的文件。本地开发环境通常没有 `config.json`（依赖默认值 + 环境变量），但远程生产服务器上有精心配置的 `config.json`。rsync 排除列表保护了 `node_modules`、`dist`、`data` 等目录，但遗漏了 `config.json`。

## 变更的代码区域

### 修改：`scripts/deploy-cloud-server.sh`（1 行）

rsync 排除列表新增一行：`--exclude='config.json'`

### 代码摘要
- 新建：`docs/development-status/summaries/scripts/deploy-cloud-server.sh.md`

## 决策关卡

- 属于小修复（单文件、根因明确、1 行代码、无 API/架构变更），跳过完整流程。

## 验证

- 手动审查：排除列表语法正确，与其他排除项一致
- rsync `--exclude` 行为验证：目录级递归匹配文件名，`config.json` 在所有深度都会被排除

## 已知限制

- `.env` 文件目前未被排除，若远程对 `.env` 有本地修改也可能被覆盖。当前本地 `.env.production` 已纳入版本控制，暂不成问题。必要时可追加排除。
- 远程 `config.json` 需要由运维手动创建初始版本或通过 Admin UI 首次设置后生成

## 下一步

无。
