# MPP — Protocol Brief

> **Status:** 🟡 informational — MPP is **Machine Payments Protocol** (Tempo + Stripe),
> not "Merchant Payment Protocol" as originally listed in PLAN.md. The two domains overlap
> with x402 (the dedicated commerce check is #7 `x402-headers`). Treat MPP coverage as
> a side-effect of x402 detection for now.
> **Confidence:** low — mpp.dev is primarily SDK/implementation docs; no public discovery
> spec exposed yet.

## What is it?

The Machine Payments Protocol (MPP), co-developed by Tempo and Stripe, defines payment flows
between machines (agents, services, infrastructure). It overlaps with x402 in motivation
but targets a broader machine-to-machine surface, not just HTTP 402. SDKs exist in
TypeScript, Python, Rust, Go, and Ruby; no public well-known endpoint is currently codified
for merchant advertising.

## What does Zephyr check?

**Nothing as a standalone check yet.** PLAN.md originally allocated check #7 to "x402 payment
headers" and we keep that mapping. If/when MPP publishes a merchant-facing discovery URL,
add a dedicated check and re-allocate.

Tentative signals (not yet implemented):
- `<link rel="machine-payments">` in homepage head
- `/.well-known/mpp` JSON manifest

## Pass / fail criteria

N/A — no check ships against this protocol in v1. x402 (check #7) covers the closest
overlapping surface.

## References

- Site: https://mpp.dev
- Co-developers: Tempo, Stripe (mentioned in mpp.dev docs)
