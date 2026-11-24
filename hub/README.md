# Site Control Hub 2.0 — alpha.1

这是独立的通用控制中心源代码，不是已部署服务。保留 v1 技能和原有网站。目标：一个 OAuth MCP 插件，多个独立网站，通过服务器间令牌接入。公开仓库只保存通用代码与假数据；实际网站、数据、凭证、所有者 ID 和数据库实例均不在 Git 中。

## 当前实现
- GitHub OAuth 登录：必须配置固定数字用户 ID，非所有者拒绝；无公共管理员注册。浏览器会话及一次性登录/授权状态保存在 D1。
- D1 网站注册、令牌哈希/到期/轮换/撤销、心跳、版本快照、提案、审批、审计；客户端主动轮询，无任意 URL 抓取。
- Cloudflare OAuth Provider + MCP SDK：授权时选择站点，每个站点的读取/提出修改分权，服务端按授权、过期、撤销和站点校验。所有者可在后台修改现有 AI 授权的站点列表，新增网站不需要重装 MCP；OAuth 原先未授权的写范围不能由后台直接升级。四个工具 list_sites、get_site_status、list_site_changes、propose_site_change。
- 所有者后台：注册、比较旧/新配置、审批/拒绝、撤销、创建恢复提案。批准不等于已执行，只有网站确认持久化之后才标记 applied。
- SDK 原型：一个 server-only syncOnce，对网站本地配置进行版本 CAS，失联后可重试回执。当前仅支持 title / notice / maintenance 三个非敏感字段，严禁用它上传个人业务数据。
- 目前没有自动定时任务、任意代码执行、Git 部署权、跨站凭证共享、政策业务接口、上传文件或私密信息。原站独立后台保持不变。不会承诺所有 ChatGPT Sites 均可运行服务器轮询；必须逐站验证实际托管能力。

## 部署前准备（所有者一次授权）
1. 在 Cloudflare 账户安装 Node/npm，进入 hub，运行 npm ci --ignore-scripts、npm audit --audit-level=high、npm run check 和 npm run build。仓库已包含由成功的 CI 解析得到的 package-lock.json。
2. npx wrangler login（浏览器登录授权，不把 token 发给 AI）；npx wrangler d1 create site-control-hub；npx wrangler kv namespace create OAUTH_KV。也可由 Wrangler 自动配置资源（具体以当前 CLI 提示为准）。若手动创建，将绑定 ID 写入本地部署配置，禁止提交真实账户信息。部署前确认免费额度。
3. 在 GitHub Settings / Developer settings / OAuth Apps 新建 OAuth App，Homepage URL 为自己的 workers.dev 地址；回调为同一地址 /callback。
4. npx wrangler secret put HUB_ORIGIN（自己的完整 HTTPS origin，不含路径或尾部以外内容）、GITHUB_CLIENT_ID、GITHUB_CLIENT_SECRET、OWNER_GITHUB_ID（固定数字 ID，不是可改用户名）。用服务端 Secret 安全输入。不要把这些配置写入代码。
5. npx wrangler d1 migrations apply DB --remote；npx wrangler deploy。实际部署前以 staging/隔离测试库试验，生产发布需 owner 明确批准。
6. 在 /admin 用指定 GitHub 账号登录，先注册假数据测试站。将一次性 SITE_TOKEN 放到该站 server secret；使用 sdk/adapter.js，真实存储必须原子 CAS，配置只能是白名单字段。
7. 使用 MCP Inspector 测试 /mcp 的实际 OAuth 流程；再在支持自定义插件的 ChatGPT 客户端安装这一个 MCP。选择 scope control:read 和 control:propose（offline_access 如客户端需要）。OAuth 客户端、回调和资源元数据须按实际平台测试，未通过前不连接真实站。
8. 必须验证：未授权拒绝、错误账号、过期/撤销、跨站拒绝、CSRF、错误 revision、重复回执、站点离线、恢复旧值、手机后台、独立会话真实工具调用，以及安全依赖审查。未通过不得迁移真实站。

## 接入协议
POST /api/sites/{site_id}/heartbeat | poll | ack，Authorization: Bearer <site token>，JSON。无对外任意 URL 请求；Hub 只存声明的网址用于人工识别。心跳报 {revision,config}；poll 返回已批准 job 或 null；ack 报 {id,ok,revision,config}（失败只报 id,ok:false）。仅传公开/可共享维护字段。网站本地数据仍是事实来源。一个网站一次最多一个批准未确认的提案；任何变更须由网站实际执行并返回与审批内容一致的结果。恢复为新提案，不删除历史。
 
