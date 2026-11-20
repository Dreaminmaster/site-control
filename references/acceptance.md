# Acceptance matrix

For each row record PASS, FAIL, BLOCKED or N/A with evidence, exact environment and version. Passing a fixture test does not prove production availability.

| Check | Evidence expected |
|---|---|
| Existing identity | Same authorized site URL/project/plugin/storage; no unexpected reset |
| Original functionality | Baseline and regression results, including existing tool contracts |
| Owner control | Real authenticated admin access; unauthorized visitor gets rejection |
| Runtime edits | Draft, diff, approve/apply, reload persistence and rollback |
| Concurrency | Stale revision rejected, duplicate request safe |
| Role boundaries | Wrong tenant, missing scope, expired/revoked key rejected; agent cannot self-approve |
| Secret handling | Repo and output scan, logs redacted, no secrets in client bundle |
| Agent connection | Actual authorized handshake/tool list and sample operation; unsupported labeled |
| WebMCP | Registered browser tool verified in supported client if requested |
| Diagnostics | Honest error, quota and unknown/stale states; bounded probes |
| Source recovery | Verified source export and readme, no sensitive files, authorized repo/commit if available |
| Release | Supported preview/build/test and owner-approved release; live version verified if released |
| Recovery | Config rollback tested; code/data/upload restore limitations documented |
| UX | Mobile/desktop, keyboard and usable empty/error/loading states |
| Multiple sites | Site IDs, isolation, scoped hub access; cross-site request denied |

## Trigger examples
Should activate: “创建一个个人学习网站”; “升级现有 Canvas Site 并开放 AI 维护”; “build three dashboards with admin access”; “deploy a persistent trip planner”; “add MCP maintenance to my existing web app”.
Should not activate by default: “fix this CSS typo in an unrelated snippet”, “make a disposable HTML illustration”, “translate this email”. Explicit invocation overrides default scope, not permissions.
