# Runtime Package Specification

本文档说明 ChatroomAI 内置 skill 运行时包的目录结构、元数据约定和宿主装载行为。该规范面向通用运行时，不绑定任何单个 skill。

## 1. 目标

运行时包用于给 skill 提供解释器或可执行环境，例如 Node.js、Python。宿主应用只负责：

- 解压运行时 ZIP 到应用私有目录
- 识别运行时类型和入口
- 为 skill 进程注入基础环境变量
- 执行脚本并回收 stdout / stderr / exitCode

宿主不应提供搜索、抓取、聚合等业务能力。

## 2. ZIP 结构

运行时 ZIP 必须只包含一个顶层目录。安装后，该目录会落到：

```text
files/skill-host/runtimes/<runtime-id>/
```

推荐结构：

```text
<runtime-id>/
├── runtime.json
├── bin/
│   └── node | python | python3
├── lib/
│   └── *.so
├── etc/
│   ├── tls/cert.pem
│   ├── tls/openssl.cnf
│   └── ssl/certs/
└── share/
```

约定：

- `bin/` 放解释器主入口
- `lib/` 放共享库
- `etc/tls/cert.pem` 和 `etc/ssl/certs/` 用于 TLS 证书
- `etc/tls/openssl.cnf` 用于 OpenSSL 运行时配置，Termux 系运行时通常需要它
- 其他目录按运行时自身需要附带

## 3. runtime.json

推荐提供 `runtime.json`，当前宿主会优先读取其中的元数据：

```json
{
  "schemaVersion": 1,
  "id": "nodejs-termux-aarch64",
  "type": "node",
  "displayName": "Node.js Runtime (aarch64)",
  "version": "25.8.2",
  "entrypoint": "bin/node",
  "arch": "aarch64"
}
```

字段说明：

- `schemaVersion`: 清单版本，当前为 `1`
- `id`: 运行时标识，通常等于顶层目录名
- `type`: `node` 或 `python`
- `displayName`: UI 展示名称
- `version`: 展示版本
- `entrypoint`: 相对顶层目录的主可执行文件
- `arch`: 可选，记录构建架构

如果缺少 `runtime.json`，宿主会回退到目录扫描，自动查找 `node`、`nodejs`、`python`、`python3` 等可执行文件。

## 4. 执行时环境

宿主执行脚本时会自动补充这些环境变量：

- `PATH`: 追加运行时 `bin/`
- `LD_LIBRARY_PATH`: 追加运行时 `lib/`
- `PYTHONHOME`: Python 运行时根目录
- `SSL_CERT_FILE`: 指向 `etc/tls/cert.pem`
- `SSL_CERT_DIR`: 指向 `etc/ssl/certs`
- `NODE_EXTRA_CA_CERTS`: Node 额外 CA 文件
- `OPENSSL_CONF`: 指向 `etc/tls/openssl.cnf`
- `SKILL_NODE_EXECUTABLE`: 当前可用 Node 解释器绝对路径
- `SKILL_PYTHON_EXECUTABLE`: 当前可用 Python 解释器绝对路径

其中 `SKILL_NODE_EXECUTABLE` / `SKILL_PYTHON_EXECUTABLE` 适合给 shell wrapper 使用，例如 `.internal` 入口先由 `sh` 启动，再显式转调真实解释器。

## 5. 与 Skill 的配合方式

Skill 脚本可以直接是：

- Python 脚本：shebang 包含 `python`
- Node 脚本：shebang 包含 `node`
- Shell wrapper：再通过 `SKILL_NODE_EXECUTABLE` 或 `SKILL_PYTHON_EXECUTABLE` 转调实际入口

推荐 shell wrapper 形式用于无扩展名入口，例如：

```sh
#!/system/bin/sh
SCRIPT_DIR=$(CDPATH= cd -- "$(dirname "$0")" && pwd)
exec "$SKILL_NODE_EXECUTABLE" "$SCRIPT_DIR/run-skill.cjs" "$(basename "$0")" "$@"
```

## 6. 当前 Node 运行时打包约定

本仓库的 Node 打包脚本：

```bash
npm run runtime:package:node
```

当前实现基于 Termux 包，打包内容包括：

- `nodejs`
- `libc++`
- `openssl`
- `c-ares`
- `libicu`
- `libsqlite`
- `zlib`
- `ca-certificates`

输出 ZIP 默认位于：

```text
dist/runtime-packages/<runtime-id>.zip
```

## 7. 设计约束

- 运行时包必须对 skill 通用，不能为某个具体 skill 特化目录或补丁
- skill 业务逻辑必须保留在 skill 自身，不进入宿主 App
- 宿主可以提供“可选内置运行时”，但结构仍需遵守同一套规范
- 未来如果增加 Python 打包器，应复用同样的 ZIP 结构和 `runtime.json` 约定
