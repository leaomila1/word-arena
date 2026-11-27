# Word Arena Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Kahoot-style live classroom vocabulary platform (≤200 players, 180-second rounds) with two games — Contexto-style Guess the Word and Davini — hosted on GitHub Pages with a Cloudflare Durable Objects real-time server.

**Architecture:** Static frontend (`web/`) on GitHub Pages talks over WebSocket to a Cloudflare Worker that routes each 6-digit room code to one Durable Object. Game rules live in pure JS modules (`server/src/games/*.js`) behind a fixed game interface so new games are added as new modules; answers and rank data never leave the server.

**Tech Stack:** Vanilla HTML/CSS/ES modules (no framework); Cloudflare Workers + SQLite-backed Durable Objects with WebSocket Hibernation; `wrangler`; Node `node:test` for unit tests; Python 3 + spaCy `en_core_web_md` (downloaded from GitHub releases) for rank precompute; GitHub Actions for both deploys; client-side QR library vendored into `web/vendor/`.

**Spec:** `docs/superpowers/specs/2026-11-27-word-arena-design.md`

## Global Constraints

- Max players per room: **200**. Round length: **180 s**. Room code: **6 digits**.
- Nickname: ≤ **16** chars, unique within room, profanity-filtered.
- Contexto guess rate limit: **1 per 1.5 s** per player. Davini guess rate limit: **1 per 3 s**.
- Contexto colors: rank 1 gold "Correct!"; 2–300 green "Very close"; 301–1,500 orange "Getting warm"; >1,500 red "Far". Color never the only signal (always text/icon too).
- Correct-answer score (both games): `max(400, 1000 − 3 × seconds)`. Contexto timeout: `max(0, round(400 − bestRank / 5))`. Davini skip-decode bonus: **×1.2** (teacher-approved). Davini decoded-but-unanswered: **200**.
- Davini partial key reveals ~**60%** of the letters in the clue; symbols re-randomised each round server-side.
- Host leaderboard push throttled to ~**1 per second**.
- Idle room cleanup after **30 min**.
- Only words with `teacher_approved=yes` in `content/words.csv` are built into the game.
- No answer, rank file or clue plaintext may be served from `web/` or sent to player sockets before it is earned.
- No persistent results, no accounts, no CSV export.
- Clues and culture notes are original text — never copied from Cambridge/Oxford.
- Player UI English; teacher guide Thai. Host screen readable at 1920×1080 (timer/answer ≥ 64 px), player screen works at 360 px wide; WCAG AA contrast.
- Zero-cost: Cloudflare Workers Free + GitHub Pages only. Claude never enters the Cloudflare API token; the teacher adds it to GitHub Secrets.

## Review Focus

1. **201st join / duplicate nickname / join after round started** → 201st gets "Room is full"; duplicate name gets "Name taken"; late joiner enters as spectator until next round. Test in Task 1.
2. **Player reconnect mid-round** (phone sleeps, Wi-Fi blips) → same token restores name, score and guess history. Test in Task 1.
3. **Guess normalisation**: "Kimchi ", "KIMCHI", "kimchis"? → trim + lowercase; plurals not auto-accepted (Contexto treats as separate word if in vocab). Test in Task 2.
4. **Answer leak**: any message to a player or any file under `web/` containing the target word before reveal. Test in Task 9 (grep build output + inspect socket traffic in load test).
5. **Host tab refresh / host disconnect** → room survives; host rejoins with host token and sees current state; players unaffected. Test in Task 1.

---

## File Structure

