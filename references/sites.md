# ChatGPT Sites host adapter

Official references (recheck before implementation):
- https://help.openai.com/en/articles/20001339-creating-and-using-chatgpt-sites
- https://help.openai.com/en/articles/20001547-hosting-a-plugin-with-chatgpt-sites
- https://learn.chatgpt.com/docs/sites
- https://learn.chatgpt.com/docs/webmcp

Use original Site via Sites sidebar/edit entry. Owner can request source export through Codex. Preserve verified project association files where present; never generate a guessed project ID or use it as a credential. No standalone third-party native publishing API assumed. Use official preview and publish flow in supported ChatGPT surfaces. A native Site editor has broad live data/code capabilities; do not assign this role as a replacement for narrow maintenance scopes. Co-editing depends on workspace eligibility. Site sharing and plugin sharing/installation/authorization are distinct; personal accounts may have invitation limits. Do not make a private Site public just to connect a third-party agent.

For MCP: add or extend existing server using supported Sites workflow; preserve existing tool names, parameters, semantics and plugin identity where supported. Review tools with sample data, owner publishes, then confirm updated plugin and do authorized bounded smoke test. If external client addressing/auth isn't supported, report that and offer Git or official UI workflow; don't claim a URL works without a connection test. Code rollback and database/upload recovery are separate. Inspect storage state before retrying a failed publishing attempt. Use supported separate exports/restoration procedure; no promise of native full backup. Check host limits for secrets, storage, browser runs and runtime capabilities. Keep sensitive login sessions in existing approved storage, never export to repository or new agent.

Example for an existing private university connector: keep learning tools read-only, retain existing approved narrowly scoped exceptions; add separate maintenance tools without credential disclosure; preserve API/browser and independent provider sessions. Only use mock course data in fixtures. Do not automatically allow new agents to read grades, Inbox or provider data. Use actual source and existing tool schema as baseline, not example tool names.
