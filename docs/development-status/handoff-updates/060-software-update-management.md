# 060 — 软件更新管理系统（ActiChat + ActiNet）

**日期**：2026-06-08

## 范围

实现了完整的软件更新管理系统，涵盖 ActiNet 后台管理、灰度发布、增量更新补丁生成，以及 ActiChat 客户端的更新检测、弹窗提示、下载安装。

## 变更的代码区域

### ActiNet 云服务后台

| 文件 | 变更 |
|------|------|
| `cloud-server/src/types.ts` | 新增 `SoftwareUpdate` 接口、`UpdateRolloutMode` 类型；`User` 接口新增 `app_version_code` 字段 |
| `cloud-server/src/config.ts` | 新增 `apkStorageDir` 配置项（默认 `data/apk`） |
| `cloud-server/src/db/migrations.ts` | v9 migration：新建 `software_updates` 表 + `users` 表新增 `app_version_code` 列 |
| **`cloud-server/src/db/repositories/update-repo.ts`** | **新建** — SoftwareUpdate 数据仓库，含灰度判定逻辑 `findUpdateForVersion()` / `shouldRolloutToUser()` |
| `cloud-server/src/db/repositories/user-repo.ts` | `userFromRow` / `create` 支持 `app_version_code`；新增 `updateAppVersionCode()` |
| `cloud-server/src/db/repositories/usage-repo.ts` | 新增 `countForUserSince()` — 按用户 + 时间窗口统计请求数 |
| `cloud-server/src/app-context.ts` | repos 新增 `updates: UpdateRepo` |
| `cloud-server/src/auth/auth-service.ts` | `createUser()` 新增 `app_version_code: 0` |
| `cloud-server/src/auth/auth-routes.ts` | `GET /api/auth/me` 接受 `version_code` query param 并自动更新用户版本；响应新增 `app_version_code` |
| **`cloud-server/src/update/update-routes.ts`** | **新建** — 客户端公开 API：`GET /api/updates/check`（版本检查 + 灰度判定）、`GET /api/updates/download/:id`（文件流式下载） |
| `cloud-server/src/admin/admin-routes.ts` | 新增软件更新 CRUD + APK 上传（multer）+ bsdiff 增量补丁生成；`GET /users` 响应新增 `app_version_code`；`GET/PUT /settings` 新增 `apkStorageDir` |
| `cloud-server/src/app.ts` | 挂载 `/api/updates` 路由 |
| `cloud-server/Dockerfile` | 安装 `bsdiff` + 创建 `/app/data/apk` 目录 |

### Admin UI

| 文件 | 变更 |
|------|------|
| `cloud-server/admin-ui/src/api.ts` | 新增 `SoftwareUpdateData` 接口、`UserData.app_version_code`、`ServerSettings.apkStorageDir`；新增 `fetchSoftwareUpdates`、`createSoftwareUpdate`（FormData 上传）、`uploadApkForUpdate`、`updateSoftwareUpdate`、`deleteSoftwareUpdate`、`rolloutSoftwareUpdate` |
| **`cloud-server/admin-ui/src/pages/SoftwareUpdatesPage.tsx`** | **新建** — 更新管理页面：列表展示 + 创建表单（含 APK 文件上传、灰度配置）+ 全量推送 + 上传/替换 APK + 启用/禁用 + 删除 |
| `cloud-server/admin-ui/src/components/Layout.tsx` | 导航新增「软件更新」；`Page` 类型新增 `'software-updates'` |
| `cloud-server/admin-ui/src/pages/UsersPage.tsx` | 表头新增「客户端版本」列（version_code → 版本号转换显示） |
| `cloud-server/admin-ui/src/App.tsx` | 路由新增 `software-updates` → `SoftwareUpdatesPage` |

### ActiChat 客户端

| 文件 | 变更 |
|------|------|
| **`src/services/app-update.ts`** | **新建** — `checkForUpdate()`、`downloadUpdate()`（含进度回调）、`dismissUpdate()` / `isUpdateDismissed()` |
| **`src/utils/app-version.ts`** | **新建** — `getAppVersion()`（Native → 构建常量回退）、版本号/名称格式转换 |
| **`src/components/UpdateDialog.tsx`** | **新建** — 更新提醒弹窗（复用 `delete-dialog` 样式），含下载进度条 + 安装触发 |
| `src/services/cloud-auth.ts` | `CloudUserInfo` 新增 `app_version_code?`；`fetchCloudUserInfo()` 上报客户端版本号 |
| `src/App.tsx` | 启动后自动检查更新（auto-login 成功时）→ UpdateDialog 弹窗；设置页底部新增「软件更新」section（当前版本 +「检查更新」按钮）；`handleInstallUpdate()` 处理下载后安装逻辑 |
| `vite.config.ts` | 新增 `define`：`__APP_VERSION__`、`__APP_VERSION_CODE__`、`__ACTICHAT_VERSION_CODE__`（从 `package.json` 读取） |

