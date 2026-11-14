# KUEST

Commercial website for KUEST electric bikes and electric scooters in Miami / South Florida.

## Run locally

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm check:client-secrets
```

Product names, categories, prices and local product photography are maintained in `src/data/products.ts` and `public/products/`.

Design research and visual decisions are documented in [`docs/design-research.md`](docs/design-research.md).

Stripe hosted Checkout, restricted-key permissions, product setup, webhook configuration and the Vercel launch checklist for Tomás are documented in [`docs/stripe-checkout.md`](docs/stripe-checkout.md). Online payments are disabled by default. No Stripe credentials are needed to build or run the unit tests.

The [November 13 review](docs/stripe-review-2026-11-13.md) records the newer, conflicting implementation on `origin/main`, the public checkout observation, and a tested correction patch for that version. This branch's disabled default does not establish the current production state.
