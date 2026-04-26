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
- `HOME`: 指向运行时私有可写目录
- `PYTHONHOME`: Python 运行时根目录
- `SSL_CERT_FILE`: 指向 `etc/tls/cert.pem`
- `SSL_CERT_DIR`: 指向 `etc/ssl/certs`
- `NODE_EXTRA_CA_CERTS`: Node 额外 CA 文件
- `OPENSSL_CONF`: 指向 `etc/tls/openssl.cnf`
- `MPLBACKEND`: Python 运行时默认设为 `Agg`
- `MPLCONFIGDIR`: Python 运行时的 Matplotlib 可写配置目录
- `PIP_CACHE_DIR`: Python 运行时的 pip 缓存目录
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

## 7. 当前 Python 科学运行时打包约定

本仓库新增了 Python 打包脚本：

```bash
npm run runtime:package:python
```

当前实现基于 Termux aarch64 预编译包，默认会优先组合：

- `python`
- `python-pip` / `pip`
- `python-numpy`
- `python-pandas`
- `matplotlib`

并递归拉取它们的依赖。脚本会优先使用官方 Termux 主仓，缺失包再回退到 TUR (`https://tur.kcubeterm.com`)。

脚本默认还会尽量纳入一批常用包；若仓库里有可用的 Termux 包，会自动并入运行时，例如：

- `python-lxml`
- `python-httpx`
- `python-openai`
- `python-pydantic`
- `python-dotenv`
- `python-requests`
- `python-pyyaml`
- `python-rich`
- `python-click`
- `python-markdown`
- `python-tqdm`

默认输出仍位于：

```text
dist/runtime-packages/<runtime-id>.zip
```

如果要刷新 App 内置资产，推荐显式输出到：

```bash
node scripts/package-python-runtime.mjs --output-dir public/runtime-packages
```

默认缓存目录位于：

```text
.local/runtime-package-cache/python/
```

其中：

- `indexes/` 保存 `Packages` 索引快照
- `packages/` 保存下载好的 `.deb` 缓存

如果主机无法联网，但缓存已准备好，可以直接离线组包：

```bash
node scripts/package-python-runtime.mjs --offline true --output-dir public/runtime-packages
```

当前 Python 科学运行时还会额外补一层“补充 wheel”：

- `python-dateutil`
- `six`
- `cycler`
- `fonttools`
- `packaging`
- `pyparsing`

这些依赖不会完全依赖 Termux `.deb` 关系，而是从本地 wheel 缓存注入，以修正上游包元数据不完整的问题。

对于 `matplotlib`，当前打包器会把 `kiwisolver` 从启动时强制版本检查里移除。
这意味着：

- 基础 `import matplotlib` 和常见静态出图路径可以工作
- 依赖 `kiwisolver` 的布局能力（例如部分 `constrained layout` 相关路径）若无该包，仍会在真正使用时失败

打包机需要具备：

- 外网访问 Termux / TUR 包源
- `ar`
- `tar`

## 8. 设计约束

- 运行时包必须对 skill 通用，不能为某个具体 skill 特化目录或补丁
- skill 业务逻辑必须保留在 skill 自身，不进入宿主 App
- 宿主可以提供“可选内置运行时”，但结构仍需遵守同一套规范
- Python 运行时若内置科学栈，应优先复用仓库打包器而不是手工拼装 ZIP