```
server/
  wrangler.toml
  package.json
  src/worker.js           HTTP → upgrade → route to Room DO by code; POST /rooms creates code
  src/room.js             Durable Object: sockets, hibernation, dispatch to core + game
  src/core/roomState.js   pure: players, join/kick/reconnect, phases, timer, leaderboard
  src/core/names.js       pure: nickname validation + profanity list
  src/games/index.js      registry {contexto, davini}
  src/games/contexto.js   pure game module
  src/games/davini.js     pure game module
  src/games/cipher.js     pure: symbol substitution + partial key
  data/                   build output (ranks, vocab, puzzles) — generated, committed
  test/*.test.js
content/words.csv
tools/build_ranks.py
tools/build_content.py
tools/loadtest.js
web/index.html  host.html  play.html  styles.css  config.js
web/core/net.js  web/core/lobby.js  web/core/timer.js  web/core/qr.js
web/games/contexto/host.js  player.js
web/games/davini/host.js    player.js
web/vendor/qrcode.min.js
.github/workflows/deploy-pages.yml  deploy-worker.yml
docs/คู่มือครู.md
```

### Game module interface (used by Tasks 1–3, 7)
```js
// server/src/games/<id>.js
export default {
  id: 'contexto' | 'davini',
  startRound(content, rng) -> roundState,          // content = one item from data/
  onGuess(roundState, playerId, text, nowMs) -> { reply, event? },  // reply goes only to that player
  publicView(roundState) -> object,                 // safe for host; never contains answer
  endRound(roundState, nowMs) -> { scores: {playerId: int}, reveal: {answer, culture_note_en, culture_note_th} }
}
```
Wire protocol (JSON over WebSocket), `type` field: client→server `join{name,token?}`, `host{hostToken}`, `start{gameId, context}`, `guess{text}`, `kick{playerId}`, `next`, `close`; server→client `joined{playerId,token}`, `error{code}`, `lobby{players}`, `round{gameId, endsAt, view}`, `reply{...}`, `board{top, progress}`, `reveal{...}`, `closed`.

---

### Task 1: Room core (join, lobby, timer, reconnect, kick)

**Files:** Create `server/package.json`, `server/wrangler.toml`, `server/src/core/roomState.js`, `server/src/core/names.js`, `server/src/room.js`, `server/src/worker.js`, `server/test/roomState.test.js`, `server/test/names.test.js`

**Interfaces:**
- Produces: `createRoom(code, hostToken) -> RoomState`; `join(state, name, token?) -> {ok, playerId, token} | {ok:false, code:'FULL'|'NAME_TAKEN'|'NAME_INVALID'}`; `kick(state, playerId)`; `startRound(state, gameId, roundState, nowMs)` sets `phase='round'`, `endsAt=nowMs+180000`; `isExpired(state, nowMs)`; `leaderboard(state, n=5)`; `validateName(name) -> {ok, reason?}`.

- [ ] **Step 1: Write failing tests** in `roomState.test.js`: `join_200_then_201_full` (201st → `code:'FULL'`); `duplicate_name_rejected` (case-insensitive); `late_join_is_spectator` (joined during `phase='round'` → `player.spectator===true`, becomes false on next `startRound`); `reconnect_restores_player` (same token → same playerId, score kept, count unchanged); `round_ends_after_180s` (`isExpired` false at +179999 ms, true at +180000). `names.test.js`: 17-char name rejected, empty/whitespace rejected, a listed profane word rejected (including leetspeak `a$$`-style substitutions of one entry).
- [ ] **Step 2:** `cd server && node --test` → FAIL (modules missing).
- [ ] **Step 3: Implement** `roomState.js` and `names.js` as pure functions (no Cloudflare APIs). Profanity list: small English list in `names.js`, normalise `@→a, $→s, 0→o, 1→i, 3→e` before matching.
- [ ] **Step 4:** `node --test` → PASS.
- [ ] **Step 5: Implement `Room` Durable Object** in `room.js` using `this.ctx.acceptWebSocket(ws)` + `webSocketMessage/webSocketClose` (Hibernation API); persist `RoomState` with `this.ctx.storage.put('state', …)` after every mutation; per-socket attachment `{playerId|host}` via `serializeAttachment`. Use a DO alarm for round end (`endsAt`) and for 30-min idle cleanup. Host board push throttled to 1/s. `worker.js`: `POST /rooms` → random unused 6-digit code + hostToken; `GET /ws/:code` → forward to `env.ROOM.idFromName(code)`. CORS allow the Pages origin from `wrangler.toml` var `ALLOWED_ORIGIN`.
- [ ] **Step 6:** `npx wrangler dev` locally; with `npx wscat` connect as host and two players, verify `lobby` lists both, `kick` removes one and its socket gets `closed`; refresh host socket with same hostToken → receives current `lobby`.
- [ ] **Step 7: Commit** `feat(server): room core with join, reconnect, kick, timer`

