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