## 风险和迁移
这是 alpha，不是安全审计后的生产版本。OAuth 库/SDK版本、Cloudflare D1/KV 绑定、端到端会话、浏览器、真实 MCP 和跨站 adapter 均需实测。需要补齐限流、保留期/清理、备份恢复、部署锁定依赖、安全审计、撤销后在途请求策略（撤销会拒绝后续连接，不能撤回已经领取的命令）、独立站点本地维护接口，以及每种业务数据的 schema 和脱敏策略。Hub 不代理原站登录 cookie。Cloudflare 运行环境、ChatGPT Sites 网络及 Secret 能力未经验证。禁止因接入困难将私人网站公开。现有网站迁移顺序：独立 fixture → 移民规划的非敏感政策条目适配 → USYD Radar 公开活动 → 其余站点；USYD Canvas 保留现有独立只读插件、身份/数据隔离，最后单独评估。任何真实数据写入、定时任务和发布必须按原有审批约定。

## 独立测试站

已附独立 Worker/D1 fixture，位于 [fixture/README.md](fixture/README.md)。仅使用合成数据，具有自身持久化配置与独立管理令牌，手动同步后可从首页验证修改。不表示已完成真实 Cloudflare 部署。

## 本地 HTTP 验收

在 CI 的隔离 D1 中注入合成 owner session，启动本地 Worker，使用真实 HTTP 端点检查注册、CSRF、跨站拒绝、审批、回执、重放、恢复、撤销及未认证 MCP 拒绝。不使用真实 GitHub 身份或生产凭证；真实 GitHub OAuth 和独立 ChatGPT 插件连接仍然是上线门槛。

## 安全加固（待 CI 与真实部署复验）

新增数据库迁移 0002：合法提案状态转换、版本与撤销检查；已认证站点/管理员/AI 主体每分钟 120 次固定窗口限流；管理员可手动清理过期会话、登录/授权流程及旧限流计数（不删除审计和业务数据）；MCP 请求体限制与站点轮询凭证再验证。该限流不覆盖 OAuth Provider 内部公开注册/令牌端点，正式上线前仍需平台边缘防滥用策略、安全审查和备份演练。已领取的命令不能因撤销而保证撤回。没有设置后台定时任务。

Cloudflare OAuth Provider 1.x 要求显式 canonical resource。配置 `HUB_ORIGIN` 后，Worker 只接受该 origin，MCP 资源为其 `/mcp`；HTTP 只允许 loopback 测试地址。参考 https://developers.cloudflare.com/changelog/post/2026-10-01-workers-oauth-provider-1x/ 。缺少配置会返回 503，而不是 Worker 启动时崩溃。需真实 OAuth 验收。

## OAuth 本地集成验收

隔离环境中使用合成管理员会话，真实 OAuth 动态客户端注册、PKCE、同意、令牌交换及 MCP JSON-RPC 调用；不触碰真实 GitHub 登录或生产令牌。实际第三方客户端及真实 GitHub 身份仍需部署后测试。资源处理程序同时校验 OAuth token scope 和 D1 的逐站授权。

## 独立发布门槛

[发布与恢复操作手册](RELEASE.md) 将隔离部署、真实登录、测试站、OAuth、恢复演练与现有网站接入明确分开。平台允许零个真实站点；现有网站是否接入由所有者另行选择。接入不是平台完成的前提。

## 通用资源集合（试验版，待回归测试）

注册站点时所有者可明确声明最多4个非敏感小型记录集合（最多25条/集合，整个快照最多8KB），字段限定文本、布尔、数字、HTTPS URL；禁止任意对象、脚本、数据库查询或任意网络访问。定义注册后固定，站点 SDK 使用相同 `resourceSchema`，先验证定义，再执行获批的版本化变更。新增统一 MCP 工具 `list_site_capabilities`、`read_site_resource`、`propose_site_resource_change`。现有基础工具保留；新增工具不要求每个网站独立安装 MCP。授权仍按站点隔离，资源只能是已获批准的非敏感数据；这不是任意业务数据库接口，不能接入私密文件和个人身份记录。

示例：`[{"id":"policies","label":"Public policies","max_records":10,"fields":[{"name":"headline","type":"text"},{"name":"verified","type":"boolean"}]}]`。每条记录必须有独立 `id`；站点快照在 `resources.policies` 中保存这些字段。SDK 适配需要真实持久化、领域校验及主机权限支持。

依赖已锁定；Zod 升级至 4.6.7 后的 CI 扫描报告为 0 已知漏洞（[证据](https://github.com/Dreaminmaster/site-control/actions/runs/45408437201)）。后续采用 npm ci 与强制高危审核；不表示独立安全审核已完成。

新增隔离联调：真实 Hub HTTP + 独立 fixture handler/SDK + 磁盘 SQLite，重启后核对持久化及回滚。新增 Wrangler D1 本地导出/导入恢复演练；恢复副本默认撤销授权、取消未完成变更、保留原库。公开 OAuth 路径加入固定窗口全局限流及前置请求体限制；此方案仍需云端边缘防滥用与真实部署验收。

`npm run prepare:staging -- sc-test-<unique-name>` 可生成独立测试环境配置（仅本地，不自动部署），避免沿用现有资源 ID、路由或环境变量。撤销站点会同时取消未完成提案，重新轮换令牌不能重新激活旧任务；已被领取的在途命令仍需人工核对实际站点版本。
