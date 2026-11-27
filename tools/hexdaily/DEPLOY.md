# Deploy your own HEX daily-stats mirror

Original site: [hexdailystats.com](https://hexdailystats.com) → redirects to [hexstats.today](https://hexstats.today)  
Original collector: [togosh/hexdailystats](https://github.com/togosh/hexdailystats) (Node + Mongo — **git frozen mid-2023**)  
Easy copy-paste: [mrmcgit/hex-stats](https://github.com/mrmcgit/hex-stats) (Cloudflare Worker · free tier) — **`worker-src/` in this folder**

Worker extras vs classic site: ETH days via public RPC (Graph hosted service died), `/burnvalue`, `/health`, hourly cron.

## One-time (Cloudflare)

```bash
cd worker-src
npm i
npx wrangler kv namespace create FEED
# paste the id into wrangler.jsonc → kv_namespaces
npx wrangler deploy
npx wrangler secret put ADMIN_TOKEN
curl -X POST -H "Authorization: Bearer <token>" \
  "https://hex-stats.<you>.workers.dev/admin/backfill?chain=pulsechain"
```

Hourly cron keeps Pulse days fresh from public subgraphs + RPC. No Etherscan key, no Mongo.

## This kit

- `data/fulldatapulsechain.json` — offline snapshot (~2550 days)
- `index.html` — local viewer (+ optional live mirror button)
