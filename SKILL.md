---
name: site-control
description: Build, deploy, upgrade or maintain websites, ChatGPT Sites, dashboards and web apps with durable owner control, source handoff, admin workspace, AI/MCP cooperation, permissions, diagnostics and version management. Use whenever creating or extending a persistent website or multiple websites; skip throwaway HTML previews, mockups and unrelated code tasks unless explicitly requested. 网站创建、部署、管理、升级、AI协作与接管。
---

# Site Control / 网站控制与协作

## Mission

Deliver a working website AND its maintainable control plane. The owner must be able to manage it independently of the original agent session. Never claim platform privileges, deployment, external connectivity or persistence that has not been verified.

## Workflow

1. **Discover:** inspect existing source, deployment, hosting capabilities, authentication, storage, integrations, tool contracts and ownership. For updates identify the original project, URL, plugin and storage bindings. For multiple sites inventory each independently; use explicit site IDs, environments and ownership. Never assume a Site link or project ID grants authorization.
2. **Choose scope:** use the smallest tier that satisfies the request (read `references/architecture.md`). New persistent apps default to Managed; sensitive or agent-integrated apps default to Collaborative. Simple static sites use a lightweight source/config workflow; do not invent backend or auth on static hosting. Report downgrade reasons. Preserve the user's visual brief and primary functionality.
3. **Preserve:** before modifying a live site record baseline behavior and versions; back up permitted app configuration and data separately using supported mechanisms. Keep existing URLs, project identity, plugins, tool signatures, sessions, secrets and data unless explicitly approved. No reset or destructive migration as a shortcut. Use fixture data for development.
4. **Source handoff:** produce editable source and project-specific AGENTS.md, README, deployment/runbook, tests and change history. Record hosting association only through supported configuration. Use an explicitly authorized private repository for private projects; verify remote identity and visibility before pushing; do not create/push a repository without authorization. Never commit secrets, real user data, raw logs, browser sessions or DB snapshots. Export source through the supported owner workflow when required.
5. **Control workspace:** create a responsive owner-only /admin or existing equivalent with actual working features selected from architecture reference. Use a shared server-side service layer behind UI/API/MCP. Keep runtime configuration typed, validated, versioned and separate from executable code. No arbitrary HTML/JS execution or editing backend source from admin. Configuration UI must show what requires rebuild/release. If backend unavailable, deliver editable configuration and local management workflow instead, clearly marked.
6. **Agent access:** default to an isolated maintenance interface with read-only sanitized diagnostics and proposal creation. Keep business data and maintenance namespaces and permissions separate. Implement owner-managed, scoped, expiring, revocable per-agent credentials where supported; verify identity on server. External MCP, REST or WebMCP must be truly supported and authenticated; never expose a public unauthenticated management endpoint. Read `references/security-and-tools.md` before implementation. No shell, arbitrary SQL, arbitrary URL fetch, raw credential export or self-granted privileges.
7. **Change workflow:** agent proposes config or code change; show diff, validate, preview, test; owner approves high-risk changes and production releases. Apply approved changes atomically with revision checks and idempotency; retain audit trail and known-good rollback. Source changes go through Git branches/PR and supported platform deployment. Do not let code-editing agents automatically inherit production secrets or deployment access. Separate code rollback, config rollback and data restoration.
8. **Multi-site:** when building several sites, use one consistent control interface, per-site isolated credentials/config/storage, and an optional owner hub only when useful. A shared hub links to admin, shows sanitized health/release status, and supports scoped proposals. Never pool third-party login cookies or grant cross-site access implicitly. No extra hosted service unless justified and approved where required.
9. **Verify and deliver:** run relevant build, lint, regression and security tests; exercise actual UI and MCP/API interactions with test data, then authorized bounded smoke tests. Read `references/acceptance.md`. Verify persistence across reload, denied permissions, stale revision, revoke, audit, rollback, live-site identity, and actual plugin tools after release. Mark untested and blocked checks honestly; don't make hollow UI or mock responses look live. Follow the user's approved deployment scope.

## Output contract

Return actual implemented vs deferred features; site/project ID (non-secret), URL, repository/commit, admin URL, enabled tools and permission scopes, how the owner connects each agent, current version, test evidence, limits, cost/hosting trade-offs and rollback instructions. Include owner actions needed for installation, login, export, authorization, publish, or approval. Provide project-local site-control.manifest.json from `assets/manifest.example.json` with verified values, never credentials. Update docs as work changes. Use Chinese when requested.

## Platform rule: ChatGPT Sites

Read `references/sites.md` for this host. Do not imply the original Codex session is the sole editor, or that third-party agents can control OpenAI platform APIs. Runtime app management is distinct from native Site editing and publishing. Maintain the same Site unless asked otherwise.
