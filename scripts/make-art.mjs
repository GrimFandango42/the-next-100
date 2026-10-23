#!/usr/bin/env node
/**
 * Optional: generate one piece of artwork per prediction with an image model, for public/moments/<id>.webp.
 * The site works without these; when a file exists it is shown behind that moment's figure.
 *
 *   OPENAI_API_KEY=... node scripts/make-art.mjs            # all events missing an image
 *   OPENAI_API_KEY=... node scripts/make-art.mjs fusion-net-grid   # one event
 *   node scripts/make-art.mjs --prompts                     # just print the prompts
 *
 * Uses the OpenAI Images API (gpt-image-1). Requires `sharp` for the webp step: npm i -D sharp.
 * Never commit the key; it is read from the environment only.
 */
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";

const events = JSON.parse(readFileSync(new URL("../data/events.json", import.meta.url), "utf8"));
const STYLE = "Minimal editorial illustration on a near-black navy background (#04060f), one subject, soft volumetric light, restrained palette of deep blues with a single warm amber accent, no text, no logos, no people's faces, cinematic, 4:3.";
const prompt = (e) => `${STYLE} Subject: ${e.title}. ${e.summary}`;

const args = process.argv.slice(2);
if (args.includes("--prompts")) { for (const e of events) console.log(`${e.id}\n  ${prompt(e)}\n`); process.exit(0); }
const key = process.env.OPENAI_API_KEY;
if (!key) { console.error("Set OPENAI_API_KEY (or use --prompts)."); process.exit(1); }
const only = args.filter((a) => !a.startsWith("--"));
const outDir = new URL("../public/moments/", import.meta.url);
mkdirSync(outDir, { recursive: true });
const sharp = (await import("sharp")).default;

for (const e of events) {
  if (only.length && !only.includes(e.id)) continue;
  const out = new URL(`${e.id}.webp`, outDir);
  if (existsSync(out) && !args.includes("--force")) { console.log("skip", e.id); continue; }
  const r = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST", headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({ model: "gpt-image-1", prompt: prompt(e), size: "1536x1024", quality: "medium", output_format: "png" }),
  });
  if (!r.ok) { console.error(e.id, r.status, await r.text()); continue; }
  const { data } = await r.json();
  const png = Buffer.from(data[0].b64_json, "base64");
  writeFileSync(out, await sharp(png).resize(1200).webp({ quality: 82 }).toBuffer());
  console.log("wrote", e.id);
}
