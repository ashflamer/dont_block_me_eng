/* Pure-logic tests against js/quiz.js — the same module index.html loads. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const Q = require("../js/quiz.js");
const {
  QUESTIONS, DEFAULT_KEY, TIERS,
  parseKey, keyFromQuery, grade, tierFor, scoreRun, linkFor,
} = Q;

const N = QUESTIONS.length;

/* ---------- question set ---------- */

test("question set has ten questions, each with four options", () => {
  assert.equal(N, 10);
  QUESTIONS.forEach((q, i) => {
    assert.equal(q.options.length, 4, `question ${i + 1} needs 4 options`);
    assert.ok(q.tag && q.tag.length > 0, `question ${i + 1} needs a tag`);
    assert.ok(q.text.endsWith("?"), `question ${i + 1} should read as a question`);
    assert.equal(new Set(q.options).size, 4, `question ${i + 1} has duplicate options`);
  });
  // no tag reused across the set
  assert.equal(new Set(QUESTIONS.map((q) => q.tag)).size, N);
});

test("the three originally requested topics are still in there", () => {
  assert.match(QUESTIONS[0].text, /microcontroller/i);
  assert.match(QUESTIONS[1].text, /programming language/i);
  assert.match(QUESTIONS[2].text, /2 AM/);
  assert.deepEqual(QUESTIONS.slice(0, 3).map((q) => q.tag), ["microcontroller", "language", "2 AM"]);
});

test("default key indexes a real option in every question", () => {
  assert.equal(DEFAULT_KEY.length, N);
  DEFAULT_KEY.forEach((v, i) => {
    assert.ok(Number.isInteger(v) && v >= 0 && v < QUESTIONS[i].options.length, `bad default at ${i}`);
  });
  assert.equal(QUESTIONS[0].options[DEFAULT_KEY[0]], "Arduino Uno");
  assert.equal(QUESTIONS[1].options[DEFAULT_KEY[1]], "Python");
  assert.match(QUESTIONS[2].options[DEFAULT_KEY[2]], /Debugging a bug/);
});

/* ---------- key parsing ---------- */

test("parseKey accepts a well-formed ten-value key", () => {
  assert.deepEqual(parseKey("3,2,1,0,3,2,1,0,3,2"), [3, 2, 1, 0, 3, 2, 1, 0, 3, 2]);
  assert.deepEqual(parseKey(" 1 , 0 , 3 , 2 , 2 , 1 , 2 , 1 , 1 , 0 "), [1, 0, 3, 2, 2, 1, 2, 1, 1, 0]);
  assert.deepEqual(parseKey(DEFAULT_KEY.join(",")), DEFAULT_KEY);
});

test("parseKey falls back to the default on garbage", () => {
  const cases = [
    "", "   ", undefined, null,
    "1,2",                       // too few
    DEFAULT_KEY.concat([0]).join(","), // too many
    Array(N).fill("a").join(","),      // not numbers
    "9" + ",0".repeat(N - 1),          // first index out of range
    "0,-1" + ",0".repeat(N - 2),       // negative
    "0.5" + ",0".repeat(N - 1),        // decimal must not be truncated to 0
    "1e2" + ",0".repeat(N - 1),        // exponent form must not parse
    ",0".repeat(N - 1) + ",",         // empty slot
    "0x1" + ",0".repeat(N - 1),        // hex must not parse
  ];
  for (const raw of cases) {
    assert.deepEqual(parseKey(raw), DEFAULT_KEY, `expected default for ${JSON.stringify(raw)}`);
  }
});

test("keyFromQuery handles ?key=, bare key=, sibling params and no key", () => {
  const k = "1,2,3,0,1,2,3,0,1,2";
  assert.deepEqual(keyFromQuery("?key=" + k), [1, 2, 3, 0, 1, 2, 3, 0, 1, 2]);
  assert.deepEqual(keyFromQuery("key=" + k), [1, 2, 3, 0, 1, 2, 3, 0, 1, 2]);
  assert.deepEqual(keyFromQuery("?utm_source=x&key=" + k + "&v=2"), [1, 2, 3, 0, 1, 2, 3, 0, 1, 2]);
  // the original game's query string must not break anything
  assert.deepEqual(keyFromQuery("?id=YlThkvA&q=m"), DEFAULT_KEY);
  assert.deepEqual(keyFromQuery(""), DEFAULT_KEY);
  assert.deepEqual(keyFromQuery(null), DEFAULT_KEY);
});

/* ---------- tiers ---------- */

