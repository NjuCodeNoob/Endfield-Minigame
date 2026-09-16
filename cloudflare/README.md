# Cloudflare 竞速服务

## 架构
GitHub Pages 托管静态游戏。Workers 接收 HTTP 操作和 WebSocket 连接，SQLite Durable Object 负责服务器权威状态、计时、房间同步，D1 保存匿名身份与成绩。无需连接上海服务器。

此版本面向小规模试玩，采用单个协调对象，最多同时 64 场挑战（含个人和等待房间）。这不是横向扩展后的大规模架构；扩大使用量前应拆分每房间对象、加入账号及更严格的流量治理。不要开通收费计划来绕过限制，先查看实际使用量。

WebSocket 每 6 秒发送心跳；房间、比分等操作仍通过已鉴权 HTTP 提交，状态通过 WebSocket 推送。断网自动重连，20 秒失联按原规则判负。授权令牌通过子协议传递，不出现在 URL。浏览器身份令牌保存在本地，请勿共享浏览器存储。

房间在 Durable Object SQLite 中持久化。完成成绩先写本地 outbox，再按唯一 ID 写 D1，防止重试重复计分。DO 重新初始化时恢复房间，闹钟执行超时检查。无活动比赛时不会每秒轮询唤醒。

## 开发
使用 Node.js 22 或更新版本与 pnpm。
```
pnpm install
pnpm exec wrangler d1 migrations apply endfield-race-db --local --config cloudflare/wrangler.json
pnpm run cf:dev
```
另一个终端执行 `pnpm run cf:test`。该集成测试仅连接本机 8787，会读取本地模拟器数据库中的参考解来验证完整通关，不向公开 API 暴露答案。前端在竞速菜单连接设置填写 `http://127.0.0.1:8787`。

## 发布
注册并验证 Cloudflare 邮箱后使用 `pnpm exec wrangler login`，切勿把 OAuth 配置、API Token 或本地存储提交到 Git。
`wrangler.json` 的 account_id 和 database_id 是资源标识，不是凭证；复制本项目到另一账号时，需要创建自己的 D1 并修改对应标识。
```
pnpm exec wrangler d1 migrations apply endfield-race-db --remote --config cloudflare/wrangler.json
pnpm run cf:deploy
```
将实际部署后的 HTTPS 地址写入 `dist/race-config.js`，发布 GitHub Pages。workers.dev 在部分网络不可达；需实测目标玩家网络，必要时绑定自己的域名后重试。自定义域名并不保证所有网络均稳定。

新前端来源需要加入 ALLOWED_ORIGINS，变更后重新部署。只在 HTTPS 前端连接 HTTPS/WSS 后端。

本地/上海服务器旧成绩不会自动转入新数据库；当前 Cloudflare 成绩从新数据库开始。需要迁移时先导出备份并核对身份映射。

## 验证
- 原项目测试：`pnpm test`
- 脚本语法：`pnpm run check`
- Cloudflare 本地集成：`pnpm run cf:test`
- 构建检查：`pnpm exec wrangler deploy --dry-run --config cloudflare/wrangler.json`

免费方案有请求、CPU 和存储配额，不能承诺任意人数永久免费。开发期间不自动订阅付费计划。

## 当前部署
后端：https://endfield-race.endfield-simulation-terminal.workers.dev

前端：https://njucodenoob.github.io/Endfield-Minigame/

部署后已验证公开 HTTPS、GitHub Pages 来源跨域请求、双客户端 WebSocket、统一倒计时、双方跳过和退出判负。公网验证使用当前开发环境的代理出口；中国内地玩家直连仍需各自网络实测。
