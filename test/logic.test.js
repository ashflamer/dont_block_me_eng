/* Pure-logic tests against js/quiz.js — the same module index.html loads. */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { QUESTIONS, DEFAULT_KEY, parseKey, keyFromQuery, scoreRun, linkFor } = require("../js/quiz.js");

test("question set is exactly the three requested topics", () => {
  assert.equal(QUESTIONS.length, 3);
  assert.deepEqual(
    QUESTIONS.map((q) => q.tag),
    ["microcontroller", "language", "2 AM"]
  );
  assert.match(QUESTIONS[0].text, /microcontroller/i);
  assert.match(QUESTIONS[1].text, /programming language/i);
  assert.match(QUESTIONS[2].text, /2 AM/);
  QUESTIONS.forEach((q) => assert.equal(q.options.length, 4, q.tag));
});

test("default key indexes real options", () => {
  assert.equal(DEFAULT_KEY.length, QUESTIONS.length);
  DEFAULT_KEY.forEach((v, i) => {
    assert.ok(v >= 0 && v < QUESTIONS[i].options.length, `bad default at ${i}`);
  });
  assert.equal(QUESTIONS[0].options[DEFAULT_KEY[0]], "Arduino Uno");
  assert.equal(QUESTIONS[1].options[DEFAULT_KEY[1]], "Python");
});

test("parseKey accepts a well-formed key", () => {
  assert.deepEqual(parseKey("3,2,1"), [3, 2, 1]);
  assert.deepEqual(parseKey(" 1 , 0 , 3 "), [1, 0, 3]);
});

test("parseKey falls back to the default on garbage", () => {
  const cases = ["", "   ", undefined, null, "1,2", "1,2,3,4", "a,b,c", "9,0,0", "0,-1,0", "0.5,0,0", "1e2,0,0", "0,0,"];
  for (const raw of cases) {
    assert.deepEqual(parseKey(raw), DEFAULT_KEY, `expected default for ${JSON.stringify(raw)}`);
  }
});

test("keyFromQuery handles ?key=, bare key=, extra params and no key", () => {
  assert.deepEqual(keyFromQuery("?key=1,2,3"), [1, 2, 3]);
  assert.deepEqual(keyFromQuery("key=2,1,0"), [2, 1, 0]);
  assert.deepEqual(keyFromQuery("?utm_source=x&key=3,3,3&v=2"), [3, 3, 3]);
  assert.deepEqual(keyFromQuery("?id=YlThkvA&q=m"), DEFAULT_KEY);
  assert.deepEqual(keyFromQuery(""), DEFAULT_KEY);
});

test("scoreRun: perfect run is not blocked, stamps YOU'RE SAFE", () => {
  const res = scoreRun([1, 2, 3], [1, 2, 3]);
  assert.equal(res.score, 3);
  assert.equal(res.blocked, false);
  assert.equal(res.stamp, "YOU'RE SAFE");
  assert.deepEqual(res.rows.map((r) => r.right), [true, true, true]);
  assert.equal(res.rows[0].correct, 1);
});

test("scoreRun: one mistake blocks you", () => {
  const res = scoreRun([1, 2, 0], [1, 2, 3]);
  assert.equal(res.score, 2);
  assert.equal(res.blocked, true);
  assert.equal(res.stamp, "BLOCKED");
  assert.deepEqual(res.rows.map((r) => r.right), [true, true, false]);
  assert.match(res.verdict, /Two out of three/);
});

test("scoreRun: every score maps to its own verdict and all are blocked except 3/3", () => {
  const key = [0, 1, 2];
  [0, 1, 2, 3].forEach((want) => {
    const picks = key.map((k, i) => (i < want ? k : (k + 1) % 4));
    const res = scoreRun(picks, key);
    assert.equal(res.score, want);
    assert.equal(res.total, 3);
    assert.equal(res.blocked, want < 3);
    assert.equal(res.verdict, require("../js/quiz.js").VERDICTS[want]);
  });
});

test("scoreRun: rows expose the picked and correct option index", () => {
  const res = scoreRun([0, 3, 1], [2, 3, 1]);
  assert.deepEqual(res.rows.map((r) => r.picked), [0, 3, 1]);
  assert.deepEqual(res.rows.map((r) => r.correct), [2, 3, 1]);
  assert.equal(QUESTIONS[0].options[res.rows[0].picked], "Arduino Uno");
  assert.equal(QUESTIONS[0].options[res.rows[0].correct], "Raspberry Pi Pico (RP2040)");
});

test("scoreRun rejects malformed picks instead of silently scoring", () => {
  assert.throws(() => scoreRun([0, 1], [0, 1, 0]), /expected 3 picks/);
  assert.throws(() => scoreRun([0, 1, 9], [0, 1, 0]), /out of range/);
  assert.throws(() => scoreRun([0, "1", 0], [0, 1, 0]), /out of range/);
});

test("linkFor bakes the key into the URL", () => {
  assert.equal(
    linkFor("https://example.test/index.html", [1, 2, 3]),
    "https://example.test/index.html?key=1,2,3"
  );
  const round = keyFromQuery("?" + linkFor("", [2, 0, 1]).split("?")[1]);
  assert.deepEqual(round, [2, 0, 1]);
});
