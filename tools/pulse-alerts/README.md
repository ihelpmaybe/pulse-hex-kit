# Pulse alerts — copy this folder

MIT · Python 3 · **no pip install**. Anyone can run their own Telegram swap pings.

## Copy & implement

```text
1. Copy this whole folder anywhere (or zip it).
2. Double-click SETUP.cmd   (Windows)  — or follow the Linux/mac lines below.
3. Edit config.env → BOT_TOKEN=… and CHAT_ID=…
4. Double-click START.cmd
```

### Token + chat (once)

| Step | What they do |
|------|----------------|
| A | Telegram → search `@BotFather` → `/newbot` → copy the token into `BOT_TOKEN=` |
| B | Open **their** new bot → send it any message |
| C | Run `python alert.py --chat-id` → paste the number into `CHAT_ID=` |

### Prove it works (no Telegram)

```bat
python alert.py --dry-run --once
```

Prints whether the public PulseX feed answers. Safe to ship in demos.

### Linux / mac

```bash
cp config.example.env config.env
# edit config.env
python3 alert.py --dry-run --once
python3 alert.py
```

## Knobs (`config.env`)

| Key | Default | Meaning |
|-----|---------|---------|
| `MIN_USD` | `1000` | Only alert at/above this size |
| `HEX_ONLY` | `1` | `1` = HEX pairs only · `0` = any PulseX swap |
| `POLL_SEC` | `30` | Seconds between checks |

## What it is

A tiny loop: public PulseX subgraph → filter → Telegram `sendMessage`. First run remembers recent swaps so the chat isn’t flooded.

## License

MIT — copy, fork, rebrand, sell, give away.
