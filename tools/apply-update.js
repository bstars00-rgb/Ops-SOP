/*
 * Apply the 2026-06-10 SOP-008 CEO-directive update (Agoda rejection rule reversal)
 * to the master and the extras source files, in all 5 languages.
 *
 *   Reads : source-docs/_update/patch-all.json  ({en,ko,zh,ja,vi} × 6 fields)
 *   Writes: source-docs/sops.json               (SOP-008 body callout + notes,
 *                                                 glossary "Compensation", tree n4 outcomes,
 *                                                 SOP-008 version/revised bump)
 *           source-docs/extras/<lang>.json       (glossary + tree, to avoid drift)
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const LANGS = ["en", "ko", "zh", "ja", "vi"];
const patch = JSON.parse(fs.readFileSync(path.join(ROOT, "source-docs", "_update", "patch-all.json"), "utf8"));

function die(msg) { console.error("ERROR: " + msg); process.exit(1); }

// ---- master ----
const masterPath = path.join(ROOT, "source-docs", "sops.json");
const m = JSON.parse(fs.readFileSync(masterPath, "utf8"));
const s = m.data.find(x => x.id === "SOP-008");
if (!s) die("SOP-008 not found");

// metadata bump (content materially changed on 2026-06-10)
s.version = "1.1";
s.revised = "10-Jun-2026";

// find the unique critical callout index + the Agoda notes-item index (from en, parallel across langs)
const enBody = s.body.en;
const calloutIdx = enBody.findIndex(b => b.t === "callout" && b.v === "critical");
if (calloutIdx === -1) die("critical callout not found in SOP-008");
const notesIdx = enBody.length - 1;
if (enBody[notesIdx].t !== "list") die("last SOP-008 block is not the notes list");
const agodaItemIdx = enBody[notesIdx].items.findIndex(it => /Fully Booked|100 USD|Agoda/.test(it));
if (agodaItemIdx === -1) die("Agoda notes bullet not found");

LANGS.forEach(l => {
  const p = patch[l];
  if (!p) die("patch missing language " + l);
  const body = s.body[l];
  // callout
  body[calloutIdx].title = p.callout_title;
  body[calloutIdx].lines = p.callout_lines.slice();
  // notes bullet
  body[notesIdx].items[agodaItemIdx] = p.notes_bullet;
  // glossary Compensation def
  const g = m.glossary.find(x => x.term === "Compensation");
  if (g) g.def[l] = p.glossary_compensation_def;
  // tree n4 outcomes
  const n4 = m.trees["SOP-008"].nodes.n4;
  n4.options[0].outcome[l] = p.tree_n4_exempt;
  n4.options[1].outcome[l] = p.tree_n4_notexempt;
});
fs.writeFileSync(masterPath, JSON.stringify(m, null, 2));

// ---- extras source files (keep in sync so merge-extras won't revert) ----
LANGS.forEach(l => {
  const f = path.join(ROOT, "source-docs", "extras", l + ".json");
  if (!fs.existsSync(f)) return;
  const ex = JSON.parse(fs.readFileSync(f, "utf8"));
  const p = patch[l];
  const g = ex.glossary.find(x => x.term === "Compensation");
  if (g) g.def = p.glossary_compensation_def;
  const n4 = ex.trees["SOP-008"].nodes.n4;
  n4.options[0].outcome = p.tree_n4_exempt;
  n4.options[1].outcome = p.tree_n4_notexempt;
  fs.writeFileSync(f, JSON.stringify(ex, null, 2));
});

console.log("Applied SOP-008 CEO-directive update across " + LANGS.length + " languages.");
console.log("  callout idx " + calloutIdx + ", notes item idx " + agodaItemIdx + ", SOP-008 -> v1.1 (revised 10-Jun-2026)");
