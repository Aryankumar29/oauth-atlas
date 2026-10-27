// Usage: npx tsx scripts/capture-screenshots.ts [base URL, default https://oauth-atlas.vercel.app]
// Captures the README screenshots into docs/screenshots/. Public pages only: no sign-ins, no secrets.
import { chromium } from "@playwright/test";

const SHOTS: { file: string; path: string; full?: boolean; waitFor?: string }[] = [
  { file: "01-home.png", path: "/" },
  { file: "02-library.png", path: "/apps", waitFor: "[data-testid=app-card]" },
  { file: "03-guide-gmail.png", path: "/apps/gmail", full: true, waitFor: "[data-testid=composio-box]" },
  { file: "04-generate.png", path: "/generate" },
  // A live-generated Linear guide (production run, 2026-10-28), including its "Setup attempts" section.
  { file: "05-generated-linear.png", path: "/generate/3ae40efd-0247-45ba-83a5-6af49e4f6bdf", full: true, waitFor: "#attempts" },
  { file: "06-evidence.png", path: "/evidence" },
];

async function main() {
  const base = (process.argv[2] ?? "https://oauth-atlas.vercel.app").replace(/\/$/, "");
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  for (const s of SHOTS) {
    const res = await page.goto(base + s.path, { waitUntil: "networkidle" });
    if (!res?.ok()) throw new Error(`${s.path} answered ${res?.status()}`);
    if (s.waitFor) await page.waitForSelector(s.waitFor, { timeout: 30_000 });
    await page.screenshot({ path: `docs/screenshots/${s.file}`, fullPage: s.full ?? false });
    console.log(`saved docs/screenshots/${s.file} (${s.path})`);
  }
  await browser.close();
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
