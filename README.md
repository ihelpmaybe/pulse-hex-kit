# Pulse HEX launch kit (copy-paste)

**Live tools (flat on the hub — no nested kit door):** [ihelpmaybe.github.io](https://ihelpmaybe.github.io/)  
- [HEX daily](https://ihelpmaybe.github.io/pulse-hex-daily/) · [Δ Discounts](https://ihelpmaybe.github.io/pulse-delta-discounts/) · [HSA](https://ihelpmaybe.github.io/pulse-hex-stake-analyzer/)  
**This repo = zip / source only:** [github.com/ihelpmaybe/pulse-hex-kit](https://github.com/ihelpmaybe/pulse-hex-kit)  
(`/pulse-hex-kit/` on Pages redirects to the hub.)

**Hub Pages = showcase.** Look in the browser. Do **not** treat github.io as a wallet front end.

**Anyone offline:** zip this folder → unzip anywhere → double-click `START.cmd` → local hub opens in the browser.

This kit ships **licensed / ours** tools only (no SPDX-less look-mirrors).

### Pulse alerts (Telegram) — easy clone

`tools/pulse-alerts/` — MIT, Python stdlib. BotFather token → `config.env` → `START.cmd`. Big PulseX / HEX swaps → your chat. See `tools/pulse-alerts/README.md`.

## What’s inside

| Open this | Job | Instead of |
|-----------|-----|------------|
| HEX Stake Analyzer | Paste wallets → stakes / HSI / HTT | — |
| Δ Discounts | Maximus Δ + majors on Pulse | — |
| HEX daily stats | Pulse day history + live mirror button | — |
| Pulse alerts | Telegram pings on big PulseX / HEX swaps (MIT) | — |

HEX daily also includes `tools/hexdaily/worker-src/` — Cloudflare Worker clone of the feed ([mrmcgit/hex-stats](https://github.com/mrmcgit/hex-stats)). See `tools/hexdaily/DEPLOY.md`.

## Needs
- Browser
- Internet (public Pulse/ETH RPC + DexScreener)
- Python optional (for `START.cmd` local server). Without Python, open `index.html` or `tools/*/index.html` directly — some tools prefer `http://` over `file://`.

## Desktop portfolios (sibling folders)
Not bundled here (large exes):
- `../lunagray/pulsechain-dashboard-2.0.0-win.exe`
- `../exodus-pulsechain-dashboard/PulseChain.Dashboard.2.4.3.Portable.exe`

## Share
Zip `pulse-hex-kit` only (~10 MB). Keep licenses with HSA.

## Not this kit
Private-indexer chart farms · undeclared official `*-server` zips · SPDX-less stake UI dists.
