/* Link-builder harness: loads the REAL answers.html in jsdom and checks the
   URL it generates, including when a static host serves it without the .html
   extension (which is exactly the case that broke it once already). */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
let JSDOM, ResourceLoader;
try {
  ({ JSDOM, ResourceLoader } = require("jsdom"));
} catch {
  test("answers.html harness", (t) => t.skip("jsdom not installed — run `npm install` first"));
  return;
}

const HTML = fs.readFileSync(path.join(ROOT, "answers.html"), "utf8");
const { QUESTIONS, DEFAULT_KEY } = require(path.join(ROOT, "js", "quiz.js"));
const N = QUESTIONS.length;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class Local extends ResourceLoader {
  fetch(url) {
    const u = new URL(url);
    let rel = u.pathname.replace(/^\/+/, "");
    if (rel.startsWith("quiz/")) rel = rel.slice("quiz/".length); // simulated subdir deploy
    const file = path.join(ROOT, rel);
    try {
      return Promise.resolve(fs.readFileSync(file));
    } catch {
      return Promise.reject(new Error("not found: " + rel));
    }
  }
}

async function load(url) {
  const dom = new JSDOM(HTML, {
    url: url,
    runScripts: "dangerously",
    resources: new Local(),
    pretendToBeVisual: true,
  });
  const win = dom.window;
  for (let i = 0; i < 100 && !win.DBM; i++) await sleep(20);
  assert.ok(win.DBM, "js/quiz.js did not load into answers.html");
  await sleep(30);
  return win;
}

const linkOf = (win) => win.document.getElementById("link").textContent;
const selValue = (win, i) => win.document.getElementById("k" + i).value;

test("answers.html builds one dropdown per question, straight from js/quiz.js", async () => {
  const win = await load("https://example.test/answers.html");
  assert.equal(win.document.querySelectorAll("#fields select").length, N);
  for (let i = 0; i < N; i++) {
    const opts = [...win.document.querySelectorAll("#k" + i + " option")];
    assert.equal(opts.length, 4, "question " + (i + 1) + " needs 4 choices");
    assert.match(opts[0].textContent, new RegExp(QUESTIONS[i].options[0].slice(0, 6)));
  }
  win.close();
});

test("default selections produce a link holding the default key", async () => {
  const win = await load("https://example.test/answers.html");
  assert.equal(linkOf(win), "https://example.test/index.html?key=" + DEFAULT_KEY.join(","));
  win.close();
});

test("changing a dropdown updates the link and round-trips through the quiz parser", async () => {
  const win = await load("https://example.test/answers.html");
  win.document.getElementById("k0").value = "3";
  win.document.getElementById("k9").value = "2";
  win.document.getElementById("k0").dispatchEvent(new win.Event("change", { bubbles: true }));
  win.document.getElementById("k9").dispatchEvent(new win.Event("change", { bubbles: true }));

  const url = linkOf(win);
  const expected = DEFAULT_KEY.slice();
  expected[0] = 3;
  expected[9] = 2;
  assert.equal(url, "https://example.test/index.html?key=" + expected.join(","));
  assert.deepStrictEqual([...win.DBM.keyFromQuery(url)], expected);
  win.close();
});

test("an incoming ?key= prefills the dropdowns", async () => {
  const key = [3, 0, 2, 1, 0, 3, 2, 0, 3, 1];
  const win = await load("https://example.test/answers.html?key=" + key.join(","));
  assert.deepStrictEqual(
    Array.from({ length: N }, (_, i) => selValue(win, i)),
    key.map(String)
  );
  assert.equal(linkOf(win), "https://example.test/index.html?key=" + key.join(","));
  win.close();
});

test("REGRESSION: served as /answers with no extension, the link still targets index.html", async () => {
  // vercel.json used to set cleanUrls:true, which serves this page at /answers
  // and made the builder emit /answers?key=... — a link to itself, not the quiz
  const win = await load("https://example.test/answers");
  const url = linkOf(win);
  assert.equal(url, "https://example.test/index.html?key=" + DEFAULT_KEY.join(","));
  assert.match(url, /\/index\.html\?key=/);
  assert.doesNotMatch(url, /\/answers\?key=/);
  win.close();
});

test("served from a subdirectory, the link stays inside that subdirectory", async () => {
  const win = await load("https://example.test/quiz/answers.html");
  assert.equal(linkOf(win), "https://example.test/quiz/index.html?key=" + DEFAULT_KEY.join(","));
  win.close();
});
