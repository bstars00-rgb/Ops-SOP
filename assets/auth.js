/* ============================================================
   VNOP SOP Hub — login gate + client-side decryption
   The SOP data ships encrypted (window.SOP_ENC). It is decrypted
   in the browser only after the correct ID + password are entered.
   ============================================================ */
(function () {
  "use strict";

  var LANGS = ["en", "ko", "zh", "ja"];
  var I18N = window.I18N || {};
  var SS_KEY = "sop-pass";   // sessionStorage: remember unlock for the tab session

  function lang() {
    var l = document.documentElement.getAttribute("lang") || "en";
    return LANGS.indexOf(l) === -1 ? "en" : l;
  }
  function t(key) {
    var d = I18N[lang()] || I18N.en;
    return (d && d[key] != null) ? d[key] : (I18N.en[key] || key);
  }
  function $(s) { return document.querySelector(s); }

  // ---- base64 -> bytes ----
  function b64(str) {
    var bin = atob(str), out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  // ---- decrypt the SOP_ENC blob with id+password ----
  async function decrypt(blob, id, pw) {
    var pass = id.trim().toUpperCase() + ":" + pw.trim();
    var enc = new TextEncoder();
    var baseKey = await crypto.subtle.importKey(
      "raw", enc.encode(pass), "PBKDF2", false, ["deriveKey"]);
    var key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: b64(blob.salt), iterations: blob.iterations, hash: "SHA-256" },
      baseKey, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    var ptBuf = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64(blob.iv) }, key, b64(blob.ct));
    return new TextDecoder().decode(ptBuf);
  }

  // ---- apply decrypted data and start the app ----
  function launch(json) {
    var payload = JSON.parse(json);
    window.SOP_SECRET = payload.secret;
    window.SOP_CATEGORIES = payload.categories;
    window.SOP_DATA = payload.data;
    document.body.classList.remove("locked");
    var gate = $("#authGate");
    if (gate) gate.remove();
    if (typeof window.bootSOPApp === "function") window.bootSOPApp();
  }

  // ---- gate localization (app.js handles the unlocked UI) ----
  function localizeGate() {
    document.querySelectorAll("#authGate [data-i18n]").forEach(function (n) {
      var attr = n.getAttribute("data-i18n-attr");
      if (attr) n.setAttribute(attr, t(n.getAttribute("data-i18n")));
      else n.textContent = t(n.getAttribute("data-i18n"));
    });
    document.title = t("appTitle");
  }

  // ---- global theme toggle (works on gate and in-app) ----
  function bindTheme() {
    document.addEventListener("click", function (e) {
      var btn = e.target.closest && e.target.closest(".js-theme-toggle");
      if (!btn) return;
      var cur = document.documentElement.getAttribute("data-theme");
      var next = cur === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      try { localStorage.setItem("sop-theme", next); } catch (e2) {}
    });
  }

  // ---- gate language picker ----
  function buildGateLang() {
    var sel = $("#gateLang");
    if (!sel) return;
    sel.innerHTML = LANGS.map(function (l) {
      var name = (I18N[l] && I18N[l]._name) || l;
      return '<option value="' + l + '"' + (l === lang() ? " selected" : "") + ">" + name + "</option>";
    }).join("");
    sel.addEventListener("change", function () {
      var l = LANGS.indexOf(sel.value) === -1 ? "en" : sel.value;
      document.documentElement.setAttribute("lang", l);
      try { localStorage.setItem("sop-lang", l); } catch (e) {}
      localizeGate();
    });
  }

  function showError(msg) {
    var e = $("#authError");
    e.textContent = msg; e.hidden = false;
  }

  function init() {
    bindTheme();
    buildGateLang();
    localizeGate();

    var form = $("#authForm");
    var idEl = $("#authId");
    var pwEl = $("#authPw");
    var btn = $("#authSubmit");

    if (!window.SOP_ENC) { showError("Encrypted data not found (data/sops.enc.js)."); return; }
    if (!(window.crypto && window.crypto.subtle)) { showError(t("cryptoUnsupported")); return; }

    function attempt(id, pw, opts) {
      opts = opts || {};
      btn.disabled = true;
      var prev = btn.textContent;
      btn.textContent = t("unlocking");
      return decrypt(window.SOP_ENC, id, pw).then(function (json) {
        try { sessionStorage.setItem(SS_KEY, JSON.stringify({ id: id, pw: pw })); } catch (e) {}
        launch(json);
      }).catch(function () {
        btn.disabled = false; btn.textContent = prev;
        if (!opts.silent) { showError(t("wrongCreds")); pwEl.value = ""; pwEl.focus(); }
      });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      $("#authError").hidden = true;
      attempt(idEl.value, pwEl.value);
    });

    // Auto-unlock if this tab session already authenticated.
    try {
      var saved = sessionStorage.getItem(SS_KEY);
      if (saved) {
        var c = JSON.parse(saved);
        attempt(c.id, c.pw, { silent: true });
      } else {
        idEl.focus();
      }
    } catch (e) { idEl.focus(); }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