### Task 2: Contexto game module

**Files:** Create `server/src/games/contexto.js`, `server/src/games/index.js`, `server/test/contexto.test.js`, `server/test/fixtures/ranks_cat.json`

**Interfaces:**
- Consumes: game module interface above; rank data shape `{ target: 'cat', vocabIndex: Map<word, int>, ranks: Uint32Array }` (rank of vocab word i for this target; target has rank 1) — produced by Task 5, fixture for now.
- Produces: `colorFor(rank) -> 'gold'|'green'|'orange'|'red'`; `scoreCorrect(seconds)`; `scoreTimeout(bestRank)`; default export module.

- [ ] **Step 1: Write failing tests:** `colorFor(1)=='gold'`, `(300)=='green'`, `(301)=='orange'`, `(1500)=='orange'`, `(1501)=='red'`; `scoreCorrect(0)==1000`, `(100)==700`, `(250)==400`; `scoreTimeout(1)==400`, `(1000)==200`, `(5000)==0`; `normalises_input` (`" CAT "` → rank 1); `unknown_word` → `reply.error=='NOT_IN_LIST'` and not counted; `rate_limit` (second guess within 1500 ms → `reply.error=='SLOW_DOWN'`); `publicView_has_no_answer` (JSON.stringify of view does not contain `"cat"`); `best_rank_tracked` per player; `endRound` gives correct players `scoreCorrect` and others `scoreTimeout(best)`.
- [ ] **Step 2:** `node --test` → FAIL.
- [ ] **Step 3: Implement.** `onGuess` reply `{word, rank, color, label}` with labels from Global Constraints. `publicView` → `{players: [{id, bestRank, solved}]}` only.
- [ ] **Step 4:** `node --test` → PASS.
- [ ] **Step 5: Commit** `feat(server): contexto game module`

### Task 3: Davini game module

**Files:** Create `server/src/games/cipher.js`, `server/src/games/davini.js`, `server/test/cipher.test.js`, `server/test/davini.test.js`

**Interfaces:**
- Consumes: puzzle `{answer, clue_text, emoji:[3], culture_note_en, culture_note_th}`.
- Produces: `encode(clueText, rng) -> {cipher: string[], fullKey: Map<letter,symbol>, shownKey: Map<letter,symbol>}`; default export module.

- [ ] **Step 1: Write failing tests:** `cipher_roundtrip` (decoding `cipher` with `fullKey` gives clue, spaces preserved); `partial_key_about_60pct` (for clue `WINTER DISH`, `shownKey.size == round(0.6 × uniqueLetters)`); `symbols_differ_between_rounds` (two rngs seeds → different keys); stages: `decode_correct_unlocks_emoji` (reply contains `emoji` only after correct clue), `emoji_absent_before_decode`; scoring: answer after decode at 50 s → 850; skip-decode answer at 50 s → `round(850×1.2)=1020`; decoded but no answer at end → 200; wrong guesses not penalised; rate limit 3000 ms → `SLOW_DOWN`; `publicView` contains neither answer nor clue plaintext.
- [ ] **Step 2:** `node --test` → FAIL.
- [ ] **Step 3: Implement.** Symbol pool: ≥40 distinct non-letter glyphs (e.g. ★▲●◆■♣♠♥☀☂…) in `cipher.js`; Fisher–Yates with injected `rng`. Clue matching case/space-insensitive.
- [ ] **Step 4:** `node --test` → PASS. Register both games in `games/index.js`; wire `start/guess` dispatch in `room.js`.
- [ ] **Step 5: Commit** `feat(server): davini game module and cipher`

