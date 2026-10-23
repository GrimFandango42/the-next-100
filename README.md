# The Next 100

A living, self-grading forecast of the next 100 years of humanity — 2026 to 2200. Zoom the timeline, scrub the year, flip the hinge between a pluralistic and a concentrated AI future, and watch every number on the page move. Every week an automated check-in reads the news against the forecast's own leading indicators, revises probabilities in public, and grades lines whose windows have closed.

Live: **https://thenext100.duckdns.org**

## What's here

| Path | What |
| --- | --- |
| `data/` | The forecast: events, eras, metrics, the clock, scenarios, indicators, change log. Plain JSON, schema-checked. |
| `src/` | The site. Vite + React + TypeScript + D3. |
| `scripts/` | `validate` (runs on every build), `checkin-brief`, `checkin-log`. |
| `CHECKIN.md` | The weekly check-in protocol. |
| `.claude/skills/checkin` | `/checkin` in Claude Code runs the protocol end to end. |
| `deploy/` | nginx + systemd timer for the Hetzner VPS. Push to `main` and the site updates itself within ten minutes. |

## Run it

```
npm ci
npm run dev        # http://localhost:5173
npm run build      # validates data, typechecks, builds to dist/
```

## Edit the forecast

Edit `data/*.json`. `npm run validate` tells you if you broke a rule (tiers vs probabilities, scenarios summing to 100, dangling ids, closed windows left ungraded). Every event edit appends a `history` entry; every check-in appends a `changelog` entry. See `CHECKIN.md`.

## Deploy (first time)

1. Claim `thenext100` at duckdns.org and point it at the VPS.
2. On the VPS, as root: `curl -fsSL https://raw.githubusercontent.com/GrimFandango42/the-next-100/main/deploy/install.sh | bash`
3. For HTTPS: `apt-get install -y certbot python3-certbot-nginx && certbot --nginx -d thenext100.duckdns.org --redirect`

After that, every push to `main` goes live on its own.

## Method, in one paragraph

Three forces drive the forecast: AI compounds while institutions lag; demographic decline is the slowest, most certain force; and whether the most capable systems end up in a few hands or many is the hinge on which the back half of the century turns. Lines are tiered high (≥70%), moderate (45–70%) and speculative (<45%). Dates are midpoints of ranges. The point of publishing it this way is to find out, in public and on a schedule, how wrong it was.
