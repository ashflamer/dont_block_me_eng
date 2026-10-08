/* ============================================================
   UI controller. All quiz data + scoring comes from ./quiz.js
   (window.DBM) so the Node tests run the shipped logic.
   ============================================================ */
(function () {
  "use strict";

  var DBM = window.DBM;
  var QUESTIONS = DBM.QUESTIONS;
  var KEY = DBM.keyFromQuery(window.location.search);

  var LETTERS = ["A", "B", "C", "D"];
  var LS_KEY = "dbme_eng_runs_v1";
  var idx = 0;
  var picks = [];

  function $(id) { return document.getElementById(id); }

  function show(name) {
    var screens = document.querySelectorAll(".screen");
    for (var i = 0; i < screens.length; i++) screens[i].classList.remove("on");
    $("s-" + name).classList.add("on");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ---------- intro ---------- */
  $("btn-start").addEventListener("click", function () {
    idx = 0;
    picks = [];
    renderQ();
    show("quiz");
  });
  $("btn-quit").addEventListener("click", function () { show("intro"); });

  /* ---------- quiz ---------- */
  function renderQ() {
    var q = QUESTIONS[idx];
    $("qnum").textContent = idx + 1;
    $("qtag").textContent = q.tag;
    $("qtext").textContent = q.text;

    var pips = "";
    for (var i = 0; i < QUESTIONS.length; i++) {
      pips += '<div class="pip' + (i < idx ? " done" : "") + '"></div>';
    }
    $("meter").innerHTML = pips;

    var html = "";
    for (var j = 0; j < q.options.length; j++) {
      html += '<button class="opt" data-i="' + j + '">' +
        '<span class="letter">' + LETTERS[j] + "</span>" +
        "<span>" + q.options[j] + "</span></button>";
    }
    $("opts").innerHTML = html;

    var btns = $("opts").querySelectorAll(".opt");
    for (var k = 0; k < btns.length; k++) {
      btns[k].addEventListener("click", onPick);
    }
  }

  function onPick() {
    var chosen = parseInt(this.getAttribute("data-i"), 10);
    var btns = $("opts").querySelectorAll(".opt");
    for (var i = 0; i < btns.length; i++) btns[i].disabled = true;
    this.classList.add("sel");
    picks[idx] = chosen;

    var right = chosen === KEY[idx];
    this.classList.add(right ? "good" : "bad");
    this.insertAdjacentHTML("beforeend",
      '<span class="tag">' + (right ? "YES" : "NOPE") + "</span>");

    if (!right) {
      var truth = $("opts").querySelector('[data-i="' + KEY[idx] + '"]');
      truth.classList.add("good");
      truth.insertAdjacentHTML("beforeend", '<span class="tag">TRUTH</span>');
    }

    setTimeout(function () {
      idx++;
      if (idx < QUESTIONS.length) {
        renderQ();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        finish();
      }
    }, 1000);
  }

  /* ---------- result ---------- */
  function finish() {
    var res = DBM.scoreRun(picks, KEY);

    var stamp = $("stamp");
    stamp.className = "stamp " + (res.blocked ? "block" : "safe");
    stamp.textContent = res.stamp;

    $("scoreline").innerHTML = "You got <b>" + res.score + "</b> / " + res.total + " right";
    $("verdict").textContent = res.verdict;

    var rows = "";
    res.rows.forEach(function (r, i) {
      rows += "<tr>" +
        '<td><span class="qtitle">' + QUESTIONS[i].tag + "</span>" + QUESTIONS[i].text + "</td>" +
        "<td>" + QUESTIONS[i].options[r.picked] + "</td>" +
        "<td>" + QUESTIONS[i].options[r.correct] + "</td>" +
        '<td class="mark">' + (r.right ? "✅" : "❌") + "</td>" +
        "</tr>";
    });
    $("compare").innerHTML = rows;

    saveRun(res);
    renderBoard();

    show("result");
    if (!res.blocked) confetti();
  }

  /* ---------- local scoreboard ---------- */
  function runs() {
    try { return JSON.parse(localStorage.getItem(LS_KEY)) || []; }
    catch (e) { return []; }
  }

  function saveRun(res) {
    var list = runs();
    list.unshift({
      score: res.score,
      total: res.total,
      blocked: res.blocked,
      key: KEY.join(","),
      at: Date.now()
    });
    try { localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, 12))); } catch (e) {}
  }

  function renderBoard() {
    var list = runs();
    var html = "";
    list.forEach(function (r, i) {
      html += '<div class="brow' + (i === 0 ? " me" : "") + '">' +
        '<span class="dot' + (r.blocked ? " no" : "") + '"></span>' +
        "<span>" + (i === 0 ? "You, just now" : timeAgo(r.at)) + "</span>" +
        '<span class="sc">' + r.score + "/" + r.total + "</span></div>";
    });
    $("board").innerHTML = html;
    $("boardNote").textContent = list.length > 1
      ? "Stored only in this browser. Send the link around and compare screenshots."
      : "Only one attempt so far. Send this link to people who claim they know you.";
  }

  function timeAgo(t) {
    var m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return "Just now";
    if (m < 60) return m + " min ago";
    var h = Math.round(m / 60);
    if (h < 24) return h + " hr ago";
    return Math.round(h / 24) + " day(s) ago";
  }

  /* ---------- share ---------- */
  $("btn-share").addEventListener("click", function () {
    var url = DBM.linkFor(window.location.origin + window.location.pathname, KEY);
    var text = "3 questions about me. Get them wrong and you're blocked. " + url;
    if (navigator.share) {
      navigator.share({ title: "Don't Block Me", text: text, url: url })["catch"](function () {
        copyOut(text, url);
      });
      return;
    }
    copyOut(text, url);
  });

  function copyOut(text, fallback) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { toast("Link copied — send it to someone"); },
        function () { toast(fallback); }
      );
      return;
    }
    toast(fallback);
  }

  function toast(msg) {
    var t = $("toast");
    t.textContent = msg;
    t.classList.add("on");
    setTimeout(function () { t.classList.remove("on"); }, 2200);
  }

  /* ---------- confetti ---------- */
  function confetti() {
    var box = $("confetti");
    var colors = ["#0093ff", "#fc5286", "#ffcd20", "#137e3a", "#f77737", "#16213e"];
    box.innerHTML = "";
    for (var i = 0; i < 90; i++) {
      var p = document.createElement("i");
      p.style.left = Math.random() * 100 + "vw";
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = 2.2 + Math.random() * 2 + "s";
      p.style.animationDelay = Math.random() * 0.8 + "s";
      p.style.opacity = ".85";
      box.appendChild(p);
    }
    setTimeout(function () { box.innerHTML = ""; }, 5200);
  }
})();
