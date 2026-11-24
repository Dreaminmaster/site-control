# 独立测试站（不接真实网站）

本目录提供一个独立 Worker 和独立 D1 数据库。它不保存任何真实用户数据。公开首页仅呈现合成配置；后台使用与站点令牌不同的管理令牌。无自动计划任务、无第三方账号登录数据。

1. 在 hub 的 /admin 注册 id=test-site，站点地址填写部署后真实测试站 HTTPS 地址。
2. 进入 hub 目录，运行 npx wrangler deploy --config wrangler.fixture.jsonc（自动创建独立 D1）；再运行 npx wrangler d1 migrations apply FIXTURE_DB --remote --config wrangler.fixture.jsonc。
3. 使用 npx wrangler secret put FIXTURE_ADMIN_TOKEN --config wrangler.fixture.jsonc，输入本地随机生成的至少32字符秘密。独立设置 HUB_URL、SITE_TOKEN；不要将它们写入仓库、浏览器或聊天。
4. 通过 HTTPS Authorization: Bearer <fixture admin token> 访问测试站 /admin（GET），/admin/sync（POST）执行一次同步，/admin/config（POST）只修改假数据。无需计划任务。
5. 在 Hub 确认首次心跳，创建提案，批准，在 fixture 手动同步，检查站点首页实际变化和 Hub applied 状态；再次同步、测试拒绝未授权和错误版本，再做恢复提案。
6. 撤销测试站凭证并确认新请求失败；验证旧数据仍可独立读取；测试 MCP 连接一次后授权新的假站点。真实站点接入前必须端到端通过。

请勿直接在命令行历史中写实际令牌。使用自己 shell 的安全输入或临时进程环境。生产前增加限流、安全审核和完整运维流程。
