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
    {
      tag: "editor",
      text: "What do I actually write code in?",
      options: ["VS Code", "Vim / Neovim", "PlatformIO", "Arduino IDE, unironically"],
    },
    {
      tag: "OS",
      text: "Which OS runs my main machine?",
      options: ["Windows 11", "macOS", "Linux", "Dual boot, depending on the mood"],
    },
    {
      tag: "git habits",
      text: "Be honest about my commit history — what does it look like?",
      options: [
        "Clean, atomic, well-described commits",
        "\"fix\", \"fix2\", \"final\", \"FINAL_v2\"",
        "One giant commit at the end of the project",
        "I mostly push straight to main and pray",
      ],
    },
    {
      tag: "debugging",
      text: "How do I debug hardware?",
      options: [
        "Logic analyser, like a professional",
        "Oscilloscope, if I can find the probes",
        "Serial print spam until something looks wrong",
        "Swap components until it stops misbehaving",
      ],
    },
    {
      tag: "side project",
      text: "What's the state of my side projects?",
      options: [
        "I finish what I start",
        "Half-finished repo graveyard",
        "One big project I've been \"about to finish\" for years",
        "I don't have side projects, I have a job",
      ],
    },
    {
      tag: "soldering",
      text: "How do I feel about soldering?",
      options: [
        "Love it — give me 0402 and no fear",
        "Fine with through-hole, SMD is a negotiation",
        "Only with a microscope and a lot of patience",
        "I outsource it, hands off my board",
      ],
    },
    {
      tag: "bus",
      text: "Which bus do I actually enjoy working with?",
      options: ["I²C", "SPI", "UART", "CAN — because I like suffering"],
    },
  ];

  /** Default answer key: one option index per question. */
  const DEFAULT_KEY = [0, 1, 0, 0, 2, 1, 2, 1, 1, 0];

  /**
   * Score tiers. `min` is inclusive; highest matching tier wins.
   * Only a full score keeps you unblocked.
   */
  const TIERS = [
    {
      min: 0,
      name: "BLOCKED",
      style: "block",
      verdict:
        "Zero. You have clearly never once listened to a word I said. Enjoy the void.",
    },
    {
      min: 3,
      name: "BLOCKED",
      style: "block",
      verdict:
        "You know roughly a third of me. That's the score of someone who nods during conversations and hears none of it.",
    },
    {
      min: 6,
      name: "PROBATION",
      style: "block",
      verdict:
        "You pay attention sometimes. That earns you probation, not a pass — the block stays, but it's a soft one.",
    },
    {
      min: 9,
      name: "YOU'RE SAFE",
      style: "safe",
      verdict:
        "One slip. Suspicious, but I'll let it slide — you're still in the group chat.",
    },
    {
      min: 10,
      name: "YOU'RE SAFE",
      style: "safe",
      verdict:
        "Perfect. You actually know me. Fine — you stay in the group chat, and you're carrying the soldering iron next time.",
    },
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

  /** Read the key from a query string ("key=1,2,…" or "?key=…" or a full URL). */
  function keyFromQuery(query) {
    const q = String(query == null ? "" : query);
    // keep only what follows the last "?" — this also accepts a full URL,
    // which is what the share button produces and hands back to us
    const at = q.lastIndexOf("?");
    const clean = at === -1 ? q : q.slice(at + 1);
    const pair = clean
      .split("&")
      .map((p) => p.split("="))
      .find((kv) => kv[0] === "key");
    return parseKey(pair === undefined ? "" : decodeURIComponent(pair[1] || ""));
  }

  /** Per-question correctness: [{ picked, correct, right }]. */
  function grade(picks, key) {
    return QUESTIONS.map((q, i) => ({
      picked: picks[i],
      correct: key[i],
      right: picks[i] === key[i],
    }));
  }

  /** Highest tier whose `min` the score reaches. */
  function tierFor(score) {
    let found = TIERS[0];
    TIERS.forEach((t) => { if (score >= t.min) found = t; });
    return found;
  }

  /**
   * Grade a full run and build everything the result screen needs.
   * Throws if `picks` isn't one valid option index per question.
   */
  function scoreRun(picks, key) {
    if (!Array.isArray(picks) || picks.length !== QUESTIONS.length) {
      throw new Error(
        "scoreRun: expected " + QUESTIONS.length + " picks, got " + JSON.stringify(picks)
      );
    }
    const ok = picks.every(
      (p, i) => Number.isInteger(p) && p >= 0 && p < QUESTIONS[i].options.length
    );
    if (!ok) throw new Error("scoreRun: pick out of range: " + JSON.stringify(picks));

    const rows = grade(picks, key);
    const score = rows.reduce((n, r) => n + (r.right ? 1 : 0), 0);
    const total = QUESTIONS.length;
    const tier = tierFor(score);

    return {
      score: score,
      total: total,
      blocked: score < total,
      tier: tier.name,
      verdict: tier.verdict,
      stamp: tier.name,
      stampStyle: tier.style,
      rows: rows,
    };
  }

  /** Build the share URL for a given key. */
  function linkFor(baseUrl, key) {
    return baseUrl + "?key=" + key.join(",");
  }

  return {
    QUESTIONS,
    DEFAULT_KEY,
    TIERS,
    parseKey,
    keyFromQuery,
    grade,
    tierFor,
    scoreRun,
    linkFor,
  };
});
