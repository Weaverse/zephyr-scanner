# Open Questions

Append-only log. Coding agent: when blocked, add an entry here instead of guessing.

## Format

```md
### YYYY-MM-DD — <short title>
**Context:** <what you were doing>
**Blocker:** <what's unclear>
**Proposed answer:** <your best guess, NOT yet applied>
**Decided by:** <pending: Boss / Echo / Samantha / Roxie>
```

---

## Known open items at plan creation

### 2026-05-21 — Cloudflare account credentials
**Context:** CI/CD deploy workflow needs `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID`.
**Blocker:** Coding agent cannot create these.
**Proposed answer:** Boss creates Cloudflare account, generates API token with `Workers Scripts:Edit` + `Pages:Edit` + `D1:Edit` + `KV:Edit` + `R2:Edit` scopes, adds both as GitHub secrets.
**Decided by:** Boss.

### 2026-05-21 — Spec files for commerce protocols
**Context:** Day 4 + Day 5 checks (UCP, MCP, ACP, x402, WebMCP, MPP) need protocol details.
**Blocker:** `docs/specs/{ucp,acp,mpp,x402,webmcp,mcp}.md` not yet written.
**Proposed answer:** Roxie populates all 6 spec files before Day 4 starts. If any are still TODO when the coding agent reaches that check, skip + document here.
**Decided by:** Roxie.

### 2026-05-21 — Domain DNS
**Context:** `zephyr.build` + `weaverse.ai` need to resolve to Cloudflare.
**Blocker:** Coding agent cannot manage DNS.
**Proposed answer:** Boss adds nameservers / CNAMEs in domain registrar.
**Decided by:** Boss.

### 2026-05-21 — Rate limit threshold
**Context:** Default 10 scans/IP/hour. Risk: too low (annoys real users) or too high (gets abused).
**Proposed answer:** Start at 10/hr, monitor first week, adjust.
**Decided by:** Boss.

### 2026-05-21 — Wrangler bindings placeholders
**Context:** `apps/api/wrangler.toml` now declares KV (`SCANS`), R2 (`REPORTS`), and D1
(`DB`) bindings with `TODO_FILL_IN_*` placeholder IDs. Local `wrangler dev` runs without
them (built-in emulators); production deploy will fail until they're replaced.
**Proposed answer:** Boss runs the wrangler create commands in `docs/deployment.md`
(`wrangler kv:namespace create SCANS`, `wrangler r2 bucket create zephyr-reports`,
`wrangler d1 create zephyr`) and pastes the IDs into `wrangler.toml`. Then
`wrangler d1 execute zephyr --file=./apps/api/migrations/0001_init.sql` to bootstrap the
leaderboard schema.
**Decided by:** Boss.

### 2026-05-21 — Protocol specs populated best-effort
**Context:** All 6 `docs/specs/*.md` briefs were populated from public research while
Roxie was unavailable. Confidence labels: x402 high, MCP+UCP+ACP medium, WebMCP low,
MPP informational only.
**Proposed answer:** Roxie reviews each brief, corrects field names / well-known URLs
where the canonical spec differs, and updates the corresponding check + tests.
**Decided by:** Roxie.

### 2026-05-21 — Spec review pass (closes the above for UCP, MCP, x402; ACP + WebMCP open)
**Context:** Verified each brief against canonical sources + live implementations
where available.
- **UCP** ✅ confirmed against `allbirds.com` + `gymshark.com`; brief bumped to v1 high confidence.
- **MCP card** ✅ verified live against `developers.cloudflare.com`; SEP-2127 now
  ships `/schemas/v1/server-card.schema.json` (versioned, not draft path);
  scoring refined to reward `version` + `title` instead of `capabilities`.
- **ACP** 🟡 OpenAPI confirms `API-Version` header required; `redirect: "follow"`
  fix prevents false positives from canonical-host 301s. **Open:** no public
  ACP merchant found — Stripe-routed integrations don't expose
  `/checkout_sessions` on the brand origin.
- **WebMCP** 🟡 confirmed `navigator.modelContext.registerTool` JS surface from
  the W3C explainer. **Open:** no live sites verified; markers `WebMCP-Available`
  header + `<meta name=webmcp>` are Zephyr's own conventions, may need revision
  when the WG codifies standards.
- **x402** ✅ already high confidence; no change.
- **MPP** ℹ️ informational only; no separate check ships.
**Decided by:** Echo (this pass). Outstanding: Roxie to confirm ACP / WebMCP
conventions as adoption picks up.
