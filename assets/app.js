/* ============================================================
   VNOP SOP Hub — app logic (vanilla JS, no build step)
   ============================================================ */
// Booted by assets/auth.js AFTER the SOP data is decrypted and placed on window.
window.bootSOPApp = function () {
  "use strict";
  if (window.__sopBooted) return;   // guard against double-boot
  window.__sopBooted = true;

  var LANGS = ["en", "ko", "zh", "ja", "vi"];
  var state = {
    lang: document.documentElement.getAttribute("lang") || "en",
    cat: "all",
    query: ""
  };
  if (LANGS.indexOf(state.lang) === -1) state.lang = "en";

  var SOPS = window.SOP_DATA || [];
  var CATS = window.SOP_CATEGORIES || [];
  var I18N = window.I18N || {};
  var GLOSSARY = window.SOP_GLOSSARY || [];
  var TREES = window.SOP_TREES || {};

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

  // ---- favorites & recently viewed (localStorage) ----
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || "[]"); } catch (e) { return []; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function getFavs() { return lsGet("sop-fav"); }
  function isFav(id) { return getFavs().indexOf(id) !== -1; }
  function toggleFav(id) {
    var f = getFavs(), i = f.indexOf(id);
    if (i === -1) f.push(id); else f.splice(i, 1);
    lsSet("sop-fav", f);
    return i === -1;
  }
  function pushRecent(id) {
    var r = lsGet("sop-recent").filter(function (x) { return x !== id; });
    r.unshift(id);
    lsSet("sop-recent", r.slice(0, 8));
  }
  function getRecent() { return lsGet("sop-recent"); }

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
    var favs = state.cat === "fav" ? getFavs() : null;
    return SOPS.filter(function (s) {
      if (state.cat === "fav") { if (favs.indexOf(s.id) === -1) return false; }
      else if (state.cat !== "all" && s.cat !== state.cat) return false;
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
    if (getFavs().length) defs.push({ id: "fav", label: "★ " + t("favorites") });
    defs.forEach(function (d) {
      var count = d.id === "all" ? SOPS.length
        : d.id === "fav" ? getFavs().length
        : SOPS.filter(function (s) { return s.cat === d.id; }).length;
      var btn = el("button", "chip");
      btn.type = "button";
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", state.cat === d.id ? "true" : "false");
      var isCat = d.id !== "all" && d.id !== "fav";
      if (isCat) btn.style.setProperty("color", "var(--cat-" + d.id + ")");
      btn.innerHTML = (isCat ? '<span class="dot"></span>' : "") +
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
  function renderRecentStrip() {
    var strip = $("#recentStrip");
    if (!strip) return;
    var ids = getRecent().filter(function (id) { return SOPS.some(function (s) { return s.id === id; }); });
    var show = ids.length && state.cat === "all" && !state.query.trim();
    if (!show) { strip.hidden = true; strip.innerHTML = ""; return; }
    strip.hidden = false;
    strip.innerHTML = '<span class="recent-label">' + esc(t("recent")) + "</span>" +
      ids.slice(0, 6).map(function (id) {
        var s = SOPS.find(function (x) { return x.id === id; });
        return '<button class="recent-chip" type="button" data-id="' + id + '">' +
          esc(id) + ' · ' + esc(tr(s.title)) + "</button>";
      }).join("");
    strip.querySelectorAll(".recent-chip").forEach(function (b) {
      b.addEventListener("click", function () { go(b.getAttribute("data-id")); });
    });
  }

  function renderList() {
    if (state.cat === "fav" && !getFavs().length) state.cat = "all";
    var rows = filtered();
    var q = state.query.trim();
    renderRecentStrip();
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
      var card = el("div", "card");
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");
      card.style.setProperty("--cat", "var(--cat-" + s.cat + ")");
      card.setAttribute("aria-label", s.id + " " + tr(s.title));
      var fav = isFav(s.id);
      card.innerHTML =
        '<div class="card-top">' +
          '<span class="card-id">' + esc(s.id) + "</span>" +
          '<span class="card-top-right">' +
            '<span class="card-cat">' + esc(catLabel(s.cat)) + "</span>" +
            '<button class="fav-star' + (fav ? " on" : "") + '" type="button" aria-pressed="' + fav +
              '" aria-label="' + esc(t(fav ? "removeFav" : "addFav")) + '">' + (fav ? "★" : "☆") + "</button>" +
          "</span>" +
        "</div>" +
        '<h2 class="card-title">' + highlight(tr(s.title), q) + "</h2>" +
        '<p class="card-summary">' + highlight(tr(s.summary), q) + "</p>" +
        '<div class="card-tags">' +
          (s.tags || []).slice(0, 4).map(function (tg) {
            return '<span class="tag">' + esc(tg) + "</span>";
          }).join("") +
        "</div>";
      card.addEventListener("click", function () { go(s.id); });
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(s.id); }
      });
      card.querySelector(".fav-star").addEventListener("click", function (e) {
        e.stopPropagation();
        toggleFav(s.id);
        renderFilters();
        renderList();
      });
      cardGrid.appendChild(card);
    });
  }

  // ---- render: block ----
  function renderBlock(b, idx) {
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
        return '<div class="checklist-run" data-blk="' + idx + '">' +
          '<div class="chk-progress" data-blk="' + idx + '"></div>' +
          '<ul class="checklist">' +
          b.items.map(function (it, ii) {
            return '<li class="chk-item"><label><input type="checkbox" class="chk-box" data-blk="' +
              idx + '" data-i="' + ii + '" /><span>' + esc(it) + "</span></label></li>";
          }).join("") + "</ul></div>";
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
          reviewChip(s) +
          '<button class="fav-star detail-fav' + (isFav(s.id) ? " on" : "") + '" id="favBtn" type="button" aria-pressed="' +
            isFav(s.id) + '" aria-label="' + esc(t(isFav(s.id) ? "removeFav" : "addFav")) + '">' +
            (isFav(s.id) ? "★" : "☆") + "</button>" +
        "</div>" +
        '<h1 class="detail-title">' + esc(tr(s.title)) + "</h1>" +
        '<div class="meta-grid">' + meta.join("") + "</div>" +
      "</div>" +
      '<div class="detail-actions">' +
        (TREES[s.id] ? '<button class="btn btn-accent" id="guidedBtn" type="button">🧭 ' + esc(t("guidedMode")) + "</button>" : "") +
        '<button class="btn" id="printBtn" type="button">🖨 ' + esc(t("print")) + "</button>" +
        '<button class="btn" id="copyBtn" type="button">🔗 ' + esc(t("copyLink")) + "</button>" +
      "</div>" +
      '<div id="treePanel" class="tree-panel" aria-live="polite" hidden></div>' +
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
    var favBtn = detailView.querySelector("#favBtn");
    if (favBtn) favBtn.addEventListener("click", function () {
      var on = toggleFav(s.id);
      favBtn.classList.toggle("on", on);
      favBtn.textContent = on ? "★" : "☆";
      favBtn.setAttribute("aria-pressed", on);
      favBtn.setAttribute("aria-label", t(on ? "removeFav" : "addFav"));
      renderFilters();
    });
    // decision tree (guided mode)
    var guided = detailView.querySelector("#guidedBtn");
    if (guided) {
      guided.addEventListener("click", function () {
        var panel = detailView.querySelector("#treePanel");
        if (!panel.hidden) { panel.hidden = true; return; }
        panel.hidden = false;
        renderTree(s.id, TREES[s.id].start, []);
        panel.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
    decorateTerms(detailView.querySelector(".content"));
    hydrateChecklists(detailView.querySelector(".content"), s.id);
    wireQuickNav();
  }

  // ---- decision tree engine ----
  function renderTree(sopId, nodeId, history) {
    var panel = detailView.querySelector("#treePanel");
    if (!panel) return;
    var tree = TREES[sopId];
    var node = tree.nodes[nodeId];
    var crumbs = '<div class="tree-bar">' +
      '<span class="tree-step">' + (history.length + 1) + "</span>" +
      '<button class="tree-link" id="treeRestart" type="button">↻ ' + esc(t("restart")) + "</button>" +
      (history.length ? '<button class="tree-link" id="treeBack" type="button">← ' + esc(t("back")) + "</button>" : "") +
      "</div>";

    if (node.outcome !== undefined) {
      // shouldn't happen at node level; outcomes live on options
    }
    var html = crumbs +
      '<div class="tree-q">' + esc(tr(node.q)) + "</div>" +
      '<div class="tree-options">' +
      node.options.map(function (opt, i) {
        return '<button class="tree-opt" type="button" data-i="' + i + '">' + esc(tr(opt.label)) + "</button>";
      }).join("") +
      "</div>";
    panel.innerHTML = html;

    panel.querySelector("#treeRestart").addEventListener("click", function () {
      renderTree(sopId, tree.start, []);
    });
    var back = panel.querySelector("#treeBack");
    if (back) back.addEventListener("click", function () {
      var prev = history.slice(0, -1);
      var prevNode = history.length ? history[history.length - 1] : tree.start;
      renderTree(sopId, prevNode, prev);
    });
    panel.querySelectorAll(".tree-opt").forEach(function (b) {
      b.addEventListener("click", function () {
        var opt = node.options[+b.getAttribute("data-i")];
        if (opt.goto) {
          renderTree(sopId, opt.goto, history.concat([nodeId]));
        } else if (opt.outcome !== undefined) {
          showOutcome(sopId, tr(opt.label), tr(opt.outcome), history.concat([nodeId]));
        }
      });
    });
  }
  function showOutcome(sopId, choice, text, history) {
    var panel = detailView.querySelector("#treePanel");
    var tree = TREES[sopId];
    panel.innerHTML =
      '<div class="tree-bar">' +
        '<button class="tree-link" id="treeRestart" type="button">↻ ' + esc(t("restart")) + "</button>" +
        '<button class="tree-link" id="treeBack" type="button">← ' + esc(t("back")) + "</button>" +
      "</div>" +
      '<div class="tree-chosen">› ' + esc(choice) + "</div>" +
      '<div class="tree-outcome"><span class="tree-outcome-tag">✅ ' + esc(t("outcomeLabel")) + "</span>" +
        "<p>" + esc(text) + "</p></div>";
    panel.querySelector("#treeRestart").addEventListener("click", function () { renderTree(sopId, tree.start, []); });
    panel.querySelector("#treeBack").addEventListener("click", function () {
      var last = history[history.length - 1];
      renderTree(sopId, last, history.slice(0, -1));
    });
  }

  // ---- interactive checklists (progress saved per SOP) ----
  function hydrateChecklists(root, sopId) {
    if (!root) return;
    root.querySelectorAll(".checklist-run").forEach(function (wrap) {
      var blk = wrap.getAttribute("data-blk");
      var boxes = wrap.querySelectorAll(".chk-box");
      var prog = wrap.querySelector(".chk-progress");
      function key(i) { return "sop-chk:" + sopId + ":" + blk + ":" + i; }
      function update() {
        var done = 0;
        boxes.forEach(function (b) { if (b.checked) done++; });
        prog.textContent = done + " / " + boxes.length;
        prog.classList.toggle("complete", done === boxes.length && boxes.length > 0);
      }
      boxes.forEach(function (b, i) {
        try { b.checked = localStorage.getItem(key(i)) === "1"; } catch (e) {}
        b.closest(".chk-item").classList.toggle("done", b.checked);
        b.addEventListener("change", function () {
          try { localStorage.setItem(key(i), b.checked ? "1" : "0"); } catch (e) {}
          b.closest(".chk-item").classList.toggle("done", b.checked);
          update();
        });
      });
      update();
    });
  }

  // ---- glossary term tooltips inside SOP content ----
  function decorateTerms(root) {
    if (!root || !GLOSSARY.length) return;
    var map = {};
    GLOSSARY.forEach(function (g) {
      if (/^[A-Za-z0-9]+$/.test(g.term)) map[g.term] = g; // acronym-style tokens only
    });
    var tokens = Object.keys(map);
    if (!tokens.length) return;
    var re = new RegExp("\\b(" + tokens.join("|") + ")\\b", "g");
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var nodes = [], n;
    while ((n = walker.nextNode())) {
      if (n.parentNode && n.parentNode.closest(".gterm,.tree-panel,h3")) continue;
      if (re.test(n.nodeValue)) { re.lastIndex = 0; nodes.push(n); }
    }
    nodes.forEach(function (node) {
      var frag = document.createDocumentFragment();
      var last = 0, m, s = node.nodeValue;
      re.lastIndex = 0;
      while ((m = re.exec(s))) {
        if (m.index > last) frag.appendChild(document.createTextNode(s.slice(last, m.index)));
        var g = map[m[1]];
        var ab = document.createElement("span");
        ab.className = "gterm";
        ab.setAttribute("role", "button");
        ab.setAttribute("tabindex", "0");
        ab.setAttribute("data-full", tr(g.full));
        ab.setAttribute("data-def", tr(g.def));
        ab.setAttribute("aria-label", m[1] + ": " + tr(g.full));
        ab.title = tr(g.full) + " — " + tr(g.def);
        ab.textContent = m[1];
        frag.appendChild(ab);
        last = m.index + m[1].length;
      }
      if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last)));
      node.parentNode.replaceChild(frag, node);
    });
  }

  // ---- glossary modal ----
  var glossaryOpener = null;
  function openGlossary() {
    var modal = $("#glossaryModal");
    glossaryOpener = document.activeElement;
    modal.hidden = false;
    renderGlossary("");
    var input = $("#glossaryInput");
    input.value = "";
    setTimeout(function () { input.focus(); }, 30);
  }
  function closeGlossary() {
    $("#glossaryModal").hidden = true;
    if (glossaryOpener && glossaryOpener.focus) glossaryOpener.focus();
  }
  function renderGlossary(q) {
    var list = $("#glossaryList");
    q = (q || "").trim().toLowerCase();
    var rows = GLOSSARY.filter(function (g) {
      if (!q) return true;
      return (g.term + " " + tr(g.full) + " " + tr(g.def)).toLowerCase().indexOf(q) !== -1;
    });
    if (!rows.length) { list.innerHTML = '<p class="glossary-empty">' + esc(t("glossaryEmpty")) + "</p>"; return; }
    list.innerHTML = rows.map(function (g) {
      return '<div class="gitem"><div class="gitem-term">' + esc(g.term) +
        ' <span class="gitem-full">' + esc(tr(g.full)) + "</span></div>" +
        '<p class="gitem-def">' + esc(tr(g.def)) + "</p></div>";
    }).join("");
  }

  // ---- term popover (tap / keyboard accessible) ----
  function wireTermPopover() {
    var pop = $("#termPop");
    if (!pop) return;
    function hide() { pop.hidden = true; pop._for = null; }
    function show(el) {
      pop.innerHTML = "<strong>" + esc(el.getAttribute("data-full")) + "</strong>" +
        "<span>" + esc(el.getAttribute("data-def")) + "</span>";
      pop.hidden = false;
      var r = el.getBoundingClientRect();
      var maxLeft = window.scrollX + document.documentElement.clientWidth - pop.offsetWidth - 12;
      pop.style.top = (r.bottom + window.scrollY + 6) + "px";
      pop.style.left = Math.max(window.scrollX + 8, Math.min(r.left + window.scrollX, maxLeft)) + "px";
      pop._for = el;
    }
    document.addEventListener("click", function (e) {
      var term = e.target.closest && e.target.closest(".gterm");
      if (term) { e.stopPropagation(); if (!pop.hidden && pop._for === term) hide(); else show(term); return; }
      if (!pop.hidden && !(e.target.closest && e.target.closest("#termPop"))) hide();
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") hide();
      var el = document.activeElement;
      if ((e.key === "Enter" || e.key === " ") && el && el.classList && el.classList.contains("gterm")) {
        e.preventDefault(); if (!pop.hidden && pop._for === el) hide(); else show(el);
      }
    });
    window.addEventListener("scroll", function () { if (!pop.hidden) hide(); }, true);
  }
  function metaItem(k, v) {
    return '<div class="meta-item"><span class="meta-k">' + esc(k) +
           '</span><span class="meta-v">' + esc(v) + "</span></div>";
  }
  function reviewChip(s) {
    if (state.lang === "en") return "";          // English is the authored source
    var reviewed = s.reviewed && s.reviewed[state.lang];
    if (reviewed) return '<span class="rev-chip reviewed">✓ ' + esc(t("reviewedBadge")) + "</span>";
    return '<span class="rev-chip draft">⚠ ' + esc(t("draftBadge")) + "</span>";
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
        pushRecent(s.id);
        listView.hidden = true;
        detailView.hidden = false;
        renderDetail(s);
        window.scrollTo(0, 0);
        return;
      }
    }
    detailView.hidden = true;
    listView.hidden = false;
    renderList();   // refresh stars / recently-viewed when returning to the list
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
  // glossary modal wiring
  wireTermPopover();
  if (GLOSSARY.length) {
    $("#glossaryBtn").addEventListener("click", openGlossary);
    $("#glossaryInput").addEventListener("input", function () { renderGlossary(this.value); });
    var gmodal = $("#glossaryModal");
    gmodal.addEventListener("click", function (e) {
      if (e.target.getAttribute("data-close")) closeGlossary();
    });
    document.addEventListener("keydown", function (e) {
      if ($("#glossaryModal").hidden) return;
      if (e.key === "Escape") { closeGlossary(); return; }
      if (e.key === "Tab") {                       // focus trap
        var f = gmodal.querySelectorAll('button, input, [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        var first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  } else {
    var gb = $("#glossaryBtn"); if (gb) gb.style.display = "none";
  }

  buildLangSelect();
  applyI18n();
  renderFilters();
  renderList();
  route();
};
