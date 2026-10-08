/* DOM harness: loads the REAL index.html + js/main.js in jsdom, plays the
   quiz with real clicks, and asserts the verdict the page actually renders.
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
const { QUESTIONS } = require(path.join(ROOT, "js", "quiz.js"));

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
  // wait for the deferred scripts (quiz.js then main.js) to have run
  for (let i = 0; i < 100 && !win.DBM; i++) await sleep(20);
  assert.ok(win.DBM, "js/quiz.js did not load into the page");
  assert.ok(win.document.querySelector("#opts"), "index.html markup missing #opts");
  await sleep(30);
  return win;
}

function click(win, el) {
  el.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true }));
}

async function play(win, picks) {
  click(win, win.document.getElementById("btn-start"));
  await sleep(20);
  assert.ok(win.document.getElementById("s-quiz").classList.contains("on"), "quiz screen not shown");

  for (let i = 0; i < picks.length; i++) {
    const shown = win.document.getElementById("qnum").textContent;
    assert.equal(shown, String(i + 1), "question counter drifted");

    const opt = win.document.querySelector('#opts .opt[data-i="' + picks[i] + '"]');
    assert.ok(opt, `no option ${picks[i]} for question ${i + 1}`);
    click(win, opt);

    // the page disables the whole set once answered
    const disabled = [...win.document.querySelectorAll("#opts .opt")].every((b) => b.disabled);
    assert.ok(disabled, "options stayed clickable after answering");

    // it must always highlight the correct option (truth reveal / confirmation)
    const good = win.document.querySelectorAll("#opts .opt.good");
    assert.equal(good.length, 1, "expected exactly one correct option highlighted");

    await sleep(1150); // main.js advances on a 1000ms timer
  }
  assert.ok(win.document.getElementById("s-result").classList.contains("on"), "result screen not shown");
}

test("index.html loads its logic from js/quiz.js (no duplicated question data)", () => {
  assert.match(HTML, /js\/quiz\.js/);
  assert.match(HTML, /js\/main\.js/);
  assert.doesNotMatch(HTML, /QUESTION SET/);
});

test("playing the default key perfectly renders YOU'RE SAFE and logs 3/3", async () => {
  const win = await loadPage("");
  const key = win.DBM.DEFAULT_KEY;
  await play(win, key);

  const stamp = win.document.getElementById("stamp");
  assert.equal(stamp.textContent, "YOU'RE SAFE");
  assert.ok(stamp.className.includes("safe"), "stamp missing the safe style: " + stamp.className);
  assert.match(win.document.getElementById("scoreline").textContent, /3 \/ 3/);
  assert.match(win.document.getElementById("verdict").textContent, /stay in the group chat/);

  // receipts table: every row ticked
  const marks = [...win.document.querySelectorAll("#compare .mark")].map((td) => td.textContent);
  assert.deepEqual(marks, ["✅", "✅", "✅"]);

  // local scoreboard recorded the run
  const stored = JSON.parse(win.localStorage.getItem("dbme_eng_runs_v1"));
  assert.equal(stored.length, 1);
  assert.equal(stored[0].score, 3);
  assert.equal(stored[0].blocked, false);
  win.close();
});

test("one wrong answer renders BLOCKED and shows the real answer in the receipts", async () => {
  const win = await loadPage("?key=0,1,0");
  // right, right, wrong
  const picks = [0, 1, 2];
  await play(win, picks);

  const stamp = win.document.getElementById("stamp");
  assert.equal(stamp.textContent, "BLOCKED");
  assert.ok(stamp.className.includes("block"), "stamp missing the block style: " + stamp.className);
  assert.match(win.document.getElementById("scoreline").textContent, /2 \/ 3/);

  const rows = [...win.document.querySelectorAll("#compare tr")];
  assert.equal(rows.length, 3);
  const last = [...rows[2].querySelectorAll("td")].map((td) => td.textContent);
  assert.equal(last[1], QUESTIONS[2].options[2], "receipts show the wrong 'you said' value");
  assert.equal(last[2], QUESTIONS[2].options[0], "receipts show the wrong 'truth' value");
  assert.equal(last[3], "❌");

  const stored = JSON.parse(win.localStorage.getItem("dbme_eng_runs_v1"));
  assert.equal(stored[0].score, 2);
  assert.equal(stored[0].blocked, true);
  assert.equal(stored[0].key, "0,1,0");
  win.close();
});

test("a bogus ?key= makes the page fall back to the default key", async () => {
  const win = await loadPage("?key=nope,nope,nope");
  assert.deepEqual(win.DBM.keyFromQuery(win.location.search), win.DBM.DEFAULT_KEY);

  // answering with the default key must therefore be a perfect, unblocked run
  await play(win, win.DBM.DEFAULT_KEY);
  assert.equal(win.document.getElementById("stamp").textContent, "YOU'RE SAFE");
  win.close();
});

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

test("share button produces a link carrying the key", async () => {
  const win = await loadPage("?key=3,0,2");
  let shared = null;
  Object.defineProperty(win.navigator, "share", {
    value: (d) => { shared = d; return Promise.resolve(); },
    configurable: true,
  });
  await play(win, [3, 0, 2]);
  click(win, win.document.getElementById("btn-share"));
  await sleep(30);

  assert.ok(shared, "navigator.share was not called");
  assert.match(shared.url, /\?key=3,0,2$/);
  assert.ok(shared.url.startsWith("https://example.test/index.html"));
  win.close();
});