### Android 原生

| 文件 | 变更 |
|------|------|
| `android/.../SkillRuntimePlugin.java` | 新增 4 个 PluginMethod：`getVersionCode()`、`cacheCurrentApk()`、`applyPatch()`（调用 bspatch 二进制）、`installApk()`（FileProvider + Intent 触发系统安装器） |

## 设计决策

1. **增量更新在服务器端自动生成**：管理员上传新 APK 后，服务器调用 `bsdiff` 生成相对于前一版本的增量补丁（`.patch` 文件）
2. **灰度发布三种模式**：
   - `all`：全量推送（所有用户）
   - `percentage`：确定性哈希取模（userId hash % 100）
   - `metric`：基于用户指标（账户注册天数、近7日请求数等 JSON 规则）
3. **客户端优先增量补丁**：`GET /api/updates/check` 返回时优先增量补丁（如果 `base_version_code` 匹配），否则返回全量 APK
4. **弹窗去重**：客户端在 localStorage 记录已拒绝的 `version_code`，同版本不再自动弹窗（手动检查忽略 dismiss 记录）
5. **版本上报时机**：客户端在 `GET /api/auth/me` 时通过 `?version_code=X` 上报版本号
6. **bspatch 二进制**：预编译 aarch64 版本，放在 `android/app/src/main/assets/bspatch`
7. **APK 缓存**：首次启动缓存当前 APK 到 `/data/.../cache/apk-cache/base.apk`，供增量更新使用

## API 设计

### 客户端公开接口

```
GET /api/updates/check?version_code=1500&user_id=xxx
→ { has_update: true, update: { id, version_name, version_code, release_notes, download_type: "patch"|"full", download_url, file_size_bytes, file_sha256, base_version_code? } }
或 → { has_update: false }

GET /api/updates/download/:id?type=patch|full
→ 流式返回 APK 或 patch 文件，计数下载次数
```

### 管理后台接口

```
GET    /api/admin/software-updates
POST   /api/admin/software-updates          — multipart APK 上传
PUT    /api/admin/software-updates/:id
DELETE /api/admin/software-updates/:id
POST   /api/admin/software-updates/:id/upload  — 替换已有更新的 APK
POST   /api/admin/software-updates/:id/rollout — 一键全量推送
```

## 验证

- `npx tsc --noEmit` — cloud-server：零错误
- `npx tsc --noEmit` — admin-ui：零错误
- `npx tsc -b` — 主项目（ActiChat）：零错误

## 决策关卡

- 方案已提出：是（含完整数据流图、灰度逻辑、增量更新机制）
- 用户确认已收到：是
- 用户需求：
  1. 后台手动上传 APK，服务器提供下载 → 已实现
  2. 普通模式（非强制更新） → 已实现
  3. 灰度指标：百分比、注册天数、请求数 → 已实现
  4. Android 端新增 Plugin 方法（SkillRuntimePlugin）→ 已实现
  5. 一期包含增量更新 → 已实现（bsdiff/bspatch）

## 已知限制

1. **bspatch 二进制需手动复制**：需将预编译的 aarch64 `bspatch` 二进制放入 `android/app/src/main/assets/bspatch`（未纳入仓库）
2. **x86_64 模拟器不兼容**：bspatch 仅 aarch64，模拟器增量更新不可用
3. **多实例部署**：增量补丁生成依赖于同一服务器文件系统，多实例共享 volume 时需确保 APK 目录一致
4. **未做 APK 文件清理**：旧版本的 APK 文件不会自动删除，管理员需手动管理

## 下一步

- 编译 aarch64 `bspatch` 二进制并放入 Android assets 目录
- 构建 admin UI（`npm run build:admin-ui`）部署验证
- 编译 Android debug APK 并在真机测试完整更新流程
- Docker 部署后验证服务器端 bsdiff 可用
- 可选：添加 APK 文件管理清理功能
- 可选：Admin UI 增加「下载统计」图表
- 可选：支持 x86_64 bspatch 以支持模拟器测试
