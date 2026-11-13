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
pnpm test:commerce
pnpm lint
pnpm typecheck
pnpm build
```

Product names, categories, prices and local product photography are maintained in `src/data/products.ts` and `public/products/`.

Design research and visual decisions are documented in [`docs/design-research.md`](docs/design-research.md).

## Checkout

Stripe setup, rollout order, variables, webhook events and manual pickup operations are documented in [docs/stripe-checkout.md](docs/stripe-checkout.md). Never commit credentials.
