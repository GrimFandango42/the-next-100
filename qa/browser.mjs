// Launch a browser for the QA sweeps: PW_CHROMIUM if set, else Playwright's own Chromium, else an installed Edge or Chrome.
import { chromium } from "playwright";

export async function launch() {
  if (process.env.PW_CHROMIUM) return chromium.launch({ executablePath: process.env.PW_CHROMIUM });
  let first;
  for (const opts of [{}, { channel: "msedge" }, { channel: "chrome" }]) {
    try { return await chromium.launch(opts); } catch (e) { first ??= e; }
  }
  throw first;
}
