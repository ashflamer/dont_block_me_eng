/* DOM harness: loads the REAL index.html + js/main.js in jsdom, plays the
   whole quiz with real clicks, and asserts what the page actually renders.
   Skips cleanly if jsdom isn't installed. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
let JSDOM, ResourceLoader;
try {
  ({ JSDOM, ResourceLoader } = require("jsdom"));
} catch {
  test("jsdom harness", (t) => t.skip("jsdom not installed — run `npm install` first"));
  return;
}

const HTML = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
const { QUESTIONS, DEFAULT_KEY, tierFor } = require(path.join(ROOT, "js", "quiz.js"));
const N = QUESTIONS.length;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** jsdom runs the page in its own realm, so arrays it returns are not Node
 *  arrays. Copy them into this realm before deepStrictEqual compares them. */
const local = (xs) => [...xs];

/** Serve <script src> from the repo on disk while keeping an https:// origin,
 *  so localStorage and location.origin behave like a real hosted page. */
class Local extends ResourceLoader {
  fetch(url) {
    const rel = url.replace(/^https:\/\/example\.test\//, "");
    const file = path.join(ROOT, rel.split("?")[0].split("#")[0]);
    try {
      return Promise.resolve(fs.readFileSync(file));
    } catch {
      return Promise.reject(new Error("not found: " + rel));
    }
  }
}

async function loadPage(search) {
  const dom = new JSDOM(HTML, {
    url: "https://example.test/index.html" + (search || ""),
    runScripts: "dangerously",
    resources: new Local(),
    pretendToBeVisual: true,
  });
  const win = dom.window;
  win.scrollTo = () => {}; // jsdom leaves this unimplemented
  for (let i = 0; i < 100 && !win.DBM; i++) await sleep(20);
  assert.ok(win.DBM, "js/quiz.js did not load into the page");
  await sleep(30);
  return win;
}

function click(win, el) {
  el.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
}

/** Play the quiz with real clicks; `picks` is one option index per question. */
async function play(win, picks) {
  click(win, win.document.getElementById("btn-start"));
  await sleep(20);
  assert.ok(win.document.getElementById("s-quiz").classList.contains("on"), "quiz screen not shown");

  for (let i = 0; i < picks.length; i++) {
    const doc = win.document;
    assert.equal(doc.getElementById("qnum").textContent, String(i + 1), "question counter drifted");
    assert.equal(doc.getElementById("qtext").textContent, QUESTIONS[i].text, "wrong question rendered at " + (i + 1));
    assert.equal(doc.querySelectorAll("#opts .opt").length, 4, "expected 4 options at " + (i + 1));
    assert.equal(doc.querySelectorAll("#meter .pip").length, N, "progress meter should have one pip per question");
    assert.equal(doc.querySelectorAll("#meter .pip.done").length, i, "pip " + i + " not marked done");

    click(win, doc.querySelector('#opts .opt[data-i="' + picks[i] + '"]'));

    assert.ok(
      [...doc.querySelectorAll("#opts .opt")].every((b) => b.disabled),
      "options stayed clickable after answering question " + (i + 1)
    );
    assert.equal(doc.querySelectorAll("#opts .opt.good").length, 1, "exactly one correct option must be highlighted");

    await sleep(1150); // main.js advances on a 1000ms timer
  }
  assert.ok(win.document.getElementById("s-result").classList.contains("on"), "result screen not shown");
}

function stampOf(win) { return win.document.getElementById("stamp"); }
function scoreOf(win) { return win.document.getElementById("scoreline").textContent; }
function receiptRows(win) {
  return [...win.document.querySelectorAll("#compare tr")].map((tr) =>
    [...tr.querySelectorAll("td")].map((td) => td.textContent)
  );
}
function stored(win) { return JSON.parse(win.localStorage.getItem("dbme_eng_runs_v1")); }

/** Picks that get exactly `want` right against `key`. */
function picksWithScore(want, key) {
  return key.map((k, i) => (i < want ? k : (k + 1) % 4));
}

async function runScore(search, key, want) {
  const win = await loadPage(search);
  const picks = picksWithScore(want, key);
  await play(win, picks);

  const expected = tierFor(want);
  assert.equal(stampOf(win).textContent, expected.name, "wrong stamp at " + want + "/" + N);
  assert.ok(
    stampOf(win).className.includes(expected.style),
    "stamp style wrong at " + want + ": " + stampOf(win).className
  );
  assert.match(scoreOf(win), new RegExp(want + " / " + N));
  assert.equal(win.document.getElementById("verdict").textContent, expected.verdict);

  const rows = receiptRows(win);
  assert.equal(rows.length, N, "receipts must list every question");
  assert.deepStrictEqual(
    rows.map((r) => r[3]),
    picks.map((p, i) => (p === key[i] ? "✅" : "❌")),
    "receipt ticks don't match the picks"
  );
  rows.forEach((r, i) => {
    assert.equal(r[0].trim(), QUESTIONS[i].tag + QUESTIONS[i].text, "receipt question " + (i + 1) + " mislabelled");
    assert.equal(r[1], QUESTIONS[i].options[picks[i]], "receipt 'you said' wrong at " + (i + 1));
    assert.equal(r[2], QUESTIONS[i].options[key[i]], "receipt 'truth' wrong at " + (i + 1));
  });

  const log = stored(win);
  assert.equal(log.length, 1);
  assert.equal(log[0].score, want);
  assert.equal(log[0].total, N);
  assert.equal(log[0].blocked, want < N);
  win.close();
}

/* ---------- page structure ---------- */

test("index.html loads its logic from js/quiz.js (no duplicated question data)", () => {
  assert.match(HTML, /js\/quiz\.js/);
  assert.match(HTML, /js\/main\.js/);
  assert.doesNotMatch(HTML, /QUESTION SET/);
  assert.match(HTML, /10 questions/);
});

/* ---------- full playthroughs ---------- */

test("10/10 against the default key renders YOU'RE SAFE and logs a clean run", () =>
  runScore("", DEFAULT_KEY, N));

test("9/10 keeps the safe stamp but is still marked blocked in the log", () =>
  runScore("", DEFAULT_KEY, 9));

test("7/10 lands on PROBATION", () => runScore("", DEFAULT_KEY, 7));

test("4/10 is BLOCKED and the receipts expose the real answers", () =>
  runScore("", DEFAULT_KEY, 4));

test("0/10 is BLOCKED with the harshest verdict", () => runScore("", DEFAULT_KEY, 0));

/* ---------- URL handling ---------- */

test("a custom ?key= is honoured end to end", async () => {
  const key = [3, 0, 2, 1, 0, 3, 2, 0, 3, 1];
  const win = await loadPage("?key=" + key.join(","));
  assert.deepStrictEqual(local(win.DBM.keyFromQuery(win.location.search)), key);
  await play(win, key);
  assert.equal(stampOf(win).textContent, "YOU'RE SAFE");
  assert.equal(stored(win)[0].key, key.join(","));
  win.close();
});

test("a bogus ?key= falls back to the default key", async () => {
  const win = await loadPage("?key=nope,nope,nope");
  assert.deepStrictEqual(local(win.DBM.keyFromQuery(win.location.search)), DEFAULT_KEY);
  await play(win, DEFAULT_KEY);
  assert.equal(stampOf(win).textContent, "YOU'RE SAFE");
  win.close();
});

test("a three-value key (left over from the old version) is rejected, not padded", async () => {
  const win = await loadPage("?key=1,2,3");
  assert.deepStrictEqual(local(win.DBM.keyFromQuery(win.location.search)), DEFAULT_KEY);
  win.close();
});

/* ---------- interactions ---------- */

test("quit from the quiz returns to the intro without scoring", async () => {
  const win = await loadPage("");
  click(win, win.document.getElementById("btn-start"));
  await sleep(20);
  click(win, win.document.getElementById("btn-quit"));
  await sleep(20);
  assert.ok(win.document.getElementById("s-intro").classList.contains("on"));
  assert.equal(win.localStorage.getItem("dbme_eng_runs_v1"), null, "quit should not log a run");
  win.close();
});

test("share button produces a link carrying the full key", async () => {
  const key = [3, 0, 2, 1, 0, 3, 2, 0, 3, 1];
  const win = await loadPage("?key=" + key.join(","));
  let shared = null;
  Object.defineProperty(win.navigator, "share", {
    value: (d) => { shared = d; return Promise.resolve(); },
    configurable: true,
  });
  await play(win, key);
  click(win, win.document.getElementById("btn-share"));
  await sleep(30);

  assert.ok(shared, "navigator.share was not called");
  assert.ok(shared.url.startsWith("https://example.test/index.html?key="));
  assert.deepStrictEqual(local(win.DBM.keyFromQuery(shared.url)), key);
  assert.match(shared.text, /10 questions about me/);
  win.close();
});

test("repeated attempts accumulate in the local scoreboard", async () => {
  const win = await loadPage("");
  for (const want of [0, N]) {
    await play(win, picksWithScore(want, DEFAULT_KEY));
    assert.ok(win.document.getElementById("s-result").classList.contains("on"));
    if (want === 0) {
      // go back around via the retry button: result -> intro -> quiz
      click(win, win.document.getElementById("btn-retry"));
      await sleep(20);
      assert.ok(win.document.getElementById("s-intro").classList.contains("on"), "retry did not return to the intro");
    }
  }
  const log = stored(win);
  assert.equal(log.length, 2, "expected two logged attempts");
  assert.deepStrictEqual(log.map((r) => r.score), [N, 0], "newest attempt should be first");
  assert.equal(win.document.querySelectorAll("#board .brow").length, 2);
  win.close();
});
