# Site Control Hub — release runbook

This is an independent platform. Existing websites are not migration prerequisites. Never add their URLs, credentials, user data or account IDs to this public repository.

## Stage A — isolated deployment (no existing sites)

Prerequisites: owner-authorized Cloudflare account, Node.js 22+, a new GitHub OAuth App, Wrangler CLI. No paid upgrades are required by this runbook; stop if the provider requires a purchase. Use new, dedicated D1 and KV resources. Do not reuse any existing website database.

1. Check out the reviewed development commit. From hub/: npm ci --ignore-scripts, npm audit --audit-level=high, npm run check, npm run build. Review the committed dependency lock and record the exact release commit.
2. Run npx wrangler login in the owner's authenticated terminal. Use an isolated local copy of the Wrangler config; deploy once without identity secrets to provision fresh Worker, D1 and KV. The unconfigured service must fail closed with 503. Wrangler supports resource provisioning during deploy; verify newly allocated IDs and do not reuse existing resources. Obtain its exact HTTPS workers.dev origin. Set HUB_ORIGIN in deployment vars, not in source. Verify all bindings are isolated.
3. Create a GitHub OAuth App for the isolated deployment with callback <HUB_ORIGIN>/callback. Configure GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET and OWNER_GITHUB_ID via Worker secrets. Never paste secrets into chat, commit files, logs or public issues. The numeric owner ID is checked by the server.
4. Apply D1 migrations with --remote to the newly provisioned isolated DB, then deploy the configured Worker again. Confirm /health configured is true; unauthenticated /admin must show login, mutations must deny unauthenticated access, and /mcp must challenge with correct resource metadata. Check security headers.
5. Owner logs in with the real GitHub identity. A second non-owner identity must be denied; if unavailable, document the missing real identity test. Test CSRF, logout, expired sessions and revoked grants. Record evidence without tokens or personal details.
6. Deploy the separate fixture Worker, register it and install its site token securely. Verify the fixture's own D1 is independent. Run its sync endpoint manually; no scheduled task. Create a reversible change, approve, observe the actual fixture configuration and matching receipt, replay, test revocation, restore old values through a new approved proposal.
7. Use an independent MCP client with OAuth to list authorized fixture sites, submit a proposal, test denied cross-site access, revoke access. Connect the actual ChatGPT plugin only through the supported installation flow, verify one connection can acquire newly approved fixture-site permissions. Do not confuse a local synthetic test with real ChatGPT access.
8. Review rate limiting at the edge, token-endpoint abuse protection, least privilege, dependency audit, recovery, log redaction and privacy. Keep the test service isolated if any gate fails.

## Backup and recovery

Use an encrypted, access-controlled storage location outside Git; exported D1 SQL contains sensitive state including hashed credentials and authorization metadata. Do not export OAuth KV token material into chat or logs. Before production, use synthetic data to rehearse:
- D1 export using wrangler d1 export DB --remote --output <private-local-file>.
- Restore into a NEW isolated D1 only, never over a live DB; use the supported Wrangler import/execute flow and verify migrations, counts, proposal states and audit consistency.
- Revoke or rotate site credentials and reauthorize AI clients during disaster recovery; do not restore old access grants as valid by default.
- Confirm configuration changes roll back by new approved proposals, while code rollback uses the previously recorded deployment commit. Database recovery is separate from both.
- Validate successful restoration on the fixture, record version and test evidence. Delete temporary export securely according to the owner's retention policy.

No automated production backups or scheduled synchronization are enabled by this release. Do not claim recovery is proven until the drill is complete.

## Completion gate (before any existing-site onboarding)

The platform may be independently usable with zero connected real websites. Report the live URL, current commit, real authentication and fixture tests, security review, and recovery drill. Stop at this boundary: **existing websites are opt-in**, and the owner must decide which, if any, will connect. Leaving websites completely independent is supported. Do not change existing site permissions, data, URLs or connectors.

### Local recovery evidence

`test/recovery-smoke.mjs` exports synthetic local D1 state, imports into a fresh temporary local persistence directory, checks full site configuration, proposal history and audit counts, then revokes all credentials and cancels outstanding changes in the restored copy. The original DB must remain unchanged. The procedure is not a production restore and never touches remote state. On actual disaster recovery, use a new database and new OAuth KV, rotate site tokens, then reauthorize each client deliberately.

### Prepare isolated staging configuration

From `hub/`, run `npm run prepare:staging -- sc-test-<unique-name>`. This only generates two ignored local Wrangler configuration files and refuses to overwrite an existing file. Verify the account and confirm these names are unused, then deploy using `npx wrangler deploy --config wrangler.staging.local.jsonc`; use that exact config for subsequent migrations and secrets. Use `wrangler.fixture.staging.local.jsonc` for the separate fixture. The generated files do not copy production routes, resource IDs or environment values. This generator has no network access and cannot perform deployment by itself. See [Cloudflare automatic provisioning](https://developers.cloudflare.com/workers/wrangler/configuration/#automatic-provisioning).

The initial MCP authorization may contain zero sites. Add the fixture's grant explicitly in the owner workspace after initial connection; revoking a site removes its existing agent grants, and reactivation requires explicit new authorization.

### Post-deployment preflight

Run `npm run verify:deployment -- https://YOUR-HUB.workers.dev` against your own authorized Hub. No credentials are required. It checks D1 and KV readiness, anonymous owner login, security headers, OAuth discovery and unauthenticated MCP refusal. It does not approve changes, issue tokens, or run a real login. A passing report is only a preflight; do not mark production acceptance complete without the remaining authenticated tests. `/health` returns 503 unless configuration and required database columns/KV reads are ready.

Chinese owner quickstart: [DEPLOY.zh-CN.md](DEPLOY.zh-CN.md). Use the staging configs and never reuse an existing resource without explicit authorization.
