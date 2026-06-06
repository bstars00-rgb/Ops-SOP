/* ============================================================
   VNOP SOP Hub — app logic (vanilla JS, no build step)
   ============================================================ */
// Booted by assets/auth.js AFTER the SOP data is decrypted and placed on window.
window.bootSOPApp = function () {
  "use strict";
  if (window.__sopBooted) return;   // guard against double-boot
  window.__sopBooted = true;

  var LANGS = ["en", "ko", "zh", "ja"];
  var state = {
    lang: document.documentElement.getAttribute("lang") || "en",
    cat: "all",
    query: ""
  };
  if (LANGS.indexOf(state.lang) === -1) state.lang = "en";

  var SOPS = window.SOP_DATA || [];
  var CATS = window.SOP_CATEGORIES || [];
  var I18N = window.I18N || {};

  // ---- element refs ----
  var $ = function (sel) { return document.querySelector(sel); };
  var listView   = $("#listView");
  var detailView = $("#detailView");
  var cardGrid   = $("#cardGrid");
  var filters    = $("#filters");
  var searchInput= $("#searchInput");
  var searchClear= $("#searchClear");
  var resultCount= $("#resultCount");
  var emptyState = $("#emptyState");
  var langSelect = $("#langSelect");
  var toastEl    = $("#toast");

  // ---- helpers ----
  function t(key) {
    var dict = I18N[state.lang] || I18N.en;
    return (dict && dict[key] != null) ? dict[key] : (I18N.en[key] || key);
  }
  function tr(obj) { // translate a {en,ko,zh,ja} object with fallback
    if (!obj) return "";
    return obj[state.lang] || obj.en || "";
  }
  function bodyOf(s) { // blocks array for the active language (en fallback)
    var b = s.body;
    if (Array.isArray(b)) return b;            // legacy shape
    if (!b) return [];
    return b[state.lang] || b.en || [];
  }
  function purposeOf(s) {
    return typeof s.purpose === "string" ? s.purpose : tr(s.purpose);
  }
  function catLabel(id) {
    var c = CATS.find(function (x) { return x.id === id; });
    return c ? tr(c.label) : id;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  // ---- toast ----
  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.hidden = false;
    requestAnimationFrame(function () { toastEl.classList.add("show"); });
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () {
      toastEl.classList.remove("show");
      setTimeout(function () { toastEl.hidden = true; }, 250);
    }, 1800);
  }

  // (theme toggle is wired globally in assets/auth.js so it works on the gate too)

  // ---- search index ----
  function indexText(s) {
    var parts = [s.id];
    LANGS.forEach(function (l) {
      if (s.title[l]) parts.push(s.title[l]);
      if (s.summary && s.summary[l]) parts.push(s.summary[l]);
      if (s.purpose && s.purpose[l]) parts.push(s.purpose[l]);
      var blk = s.body && (Array.isArray(s.body) ? (l === "en" ? s.body : null) : s.body[l]);
      if (blk) blk.forEach(function (b) { parts.push(flattenBlock(b)); });
    });
    if (typeof s.purpose === "string") parts.push(s.purpose);
    if (s.tags) parts.push(s.tags.join(" "));
    if (s.applicable) parts.push(s.applicable);
    return parts.join("  ").toLowerCase();
  }
  function flattenBlock(b) {
    var out = [];
    if (b.text) out.push(b.text);
    if (b.title) out.push(b.title);
    if (b.lines) out.push(b.lines.join(" "));
    if (b.items) out.push(b.items.join(" "));
    if (b.head) out.push(b.head.join(" "));
    if (b.rows) b.rows.forEach(function (r) { out.push(r.join(" ")); });
    return out.join(" ");
  }
  SOPS.forEach(function (s) { s._index = indexText(s); });

  function highlight(text, q) {
    if (!q) return esc(text);
    var safe = esc(text);
    var needle = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    try {
      return safe.replace(new RegExp("(" + needle + ")", "ig"), "<mark>$1</mark>");
    } catch (e) { return safe; }
  }

  // ---- filtering ----
  function filtered() {
    var q = state.query.trim().toLowerCase();
    return SOPS.filter(function (s) {
      if (state.cat !== "all" && s.cat !== state.cat) return false;
      if (q && s._index.indexOf(q) === -1) return false;
      return true;
    });
  }

  // ---- render: filters ----
  function renderFilters() {
    filters.innerHTML = "";
    var defs = [{ id: "all", label: t("allCategories") }].concat(
      CATS.map(function (c) { return { id: c.id, label: tr(c.label) }; })
    );
    defs.forEach(function (d) {
      var count = d.id === "all" ? SOPS.length
        : SOPS.filter(function (s) { return s.cat === d.id; }).length;
      var btn = el("button", "chip");
      btn.type = "button";
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", state.cat === d.id ? "true" : "false");
      if (d.id !== "all") btn.style.setProperty("color", "var(--cat-" + d.id + ")");
      btn.innerHTML = (d.id !== "all" ? '<span class="dot"></span>' : "") +
        esc(d.label) + ' <span class="chip-count">' + count + "</span>";
      btn.addEventListener("click", function () {
        state.cat = d.id;
        renderFilters();
        renderList();
      });
      filters.appendChild(btn);
    });
  }

  // ---- render: card list ----
  function renderList() {
    var rows = filtered();
    var q = state.query.trim();
    cardGrid.innerHTML = "";

    if (!rows.length) {
      emptyState.hidden = false;
      resultCount.textContent = "";
      return;
    }
    emptyState.hidden = true;
    resultCount.textContent = rows.length + " " +
      (rows.length === 1 ? t("result") : t("results"));

    rows.forEach(function (s) {
      var card = el("button", "card");
      card.type = "button";
      card.style.setProperty("--cat", "var(--cat-" + s.cat + ")");
      card.setAttribute("aria-label", s.id + " " + tr(s.title));
      card.innerHTML =
        '<div class="card-top">' +
          '<span class="card-id">' + esc(s.id) + "</span>" +
          '<span class="card-cat">' + esc(catLabel(s.cat)) + "</span>" +
        "</div>" +
        '<h2 class="card-title">' + highlight(tr(s.title), q) + "</h2>" +
        '<p class="card-summary">' + highlight(tr(s.summary), q) + "</p>" +
        '<div class="card-tags">' +
          (s.tags || []).slice(0, 4).map(function (tg) {
            return '<span class="tag">' + esc(tg) + "</span>";
          }).join("") +
        "</div>";
      card.addEventListener("click", function () { go(s.id); });
      cardGrid.appendChild(card);
    });
  }

  // ---- render: block ----
  function renderBlock(b) {
    switch (b.t) {
      case "h":
        return '<h3 class="sec-title" id="' + slug(b.text) + '">' + esc(b.text) + "</h3>";
      case "para":
        return "<p>" + esc(b.text) + "</p>";
      case "list":
        var tag = b.ordered ? "ol" : "ul";
        return "<" + tag + ">" + b.items.map(function (i) {
          return "<li>" + esc(i) + "</li>";
        }).join("") + "</" + tag + ">";
      case "table":
        return '<div class="tbl-wrap"><table><thead><tr>' +
          b.head.map(function (h) { return "<th>" + esc(h) + "</th>"; }).join("") +
          "</tr></thead><tbody>" +
          b.rows.map(function (r) {
            return "<tr>" + r.map(function (c) { return "<td>" + esc(c) + "</td>"; }).join("") + "</tr>";
          }).join("") +
          "</tbody></table></div>";
      case "callout":
        var icon = { info: "ℹ️", warn: "⚠️", critical: "⛔", note: "📌", tip: "💡" }[b.v] || "ℹ️";
        return '<div class="callout ' + esc(b.v) + '">' +
          (b.title ? '<p class="callout-title">' + icon + " " + esc(b.title) + "</p>" : "") +
          (b.lines || []).map(function (l) { return "<p>" + esc(l) + "</p>"; }).join("") +
          "</div>";
      case "kv":
        return '<div class="kv">' +
          (b.title ? '<p class="kv-title">' + esc(b.title) + "</p>" : "") +
          b.rows.map(function (r) {
            return '<div class="kv-row"><span class="kv-k">' + esc(r[0]) +
                   '</span><span class="kv-v">' + esc(r[1]) + "</span></div>";
          }).join("") + "</div>";
      case "checklist":
        return '<ul class="checklist">' +
          b.items.map(function (i) { return "<li>" + esc(i) + "</li>"; }).join("") + "</ul>";
      default:
        return "";
    }
  }
  function slug(s) {
    return "sec-" + String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  }

  // ---- render: detail ----
  function renderDetail(s) {
    var blocks = bodyOf(s);
    var headings = blocks.filter(function (b) { return b.t === "h"; });
    var meta = [];
    meta.push(metaItem(t("version"), s.version));
    if (s.effective) meta.push(metaItem(t("effective"), s.effective));
    if (s.revised)   meta.push(metaItem(t("revised"), s.revised));
    if (s.by)        meta.push(metaItem(t("preparedBy"), s.by));
    if (s.applicable) meta.push(metaItem(t("appliesTo"), s.applicable));
    if (s.related)    meta.push(metaItem(t("relatedSop"), s.related));

    var isFallback = !Array.isArray(s.body) && s.body && !s.body[state.lang] && state.lang !== "en";
    var untranslatedNote = isFallback
      ? '<div class="untranslated-flag">' + esc(t("untranslated")) + "</div>" : "";

    detailView.innerHTML =
      '<button class="back-btn" id="backBtn" type="button">← ' + esc(t("backToList")) + "</button>" +
      '<div class="detail-head" style="--cat:var(--cat-' + s.cat + ')">' +
        '<div class="detail-eyebrow">' +
          '<span class="detail-id">' + esc(s.id) + "</span>" +
          '<span class="detail-cat">' + esc(catLabel(s.cat)) + "</span>" +
        "</div>" +
        '<h1 class="detail-title">' + esc(tr(s.title)) + "</h1>" +
        '<div class="meta-grid">' + meta.join("") + "</div>" +
      "</div>" +
      '<div class="detail-actions">' +
        '<button class="btn" id="printBtn" type="button">🖨 ' + esc(t("print")) + "</button>" +
        '<button class="btn" id="copyBtn" type="button">🔗 ' + esc(t("copyLink")) + "</button>" +
      "</div>" +
      untranslatedNote +
      '<div class="detail-body">' +
        (headings.length > 2 ? buildQuickNav(headings) : "") +
        '<div class="content">' +
          '<h3 class="sec-title">' + esc(t("purpose")) + "</h3>" +
          "<p>" + esc(purposeOf(s)) + "</p>" +
          blocks.map(renderBlock).join("") +
        "</div>" +
      "</div>";

    detailView.querySelector("#backBtn").addEventListener("click", function () { go(""); });
    detailView.querySelector("#printBtn").addEventListener("click", function () { window.print(); });
    detailView.querySelector("#copyBtn").addEventListener("click", function () {
      var url = location.href;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () { toast(t("linkCopied")); },
                                                 function () { toast(url); });
      } else { toast(url); }
    });
    wireQuickNav();
  }
  function metaItem(k, v) {
    return '<div class="meta-item"><span class="meta-k">' + esc(k) +
           '</span><span class="meta-v">' + esc(v) + "</span></div>";
  }
  function buildQuickNav(headings) {
    return '<nav class="quicknav" aria-label="' + esc(t("quickNav")) + '">' +
      "<h3>" + esc(t("quickNav")) + "</h3>" +
      headings.map(function (h) {
        return '<a href="#' + slug(h.text) + '">' + esc(h.text) + "</a>";
      }).join("") + "</nav>";
  }
  function wireQuickNav() {
    var links = detailView.querySelectorAll(".quicknav a");
    if (!links.length) return;
    links.forEach(function (a) {
      a.addEventListener("click", function (e) {
        e.preventDefault();
        var id = a.getAttribute("href").slice(1);
        var target = document.getElementById(id);
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  // ---- routing ----
  function go(id) {
    if (id) location.hash = "/sop/" + id;
    else location.hash = "";
    route();
  }
  function route() {
    var hash = location.hash.replace(/^#/, "");
    var m = hash.match(/^\/sop\/(SOP-\d+)/i);
    if (m) {
      var s = SOPS.find(function (x) { return x.id.toLowerCase() === m[1].toLowerCase(); });
      if (s) {
        listView.hidden = true;
        detailView.hidden = false;
        renderDetail(s);
        window.scrollTo(0, 0);
        return;
      }
    }
    detailView.hidden = true;
    listView.hidden = false;
  }
  window.addEventListener("hashchange", route);

  // ---- language ----
  function applyI18n() {
    document.documentElement.setAttribute("lang", state.lang);
    document.querySelectorAll("[data-i18n]").forEach(function (node) {
      var key = node.getAttribute("data-i18n");
      var attr = node.getAttribute("data-i18n-attr");
      if (attr) node.setAttribute(attr, t(key));
      else node.textContent = t(key);
    });
    document.title = t("appTitle");
  }
  function setLang(lang) {
    if (LANGS.indexOf(lang) === -1) lang = "en";
    state.lang = lang;
    try { localStorage.setItem("sop-lang", lang); } catch (e) {}
    applyI18n();
    renderFilters();
    // Re-render both views so neither holds stale-language content.
    renderList();
    if (!detailView.hidden) route();
  }
  function buildLangSelect() {
    langSelect.innerHTML = LANGS.map(function (l) {
      var name = (I18N[l] && I18N[l]._name) || l;
      return '<option value="' + l + '"' + (l === state.lang ? " selected" : "") + ">" +
             esc(name) + "</option>";
    }).join("");
    langSelect.addEventListener("change", function () { setLang(langSelect.value); });
  }

  // ---- search wiring ----
  var debounce;
  searchInput.addEventListener("input", function () {
    state.query = searchInput.value;
    searchClear.hidden = !state.query;
    clearTimeout(debounce);
    debounce = setTimeout(renderList, 120);
  });
  searchClear.addEventListener("click", function () {
    state.query = "";
    searchInput.value = "";
    searchClear.hidden = true;
    searchInput.focus();
    renderList();
  });
  $("#brandHome").addEventListener("click", function () {
    state.query = ""; searchInput.value = ""; searchClear.hidden = true;
    state.cat = "all";
    go("");
    renderFilters(); renderList();
  });
  // "/" focuses search
  document.addEventListener("keydown", function (e) {
    if (e.key === "/" && document.activeElement !== searchInput && detailView.hidden) {
      e.preventDefault(); searchInput.focus();
    }
    if (e.key === "Escape" && document.activeElement === searchInput && state.query) {
      searchClear.click();
    }
  });

  // ---- init ----
  buildLangSelect();
  applyI18n();
  renderFilters();
  renderList();
  route();
};
