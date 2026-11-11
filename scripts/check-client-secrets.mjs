import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";

const root = ".next/static";
const forbidden = /(?:\b(?:rk|sk)_(?:live|test)_[a-zA-Z0-9]{16,}|\bwhsec_[a-zA-Z0-9]{16,}|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET)/;
let checked = 0;
const failures = [];

async function scan(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await scan(path);
    else if (/\.(?:js|map|json)$/.test(entry.name)) {
      checked++;
      if (forbidden.test(await readFile(path, "utf8"))) failures.push(path);
    }
  }
}

try {
  await scan(root);
  if (!checked) throw new Error("No browser bundles found. Run pnpm build first.");
  if (failures.length) {
    // Report paths only; never print matching values.
    console.error("Potential server secrets in browser artifacts:", failures);
    process.exitCode = 1;
  } else {
    console.log(`Checked ${checked} browser artifacts: no Stripe server keys or server environment references found.`);
  }
} catch {
  console.error("Unable to scan browser artifacts. Run pnpm build first.");
  process.exitCode = 1;
}
