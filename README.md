# Word Arena

Live classroom vocabulary games (≤200 players, 3-minute rounds) about English, French, Russian, Korean and Chinese culture.

- **Guess the Word** — Contexto-style: guess the secret word; every guess gets a meaning-closeness rank, and the big screen shows every guess live plus the closest words so far.
- **Davini** — look at three emoji and a short clue, type the word; the first correct answer wins and ends the round.

Frontend: `web/` (GitHub Pages). Server: `server/` (Cloudflare Workers + Durable Objects, free plan). Content: `content/words.csv`.

Teacher setup and usage (Thai): [docs/คู่มือครู.md](docs/คู่มือครู.md). Design: `docs/superpowers/specs/`.

## Develop
```
cd server && npm install && npm test && npx wrangler dev      # server on :8787
cd web && python3 -m http.server 8080                          # site on :8080 (config.js points to :8787)
tools/check-web.sh                                             # frontend syntax check
node tools/loadtest.js <worker-url>                            # 200-player load test
```

## Credits
Emoji: [OpenMoji](https://openmoji.org) (CC BY-SA 4.0). QR: qrcode-generator by Kazuhiko Arase (MIT). Word vectors: spaCy `en_core_web_lg` (build time only). Word frequency: wordfreq.

## Test results (27 Nov 2026, local `wrangler dev`, not yet the deployed Worker)
`node tools/loadtest.js http://127.0.0.1:8787 180 60`
- 200/200 players joined; the 201st got `FULL`.
- Contexto round ran the full 180 s and revealed automatically; Davini round 60 s then ended by host.
- 14,118 bot guesses (bots guess every 1.5–5 s, faster than real students); reply latency median 1 ms, p95 3 ms, max 8.7 s (one outlier on the local dev server).
- 0 unexpected disconnects, 0 answer/clue leaks to players or host before reveal; no answer words in `web/`.
- Estimated Cloudflare billed requests ≈ 1,150 for both rounds (≈ 900 for one 3-minute round at bot speed) — higher than the design's ~600 estimate because the 1-per-second round alarm adds ~180. At this rate the free plan's 100,000/day still allows roughly 100 full rounds per day.
- **Not yet tested:** the deployed Cloudflare Worker and school Wi-Fi. Re-run the load test against the real Worker URL after deploying.
