# Site Control Hub · 首次部署（仅独立测试环境）

本手册不会接入、迁移或修改任何现有网站。初期只使用独立 Hub、独立测试站及合成数据。当前尚无云端部署验收证据。免费额度不等于无限使用，若页面提示需要升级或付费，停止操作。不要向聊天、GitHub 或任何公开日志提供密钥。

## 1. 一次性 Cloudflare 授权

在你拥有的电脑或已登录的 Codex 终端使用 Node.js 22+：

    git clone -b feature/site-control-hub-v2 https://github.com/Dreaminmaster/site-control.git
    cd site-control/hub
    npm ci --ignore-scripts
    npm audit --audit-level=high
    npm run check
    npm run build
    npx wrangler login
    npx wrangler whoami

登录会打开 Cloudflare 官方授权网页。确认正确账号及权限。若使用既有本地仓库，请先确认当前分支与代码提交，不要覆盖未提交的工作。

## 2. 创建专用测试资源

先在 Cloudflare 控制台检查下面的示例名称是否已使用；如有重名，换一个新的 sc-test- 前缀名称。命令只生成本地配置：

    npm run prepare:staging -- sc-test-hub-demo

文件 wrangler.staging.local.jsonc 和 wrangler.fixture.staging.local.jsonc 不纳入 Git，且不复用已有资源 ID。人工检查名称、账户和路由后，再执行：

    npx wrangler deploy --config wrangler.staging.local.jsonc

Wrangler 支持自动创建尚未配置 ID 的 D1/KV。确认确实创建了新资源、记录其 ID（仅保留在本地配置），并记录部署返回的 HTTPS origin。若工具提出复用其他网站的资源，拒绝并停止。首次部署还没有认证配置，应无法访问管理功能。

## 3. 仅自己能登录的 GitHub OAuth

打开 https://github.com/settings/developers ，创建专用于该测试 Hub 的 OAuth App。Homepage URL 填步骤 2 返回的 HTTPS origin，Authorization callback URL 填相同 origin 加 /callback。Client secret 仅由你在本地密钥输入提示中填写。OWNER_GITHUB_ID 必须使用 GitHub 固定数字用户 ID，可在本机已登录的 gh CLI 通过 gh api user --jq .id 取得；不要用用户名代替。

    npx wrangler secret put HUB_ORIGIN --config wrangler.staging.local.jsonc
    npx wrangler secret put GITHUB_CLIENT_ID --config wrangler.staging.local.jsonc
    npx wrangler secret put GITHUB_CLIENT_SECRET --config wrangler.staging.local.jsonc
    npx wrangler secret put OWNER_GITHUB_ID --config wrangler.staging.local.jsonc
    npx wrangler d1 migrations apply DB --remote --config wrangler.staging.local.jsonc
    npx wrangler deploy --config wrangler.staging.local.jsonc

四次 secret put 会分别提示输入值。HUB_ORIGIN 仅填真实 HTTPS origin，不附带 /admin 或 /mcp。确认本地配置中的 D1/KV ID 对应本次新建资源。不要提交本地配置。

## 4. 检查平台本身

将下面的占位 URL 换成真实部署地址：

    npm run verify:deployment -- https://YOUR-HUB.workers.dev

预检只验证健康检查、匿名登录页、安全头、OAuth 资源发现、未授权 MCP 拒绝，不代表完成正式上线。再打开 /admin，使用指定 GitHub 账号实际登录，确认非所有者不能登录；打开五个后台页面。安装统一 MCP 时允许暂不选择网站，空授权必须无法读取或修改任何网站。

## 5. 独立测试站（不是你的既有站）

按照 fixture/README.md 及 RELEASE.md 建立独立测试站，使用 wrangler.fixture.staging.local.jsonc，切勿使用正式网站数据。实际测试批准修改、持久化、回滚、撤销、重连、只读权限、单个 MCP 后续增减网站，以及云端备份恢复和边缘防滥用。

## 6. 验收后停止

记录真实 Hub 地址、代码版本、实际测试证据和剩余限制。**到此为止。现有网站接入由你之后逐个决定，不属于本项目的完成前提。** 不需要购买域名；不需要共享私人网站的密码或 cookies；不设置计划任务。