### Task 4: Draft word bank (teacher review gate)

**Files:** Create `content/words.csv`, `content/README.md`

- [ ] **Step 1:** Draft 100 rows (20 per context en/fr/ru/ko/zh) with columns exactly as spec §9, `teacher_approved=no`. Each context mixes categories: food, festivals, places, arts/music, daily life & etiquette, greetings. Clues ≤ 3 words at A2–B1; culture notes original (EN 1–2 sentences + TH). Emoji = OpenMoji codepoints that exist (verify against the OpenMoji `openmoji.json` from its GitHub repo).
- [ ] **Step 2: Check** with a script: 100 rows, 20 per context, no duplicate `word`, every emoji codepoint present in openmoji.json, clue word count ≤ 3, no stereotype-only context (each context has ≥ 4 categories).
- [ ] **Step 3: Send the CSV to the teacher** as a readable table; **STOP** until she returns it with `teacher_approved` and `dictionary_checked` filled. Do not start Task 5 on unapproved rows.
- [ ] **Step 4: Commit** approved `content/words.csv` — `content: teacher-approved word bank v1`

### Task 5: Build rank data and content bundle

**Files:** Create `tools/build_ranks.py`, `tools/build_content.py`, `server/data/*` (generated), `tools/report_neighbours.md` (generated)

**Interfaces:**
- Produces: `server/data/vocab.txt` (one word per line, index = line), `server/data/ranks/<word>.bin` (Uint32 little-endian, length = vocab size), `server/data/puzzles.json` (Davini items), `server/data/contexto.json` (list of playable targets by context). Loader `loadRanks(word) -> Uint32Array` in `contexto.js`.

- [ ] **Step 1:** `build_ranks.py`: install `en_core_web_md` wheel from the spaCy GitHub release; vocab = lexemes with vectors, `^[a-z]{2,}$`, lowercase, de-duplicated, minus profanity list, capped at 20,000 by frequency (`lex.prob`); add every approved target even if outside the cap. For each approved target: cosine vs all vocab, argsort, write ranks. Targets with no vector → write `contexto=no` back into report.
- [ ] **Step 2:** Generate `tools/report_neighbours.md`: top 20 neighbours per target. Send to teacher; mark targets she rejects as `contexto=no`.
- [ ] **Step 3: Size check:** total `server/data` gzipped. If > 2.5 MB, switch to storing top 5,000 ranks per target (others → "Far") per spec §7 and record the choice in `content/README.md`.
- [ ] **Step 4:** Update `contexto.test.js` to load one real target from `server/data` and assert target rank 1 and a clearly related word (from the report) ranks ≤ 300.
- [ ] **Step 5:** `node --test` → PASS. **Commit** `data: build ranks and puzzles`

### Task 6: Web core — home, host lobby, player join

**Files:** Create `web/index.html`, `web/host.html`, `web/play.html`, `web/styles.css`, `web/config.js`, `web/core/net.js`, `web/core/lobby.js`, `web/core/timer.js`, `web/core/qr.js`, `web/vendor/qrcode.min.js`

**Interfaces:**
- Consumes: wire protocol above; `config.js` exports `WORKER_URL`.
- Produces: `connect(code, role, {name?, token?, hostToken?}) -> {send(obj), on(type, fn)}` with auto-reconnect (backoff 1 s → 5 s) and token kept in `sessionStorage`; `renderTimer(el, endsAt)`.

