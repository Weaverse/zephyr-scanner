# Contributing

Adding a new check?

1. Create `packages/checks/src/your-check.ts` exporting a `Check`.
2. Register it in `packages/checks/src/index.ts`.
3. Add a row to `docs/CHECKS.md`.
4. Open a PR with a sample passing + failing response in the description.
