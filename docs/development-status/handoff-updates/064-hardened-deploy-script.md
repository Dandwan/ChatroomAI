# 064 — 部署脚本容错加固：构建与切换解耦

**日期**：2026-06-09

## 范围

修复 `scripts/deploy-cloud-server.sh` 的关键缺陷：当 Docker 构建失败时，已停止的旧容器无法恢复，造成 ActiNet 云服务中断。将构建步骤与容器停启步骤解耦，确保构建失败不会影响正在运行的服务。

## 根因

旧流程（第 122-125 行）：

```bash
docker compose down              # ① 先停掉旧容器 → 服务中断
docker compose up -d --build     # ② 构建 + 启动，若构建失败 → 服务无法恢复
```

`--build` 失败的原因包括：npm 依赖下载失败、TypeScript 编译错误、Dockerfile 语法错误、网络问题等。一旦 `docker compose down` 已执行，旧容器已被销毁，即使构建失败也无法回滚。

## 变更的代码区域

### 修改：`scripts/deploy-cloud-server.sh`

- **Step 3 远程执行块**：
  - 将 `docker compose up -d --build` 拆分为独立的 `docker compose build` 和 `docker compose up -d`
  - `docker compose build` 先执行（旧容器不受影响）
  - 仅构建成功后才执行 `docker compose down` + `docker compose up -d`
  - 添加新容器启动后健康检查（curl `/health` 端点 + 容器状态双重确认）

### 代码摘要
- 更新：`scripts/deploy-cloud-server.sh.md`

## 决策关卡

- 方案已提出：是（本次对话中向用户说明）
- 用户确认：是（用户直接提出了此改进需求）

## 验证

- Shell 语法检查通过
- 逻辑审查：构建失败时脚本因 `set -e` 退出，旧容器继续运行
- 未实际远程部署验证（需用户手动执行）

## 已知失败 / 跳过的检查

- 未在远程服务器上执行端到端部署测试（本地无远程服务器访问权限）
- 未模拟 Docker 构建失败场景

## 待解决问题 / 风险

- **边缘情况**：构建成功后，如果 `docker compose up -d` 阶段失败（如端口被占用），旧容器已被 `docker compose down` 停止，仍会有短暂服务中断。此场景概率极低（镜像已构建成功，容器创建极少失败），暂不处理。
- **零停机部署**：当前方案仍有数秒停机时间。如需完全零停机，需引入 blue-green 部署或 Docker Swarm rolling update，架构复杂度较高，留待后续。
- `.env` 文件未在 rsync 排除列表中（参见 041），当前 `.env.production` 纳入版本控制，暂不成问题。

## 下一步

- 部署到远程服务器后验证正常流程
- 可考虑在远程服务器上预配置 `docker compose build` 的超时时间
