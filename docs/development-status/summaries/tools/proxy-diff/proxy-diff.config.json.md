## 功能

proxy-diff 的默认配置文件。定义 CPA（端口 8080）、ActiNet（端口 3000）、mihomo 代理（端口 7890）、真实上游（api.openai.com）、测试套件（端口 9000）的默认连接参数。

## 关系

### 被依赖

- `src/config.ts` — `loadConfig()` 读取此文件
