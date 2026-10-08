/* ============================================================
   Don't Block Me — Engineer Edition
   Shared quiz logic. Loaded by index.html as <script defer> and
   by the Node test suite via require(). Keep the two entry points
   pointing at this one file so tests exercise the shipped code.
   ============================================================ */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DBM = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const QUESTIONS = [
    {
      tag: "microcontroller",
      text: "Which microcontroller do I actually like?",
      options: [
        "Arduino Uno",
        "ESP32",
        "Raspberry Pi Pico (RP2040)",
        "STM32 / AVR bare-metal",
      ],
    },
    {
      tag: "language",
      text: "What programming language do I reach for first?",
      options: ["C / C++", "Python", "Rust", "MicroPython"],
    },
    {
      tag: "2 AM",
      text: "It's 2 AM. What am I doing?",
      options: [
        "Debugging a bug I created at 1 AM",
        "Redesigning a PCB for the 4th time",
        "Reading docs & falling down rabbit holes",
        "Honestly? Sleeping, like a functioning human",
      ],
    },
  ];

  /** Default answer key: index into each question's options. */
  const DEFAULT_KEY = [0, 1, 0];

  const VERDICTS = [
    "Zero. You have clearly never once listened to a word I said. Enjoy the void.",
    "One out of three. That is the score of someone who nods during conversations.",
    "Two out of three. Close. Close is still blocked, though. Sorry.",
    "Perfect. You actually know me. Fine — you stay in the group chat.",
  ];

  /**
   * Parse a raw ?key= value into a valid key array.
   * Returns DEFAULT_KEY for anything missing, malformed or out of range.
   * Strictly digit-only: "0.5" or "1e2" are rejected rather than truncated.
   */
  function parseKey(raw) {
    if (raw === undefined || raw === null || String(raw).trim() === "") {
      return DEFAULT_KEY.slice();
    }
    const parts = String(raw).split(",");
    if (parts.length !== QUESTIONS.length) return DEFAULT_KEY.slice();

    const nums = parts.map((v) => {
      const s = String(v).trim();
      return /^\d+$/.test(s) ? parseInt(s, 10) : NaN;
    });
    const valid = nums.every(
      (v, i) => Number.isInteger(v) && v >= 0 && v < QUESTIONS[i].options.length
    );
    return valid ? nums : DEFAULT_KEY.slice();
  }

  /** Read the key from a query string ("key=1,2,0" or "?key=1,2,0" or full URL). */
  function keyFromQuery(query) {
    const q = String(query == null ? "" : query);
    const clean = q.indexOf("?") === 0 ? q.slice(1) : q;
    const pair = clean.split("&").find((p) => p.split("=")[0] === "key");
    return parseKey(pair === undefined ? "" : decodeURIComponent(pair.split("=")[1] || ""));
  }

  /** Per-question correctness: [{ picked, correct, right }]. */
  function grade(picks, key) {
    return QUESTIONS.map((q, i) => ({
      picked: picks[i],
      correct: key[i],
      right: picks[i] === key[i],
    }));
  }

  /**
   * Grade a full run and build everything the result screen needs.
   * Throws if `picks` isn't one valid option index per question.
   */
  function scoreRun(picks, key) {
    if (!Array.isArray(picks) || picks.length !== QUESTIONS.length) {
      throw new Error("scoreRun: expected " + QUESTIONS.length + " picks, got " + JSON.stringify(picks));
    }
    const ok = picks.every(
      (p, i) => Number.isInteger(p) && p >= 0 && p < QUESTIONS[i].options.length
    );
    if (!ok) throw new Error("scoreRun: pick out of range: " + JSON.stringify(picks));

    const rows = grade(picks, key);
    const score = rows.reduce((n, r) => n + (r.right ? 1 : 0), 0);
    const total = QUESTIONS.length;

    return {
      score: score,
      total: total,
      blocked: score < total,
      verdict: VERDICTS[score],
      stamp: score < total ? "BLOCKED" : "YOU'RE SAFE",
      rows: rows,
    };
  }

  /** Build the share URL for a given key. */
  function linkFor(baseUrl, key) {
    return baseUrl + "?key=" + key.join(",");
  }

  return { QUESTIONS, DEFAULT_KEY, VERDICTS, parseKey, keyFromQuery, grade, scoreRun, linkFor };
});
