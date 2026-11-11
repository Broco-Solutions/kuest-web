# feat: integrate secure Stripe hosted Checkout

Base: `main` · Head: `feature/stripe-checkout`

KUEST currently presents nine priced models without a purchase flow. This change adds direct purchase of one catalog model through Stripe-hosted Checkout while preserving the existing gallery and storefront. Payments stay disabled until Tomás confirms the commercial configuration and enables the Vercel flag.

- Validate product, one-unit quantity, USD price, Stripe Product metadata and active Price on the server; reject client-supplied amounts or redirects.
- Support restricted API keys and keep all secrets behind `server-only`. Block live keys outside Vercel Production. No publishable key or Stripe.js required.
- Add success/cancel/error states backed by server-side Stripe status. Verify signed webhooks, tolerate duplicate/out-of-order events and durably mark verified payments in Stripe.
- Keep fulfillment manual in Stripe with explicit showroom pickup only. No shipping rates, inventory system, variants or product prices were invented.
- Document minimum permissions, matching catalog lookup keys, tax/pickup requirements, webhook setup, sandbox QA and Vercel activation in [the handoff guide](stripe-checkout.md).

Validation: `pnpm typecheck`, `pnpm lint`, `pnpm test` (18 tests, mocked Stripe), `pnpm build`, `pnpm check:client-secrets`, and local HTTP smoke checks. No real charges, production deployment, secret retrieval or automatic merge.

Before activation, Tomás must configure sandbox/live Products and Prices, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_MODE`, `SITE_URL`, explicit fulfillment/tax settings and the webhook. Confirm checkout permissions with an equivalent restricted test key, complete sandbox end-to-end/visual QA, confirm policies, stock and taxes, configure abuse protection, then enable `STRIPE_CHECKOUT_ENABLED` through a reviewed deployment. These account-specific checks are pending; local checks do not validate the supplied live key or the merchant's Stripe settings.
