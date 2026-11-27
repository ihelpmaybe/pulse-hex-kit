# Pulse alerts (Telegram) — easy clone

**MIT. Python 3 stdlib only.** Telegram pings when big PulseX / HEX swaps clear your USD floor.

## Clone in 4 steps

1. `@BotFather` → `/newbot` → copy token  
2. Copy `config.example.env` → `config.env` → paste `BOT_TOKEN=`  
3. Open Telegram, **message your bot**, then:
   ```bat
   python alert.py --chat-id
   ```
   Put that number in `CHAT_ID=`  
4. Run:
   ```bat
   START.cmd
   ```
   or `python alert.py` · dry test: `python alert.py --dry-run --once`

## What it does

Polls the **public PulseX v2 subgraph** for recent swaps. If USD ≥ `MIN_USD` (and `HEX_ONLY=1`), sends a Telegram message with pair + scan link.

First run **bootstraps** (marks current swaps seen) so you don’t get a flood.

## Needs

- Python 3.10+  
- Internet  
- Free BotFather token  

No npm. No paid API. No APPHEX gate.

## Files

| File | Job |
|------|-----|
| `alert.py` | Poller + Bot API |
| `config.example.env` | Template |
| `config.env` | Your secrets (gitignored) |
| `START.cmd` | Windows one-click |
| `.alert-state.json` | Seen swap ids (local) |

## License

MIT — copy, fork, rebrand.
