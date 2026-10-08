/* ============================================================
   answers.html — link builder UI.
   Question data + key parsing come from ./quiz.js (window.DBM),
   the same module index.html and the tests use.
   ============================================================ */
(function () {
  "use strict";

  var DBM = window.DBM;
  var QUESTIONS = DBM.QUESTIONS;
  var LETTERS = ["A", "B", "C", "D"];
  var base = window.location.origin +
    window.location.pathname.replace(/answers\.html.*$/, "index.html");

  function $(id) { return document.getElementById(id); }
  function sel(i) { return $("k" + i); }

  QUESTIONS.forEach(function (q, i) {
    var html = "";
    q.options.forEach(function (o, j) {
      html += '<option value="' + j + '">' + LETTERS[j] + " &middot; " + o + "</option>";
    });
    sel(i).innerHTML = html;
    sel(i).addEventListener("change", update);
  });

  function currentKey() {
    return QUESTIONS.map(function (_, i) { return parseInt(sel(i).value, 10); });
  }
  function currentUrl() { return DBM.linkFor(base, currentKey()); }
  function update() { $("link").textContent = currentUrl(); }

  $("copy").addEventListener("click", function () {
    var url = currentUrl();
    var text = "3 questions about me. Get them wrong and you're blocked. " + url;
    if (navigator.share) {
      navigator.share({ title: "Don't Block Me", text: text, url: url })["catch"](function () {
        copyOut(text, url);
      });
      return;
    }
    copyOut(text, url);
  });

  $("test").addEventListener("click", function () { window.location.href = currentUrl(); });

  function copyOut(text, fallback) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { toast("Link copied"); },
        function () { toast(fallback); }
      );
      return;
    }
    toast(fallback);
  }

  function toast(m) {
    var t = $("toast");
    t.textContent = m;
    t.classList.add("on");
    setTimeout(function () { t.classList.remove("on"); }, 2000);
  }

  /* Prefill from an incoming ?key= using the same parser the quiz uses. */
  var incoming = DBM.keyFromQuery(window.location.search);
  incoming.forEach(function (v, i) { sel(i).value = String(v); });
  update();
})();
