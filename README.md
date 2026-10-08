# Don't Block Me — Engineer Edition

A single-file parody of the "find friends you can't trust" quiz, rebuilt around three
engineer questions:

1. **Which microcontroller do I actually like?**
2. **What programming language do I reach for first?**
3. **It's 2 AM. What am I doing?**

Get all three right and you stay in the friend list. Anything less and the page slaps a
**BLOCKED** stamp on you.

## Files

| File | What it is |
| --- | --- |
| `index.html` | The quiz. Zero dependencies, zero build step, no network calls. |
| `answers.html` | Link builder — pick your real answers, it emits a `?key=` URL. |
| `test/logic.test.js` | Node test suite for the scoring + key-parsing logic (the same code the page runs). |
| `test/harness.html` | DOM harness: loads the real `index.html` in jsdom and plays the quiz end to end. |

## Run it

Open `index.html` in a browser, or serve the folder:

```bash
npx serve .        # or: python3 -m http.server 8000
```

## The answer key

Correct answers are option indices, defaulting to `[0, 1, 0]` (Arduino Uno / Python /
Debugging a bug I created at 1 AM). Override per link:

```
index.html?key=1,2,3
```

Generate that link with `answers.html` instead of hand-editing indices. The key is visible
in the URL by design — this is a roast, not a security product.

## Tests

```bash
npm test
```

`npm test` runs both files: pure-logic assertions against `test/questions.js` (the shared
source of truth the pages load) and a jsdom pass that drives `index.html` through all three
questions and checks the resulting verdict.

## Notes

- Attempt history is kept in `localStorage` under `dbme_eng_runs_v1`, capped at 12 entries.
- Fonts fall back to the system rounded/`Comic Sans MS` stack, so the page still looks right
  offline.
