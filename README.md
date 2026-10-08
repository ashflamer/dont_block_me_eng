# Don't Block Me — Engineer Edition

A zero-dependency single-page parody of the "find friends you can't trust" quiz, rebuilt
around **ten** engineer questions:

| # | Topic |
| --- | --- |
| 1 | Which microcontroller do I actually like? |
| 2 | What programming language do I reach for first? |
| 3 | It's 2 AM. What am I doing? |
| 4 | What do I actually write code in? |
| 5 | Which OS runs my main machine? |
| 6 | Be honest about my commit history — what does it look like? |
| 7 | How do I debug hardware? |
| 8 | What's the state of my side projects? |
| 9 | How do I feel about soldering? |
| 10 | Which bus do I actually enjoy working with? |

## Verdicts

| Score | Stamp |
| --- | --- |
| 10/10 | **YOU'RE SAFE** — you stay in the group chat |
| 9/10 | **YOU'RE SAFE** — one slip, you squeak by |
| 6–8 | **PROBATION** — soft block |
| 0–5 | **BLOCKED** — screenshot it, live with it |

Only a perfect 10/10 clears `blocked: false`; 9/10 shows the green stamp but is still logged
as blocked. That distinction is asserted in `test/logic.test.js`.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The quiz. No build step, no network calls, no tracking. |
| `answers.html` | Link builder — pick your ten real answers, it emits a `?key=` URL. |
| `js/quiz.js` | Questions, default key, tiers, key parsing, scoring. **Single source of truth.** |
| `js/main.js` | Quiz screen controller (progress, options, receipts, scoreboard, share). |
| `js/answers.js` | Link builder UI. Builds its dropdowns from `js/quiz.js`, so it can't drift. |
| `test/logic.test.js` | 14 logic tests against `js/quiz.js`. |
| `test/harness.test.js` | 12 jsdom tests that load the real `index.html` and play it with real clicks. |
| `vercel.json` | Static deploy config. |

## Run it

Open `index.html` in a browser, or serve the folder:

```bash
npx serve .        # or: python3 -m http.server 8000
```

## The answer key

Correct answers are option indices, defaulting to `[0,1,0,0,2,1,2,1,1,0]`
(Arduino Uno / Python / debugging a bug I created at 1 AM / …). Override per link:

```
index.html?key=1,0,2,3,2,0,1,2,3,0
```

Use `answers.html` instead of hand-editing indices. The key sits in the URL by design —
this is a roast, not a security product. A malformed key (wrong length, negative, decimal,
non-digit) falls back to the default rather than silently scoring against garbage.

## Tests

```bash
npm install     # pulls jsdom, the only devDependency
npm test        # 26 tests: logic suite + jsdom playthroughs
```

The harness plays complete runs at 0/10, 4/10, 7/10, 9/10 and 10/10, checks the stamp,
verdict, receipts table, `localStorage` log and share link, and asserts that "Try again"
actually returns to the intro.

## Deploy

Static site — any host works. On Vercel:

```bash
npx vercel --prod        # or: import the repo at vercel.com/new
```

No build command, output directory `.` (the root). `vercel.json` adds clean URLs and cache
headers.

## Notes

- Attempt history lives in `localStorage` under `dbme_eng_runs_v1`, capped at 12 entries.
- Fonts fall back to the system rounded / Comic Sans MS stack, so the page looks right offline.
