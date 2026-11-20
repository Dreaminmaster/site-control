# Architecture and scope

| Tier | Typical use | Required implementation |
|---|---|---|
| Lightweight | Static portfolio, document or landing page | Editable source, typed or documented content config, Git/run instructions, host-native preview and deployment; no fake admin/MCP |
| Managed | Persistent private/public web app or dashboard | Lightweight + authenticated owner workspace, validated config, revision history, audit, operational health and backup procedures; optional safe MCP if supported |
| Collaborative | Multi-agent, integrated or sensitive app | Managed + isolated maintenance MCP or API, independent scoped identities, proposal/approval, regression tests, revocation and incident procedures |

Choose minimum viable tier and show why; budgets and platform constraints matter. If requested features are unsupported, implement the supported subset and document alternatives. Never bypass host security. No new hosting cost without authorization.

## Owner workspace modules
- Overview: actual release ID, health, availability, quota if provider reports it, last successful check, evidence and stale/unknown states.
- Content and appearance: mobile/desktop preview, schema-constrained text, themes, composition, allowed components, accessibility. Save draft, compare, approve/apply, show history. No executable markup injection.
- Integrations: provider name, status, capability, last check, safe setup links; never reveal tokens/cookies or automatically authorize providers. Diagnostics must distinguish quota, authorization, connectivity and data coverage.
- Agents: identity, site scope, tool permissions, expiry, revocation, last activity. Owner-only issuance and permissions. Display newly issued secret once only via secure flow, store hashed or managed credential reference.
- Change inbox: description, exact diff, expected revision, author, risk, test result, preview, owner decision. High-risk items cannot be approved by requester. Track pending/approved/applied/rejected/failed independently.
- Versions & recovery: config revisions, history, source commit/PR links, allowed restore operations. Clarify which actions require official release; separate code, config, data and uploads.
- Logs: structured redacted events with actor/action/resource/sanitized outcome/revision/time, filtering and retention. No raw provider bodies or private PII by default.
- Multi-site optional: central registry with explicit site IDs and links, status aggregation only from approved endpoints, tenant isolation and no shared master credential. Do not force a new hub for one site.

## Service design
Use host-native identity and storage when actually available. Each admin/API/MCP operation calls the same domain authorization and validation logic. Bind identity, site and environment on server. Scope every query. Use typed configs and allowlisted mutations, transactional versioning or supported CAS. Separate secret store from Git, config and logs. Public website remains unchanged unless changes are requested.

For a static-only host, generate configuration docs, editable source and preview workflow; if dynamic admin is required, propose a supported backend separately. Do not imitate authentication with localStorage or hidden URLs.