test("tiers are ordered, cover 0..10, and only the top tier is 'safe'", () => {
  const mins = TIERS.map((t) => t.min);
  assert.deepEqual([...mins].sort((a, b) => a - b), mins, "TIERS must ascend by min");
  assert.equal(mins[0], 0, "lowest tier must start at 0");
  for (let s = 0; s <= N; s++) assert.ok(tierFor(s), "no tier for score " + s);
  // 9/10 gets the green "YOU'RE SAFE" stamp but scoreRun still flags it blocked
  assert.deepEqual([6, 7, 8].map(tierFor).map((t) => t.style), ["block", "block", "block"]);
  assert.equal(tierFor(9).style, "safe");
  assert.equal(tierFor(N).style, "safe");
});

test("tier boundaries: 5 blocked / 6 probation / 9 safe / 10 perfect", () => {
  assert.equal(tierFor(0).name, "BLOCKED");
  assert.equal(tierFor(5).name, "BLOCKED");
  assert.equal(tierFor(6).name, "PROBATION");
  assert.equal(tierFor(8).name, "PROBATION");
  assert.equal(tierFor(9).name, "YOU'RE SAFE");
  assert.equal(tierFor(10).name, "YOU'RE SAFE");
  // the 9 and the 10 must not share a verdict
  assert.notEqual(tierFor(9).verdict, tierFor(10).verdict);
});

/* ---------- grading ---------- */

function picksWithScore(want, key) {
  return key.map((k, i) => (i < want ? k : (k + 1) % 4));
}

test("scoreRun grades every possible score and only 10/10 is unblocked", () => {
  const key = DEFAULT_KEY;
  for (let want = 0; want <= N; want++) {
    const res = scoreRun(picksWithScore(want, key), key);
    assert.equal(res.score, want, "score mismatch for " + want);
    assert.equal(res.total, N);
    assert.equal(res.blocked, want < N, "blocked flag wrong at " + want);
    assert.equal(res.tier, tierFor(want).name);
    assert.equal(res.stamp, tierFor(want).name);
    assert.equal(res.stampStyle, tierFor(want).style);
    assert.equal(res.verdict, tierFor(want).verdict);
    assert.equal(res.rows.length, N);
    assert.equal(res.rows.filter((r) => r.right).length, want);
  }
});

test("scoreRun: perfect run against the default key", () => {
  const res = scoreRun(DEFAULT_KEY.slice(), DEFAULT_KEY);
  assert.equal(res.score, 10);
  assert.equal(res.blocked, false);
  assert.equal(res.stamp, "YOU'RE SAFE");
  assert.deepEqual(res.rows.map((r) => r.right), Array(N).fill(true));
  assert.match(res.verdict, /soldering iron/);
});

test("scoreRun: one mistake still blocks you, but lands in the safe tier copy", () => {
  const picks = DEFAULT_KEY.slice();
  picks[4] = (picks[4] + 1) % 4;
  const res = scoreRun(picks, DEFAULT_KEY);
  assert.equal(res.score, 9);
  assert.equal(res.blocked, true);
  assert.equal(res.tier, "YOU'RE SAFE");
  assert.deepEqual(res.rows.map((r) => r.right)[4], false);
});

test("grade exposes picked and correct option indexes per question", () => {
  const key = [3, 2, 1, 0, 3, 2, 1, 0, 3, 2];
  const picks = [0, 2, 1, 0, 3, 2, 1, 0, 3, 2];
  const rows = grade(picks, key);
  assert.deepEqual(rows.map((r) => r.picked), picks);
  assert.deepEqual(rows.map((r) => r.correct), key);
  assert.deepEqual(rows.map((r) => r.right), [false, true, true, true, true, true, true, true, true, true]);
  assert.equal(QUESTIONS[0].options[rows[0].picked], "Arduino Uno");
  assert.equal(QUESTIONS[0].options[rows[0].correct], "STM32 / AVR bare-metal");
});

test("scoreRun rejects malformed picks instead of silently scoring", () => {
  assert.throws(() => scoreRun(DEFAULT_KEY.slice(0, 9), DEFAULT_KEY), /expected 10 picks/);
  assert.throws(() => scoreRun(DEFAULT_KEY.concat([0]), DEFAULT_KEY), /expected 10 picks/);
  assert.throws(() => scoreRun(DEFAULT_KEY.map((v, i) => (i === 3 ? 9 : v)), DEFAULT_KEY), /out of range/);
  assert.throws(() => scoreRun(DEFAULT_KEY.map((v, i) => (i === 0 ? "1" : v)), DEFAULT_KEY), /out of range/);
  assert.throws(() => scoreRun(null, DEFAULT_KEY), /expected 10 picks/);
});

/* ---------- links ---------- */

test("linkFor bakes the key in and the URL round-trips back to the same key", () => {
  const key = [1, 2, 3, 0, 1, 2, 3, 0, 1, 2];
  const url = linkFor("https://example.test/index.html", key);
  assert.equal(url, "https://example.test/index.html?key=1,2,3,0,1,2,3,0,1,2");
  assert.deepEqual(keyFromQuery(url), key);
  assert.deepEqual(keyFromQuery("?" + url.split("?")[1]), key);
});
