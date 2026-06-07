/*
 * Zero-dependency data-integrity test suite for the VNOP SOP Hub.
 *
 *   npm test          → validates the plaintext master (source-docs/sops.json) +
 *                       extras, structure across all languages, critical business
 *                       rules, and that no plaintext secret leaks into data/sops.enc.js.
 *
 * Runs locally (the master is gitignored). Exits non-zero on any failure so it can
 * gate a commit / pre-publish step. Run BEFORE `npm run build` (encrypt).
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MASTER = path.join(ROOT, "source-docs", "sops.json");
const ENC = path.join(ROOT, "data", "sops.enc.js");
const LANGS = ["en", "ko", "zh", "ja", "vi"];

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.error("  ✘ " + msg); } }
function group(name) { console.log("\n• " + name); }

if (!fs.existsSync(MASTER)) {
  console.error("source-docs/sops.json not found — run locally where the master exists.");
  process.exit(2);
}
const m = JSON.parse(fs.readFileSync(MASTER, "utf8"));

function lenOf(b) {
  if (b.t === "list" || b.t === "checklist") return (b.items || []).length;
  if (b.t === "callout") return (b.lines || []).length;
  if (b.t === "table") return (b.head || []).length + "x" + (b.rows || []).length;
  if (b.t === "kv") return (b.rows || []).length;
  return 0;
}

group("SOP inventory");
ok(m.data.length === 18, "expected 18 SOPs, got " + m.data.length);
for (let i = 1; i <= 18; i++) {
  const id = "SOP-" + String(i).padStart(3, "0");
  ok(m.data.some(s => s.id === id), "missing " + id);
}

group("Per-SOP multilingual completeness + body structure");
m.data.forEach(s => {
  LANGS.forEach(l => {
    ok(s.title && s.title[l], s.id + " title." + l + " missing");
    ok(s.summary && s.summary[l], s.id + " summary." + l + " missing");
    ok(s.purpose && s.purpose[l], s.id + " purpose." + l + " missing");
    ok(s.body && Array.isArray(s.body[l]), s.id + " body." + l + " missing");
  });
  const en = s.body.en || [];
  LANGS.filter(l => l !== "en").forEach(l => {
    const b = s.body[l] || [];
    ok(b.length === en.length, s.id + "/" + l + " block count " + b.length + " != en " + en.length);
    en.forEach((eb, i) => {
      if (!b[i]) return;
      ok(b[i].t === eb.t, s.id + "/" + l + " block " + i + " type " + b[i].t + " != " + eb.t);
      ok(lenOf(b[i]) === lenOf(eb), s.id + "/" + l + " block " + i + " (" + eb.t + ") size mismatch");
    });
  });
});

group("Categories");
ok(m.categories.length === 4, "expected 4 categories, got " + m.categories.length);
m.categories.forEach(c => LANGS.forEach(l => ok(c.label && c.label[l], "category " + c.id + " label." + l + " missing")));

group("Glossary");
ok((m.glossary || []).length >= 10, "expected ≥10 glossary terms");
(m.glossary || []).forEach(g => {
  ok(!!g.term, "glossary term missing token");
  LANGS.forEach(l => { ok(g.full && g.full[l], "glossary " + g.term + " full." + l + " missing"); ok(g.def && g.def[l], "glossary " + g.term + " def." + l + " missing"); });
});

group("Decision trees");
Object.keys(m.trees || {}).forEach(id => {
  const tree = m.trees[id];
  ok(tree.nodes[tree.start], id + " start node '" + tree.start + "' missing");
  Object.keys(tree.nodes).forEach(nid => {
    const node = tree.nodes[nid];
    LANGS.forEach(l => ok(node.q && node.q[l], id + "/" + nid + " q." + l + " missing"));
    ok((node.options || []).length >= 2, id + "/" + nid + " needs ≥2 options");
    node.options.forEach((opt, oi) => {
      LANGS.forEach(l => ok(opt.label && opt.label[l], id + "/" + nid + " opt " + oi + " label." + l + " missing"));
      const hasGoto = !!opt.goto, hasOutcome = opt.outcome !== undefined;
      ok(hasGoto !== hasOutcome, id + "/" + nid + " opt " + oi + " must have goto XOR outcome");
      if (hasGoto) ok(!!tree.nodes[opt.goto], id + "/" + nid + " opt " + oi + " goto '" + opt.goto + "' missing");
      if (hasOutcome) LANGS.forEach(l => ok(opt.outcome[l], id + "/" + nid + " opt " + oi + " outcome." + l + " missing"));
    });
  });
});

group("Secret placeholder consistency (credential SOPs)");
["SOP-011", "SOP-012", "SOP-013"].forEach(id => {
  const s = m.data.find(x => x.id === id);
  const enC = JSON.stringify(s.body.en).split("password manager").length - 1;
  ok(enC > 0, id + " should contain the 🔒 placeholder");
  LANGS.forEach(l => {
    const c = JSON.stringify(s.body[l]).split("password manager").length - 1;
    ok(c === enC, id + "/" + l + " placeholder count " + c + " != en " + enC);
  });
});

group("Critical business-rule spot checks (all languages)");
const sop008 = m.data.find(s => s.id === "SOP-008");
LANGS.forEach(l => ok(JSON.stringify(sop008.body[l]).indexOf("Fully Booked") !== -1, "SOP-008/" + l + " must keep 'Fully Booked' rule"));
const sop015 = m.data.find(s => s.id === "SOP-015");
LANGS.forEach(l => ok(JSON.stringify(sop015.body[l]).indexOf("11:15") !== -1, "SOP-015/" + l + " must keep the 11:15 deadline"));
const sop018 = m.data.find(s => s.id === "SOP-018");
LANGS.forEach(l => ok(JSON.stringify(sop018.body[l]).indexOf("3.0%") !== -1, "SOP-018/" + l + " must keep the override tier figures"));

group("No plaintext secret leaks in master");
const leaks = ["ohmy!5555", "Welcome123!", "ohmyhotelnco20250401", "Ohmyhotel-Master", "ohmyhotelnco-AMANEK"];
const masterStr = JSON.stringify(m);
leaks.forEach(x => ok(masterStr.indexOf(x) === -1, "leaked secret in master: " + x));

group("Published ciphertext (data/sops.enc.js)");
if (fs.existsSync(ENC)) {
  const enc = fs.readFileSync(ENC, "utf8");
  leaks.forEach(x => ok(enc.indexOf(x) === -1, "leaked secret in ciphertext: " + x));
  ["Fully Booked", "password manager", "NOT FOUND"].forEach(p =>
    ok(enc.indexOf(p) === -1, "plaintext phrase '" + p + "' found in ciphertext (re-encrypt!)"));
  ok(/window\.SOP_ENC\s*=/.test(enc), "sops.enc.js must assign window.SOP_ENC");
} else {
  console.log("  (data/sops.enc.js not found — run `npm run build` first)");
}

console.log("\n" + (fail ? "✘ " : "✔ ") + pass + " passed, " + fail + " failed.");
process.exit(fail ? 1 : 0);