- [ ] **Step 1:** Load `ui-ux-pro-max:ui-ux-pro-max` and `ponytail:ponytail` skills; pick the game-show palette (bright, high contrast, WCAG AA) and type scale; tokens as CSS variables in `styles.css`.
- [ ] **Step 2: Implement** home (two buttons: "Host a game" / code input + "Join"); `play.html?code=XXXXXX` prefills code (QR target); host lobby shows code at ≥ 96 px, QR, player count `n / 200`, names grid with kick ✕, game + context pickers, Start. Player lobby: name entry, then "You're in! Watch the screen."
- [ ] **Step 3: Verify in browser** (wrangler dev + local static server): host at 1920×1080, two phones at 360×800; join via QR URL; kick; reload player tab → same name restored; errors `FULL`/`NAME_TAKEN` shown as readable text.
- [ ] **Step 4: Commit** `feat(web): home, lobby, join and reconnect`

### Task 7: Web game views

**Files:** Create `web/games/contexto/host.js`, `web/games/contexto/player.js`, `web/games/davini/host.js`, `web/games/davini/player.js`

**Interfaces:** each exports `mount(rootEl, net, roundMsg)` and `unmount()`.

- [ ] **Step 1: Contexto player:** input on top; guesses list sorted by rank, each row = word + `#rank` + colored bar + text label; errors `NOT_IN_LIST` / `SLOW_DOWN` as inline messages. Keyboard must not cover the latest result.
- [ ] **Step 2: Contexto host:** "race to the finish" — one dot per player on a horizontal track positioned by `log(bestRank)`, names only for top 5, no guessed words shown; big timer.
- [ ] **Step 3: Davini player:** cipher row + partial key grid + clue input → on unlock, 3 emoji (OpenMoji SVGs vendored under `web/vendor/openmoji/` with CC BY-SA attribution in footer) + answer input; "Skip to answer" visible from start.
- [ ] **Step 4: Davini host:** progress counts (decoded / solved), timer; reveal screen with answer, emoji, culture note EN + TH, top 5.
- [ ] **Step 5: Verify in browser** full round of each game with 3 clients; reveal appears at 180 s; "Next round" and "Close room" work.
- [ ] **Step 6: Commit** `feat(web): contexto and davini views`

### Task 8: Deploy pipelines and teacher guide

**Files:** Create `.github/workflows/deploy-pages.yml`, `.github/workflows/deploy-worker.yml`, `docs/คู่มือครู.md`, root `README.md`

- [ ] **Step 1:** Pages workflow publishes `web/` on push to `main`. Worker workflow runs `node --test` then `wrangler deploy` with `secrets.CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`; fails fast with a clear message if the secret is missing.
- [ ] **Step 2:** Thai teacher guide: create free Cloudflare account → create API token (template "Edit Cloudflare Workers") → add both secrets in GitHub → set `WORKER_URL` in `web/config.js` → push → open Pages URL. Plus: running a class, adding words (edit CSV → run tools → push), adding a new game (the module interface), and the known limit: test with one real class before a 200-student session.
- [ ] **Step 3:** Use `thai-thesis-human-voice` style rules for the guide's Thai (plain, human, no AI phrasing). Verify every step against the actual Cloudflare dashboard labels at time of writing; mark any label not verified.
- [ ] **Step 4: Commit** `ci: pages and worker deploy; docs: teacher guide`

### Task 9: Load test and leak check (acceptance)

**Files:** Create `tools/loadtest.js`, `tools/check_leaks.js`

- [ ] **Step 1:** `loadtest.js <workerUrl>`: create room, open 200 player sockets + 1 host, start Contexto, each player guesses a random vocab word every 1.5–5 s for 180 s, then Davini round. Report: dropped connections, max/median reply latency, total incoming messages, estimated billed requests (`connections + messages/20`).
- [ ] **Step 2:** Pass criteria: 0 unexpected disconnects; 201st join gets `FULL`; median reply latency < 500 ms; billed requests per round reported (compare with spec estimate ~600, record actual in README).
- [ ] **Step 3:** `check_leaks.js`: grep every file under `web/` and every message captured to player sockets in the load test for any approved answer word or clue plaintext before `reveal` → must find none.
- [ ] **Step 4:** Run both against the deployed Worker (needs teacher's deploy from Task 8). Record results in `README.md`.
- [ ] **Step 5: Commit** `test: load test and leak check results`
