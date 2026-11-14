# review: compare original Stripe checkout with current main

Base: `main` · Head: `feature/stripe-checkout` · Suggested status: **Draft**

The original branch adds Stripe-hosted Checkout for one catalog model, server-side price validation, signed webhooks, durable verification metadata and disabled-by-default payments. It contains commits `f72f998` and `baa1002`.

Current main at `2675bcd` already implements a different Checkout flow, introduced by `59a0d28`: color selection, exclusive pickup taxes, explicit Price environment variables, dynamic payment methods and a different live-payment flag. The original histories diverge by two implementation commits on each side and have conflicts in twelve files. Preserve the newer framework version (16.4.6), colors, pickup tax location and existing Session metadata compatibility during reconciliation.

The [review report](https://github.com/Broco-Solutions/kuest-web/blob/feature/stripe-checkout/docs/stripe-review-2026-11-13.md) includes the differences, concrete Vercel/Stripe sandbox instructions and a separate patch against `2675bcd`. The patch fixes three reproduced security regressions and two audited development dependency advisories. Its runtime changes are an attachment for a fresh branch from current main; they are not applied to this historical feature branch.

Validation:

- Original feature: 18 tests, TypeScript, ESLint, build, browser secret scan, local HTTP smoke and audit passed; zero known vulnerabilities.
- Current main without corrections: 19 tests, ESLint and build passed; one low and one moderate development dependency advisory. Three added regression tests fail.
- Current main with the attached corrections: 22 tests, TypeScript, ESLint, Next.js 16.4.6 build, browser secret scan and local HTTP smoke passed; zero known vulnerabilities. Patch application checked against the main baseline.

The public storefront displays “Buy now”; an invalid checkout request returns JSON 400 rather than disabled-state 503. The deployment's sandbox/live mode has not been verified. Tomás must check Production settings before relying on the earlier assumption that payments remain disabled.

No merge, production deployment, payment activation or real charge was performed. Account-specific sandbox end-to-end tests, effective restricted-key permissions, webhook delivery and visual QA remain pending. This is prepared PR text; it does not establish that a PR exists or has been opened.
