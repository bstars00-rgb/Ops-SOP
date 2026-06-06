/*
 * Merge per-SOP translation files into the JSON master, validating that every
 * language mirrors the English block structure exactly.
 *
 *   Reads : source-docs/sops.json                (English baseline)
 *           source-docs/i18n/<ID>.json           ({purpose:{ko,zh,ja}, body:{ko,zh,ja}})
 *   Writes: source-docs/sops.json                (now with ko/zh/ja)
 *
 * Exits non-zero and writes nothing if any structural mismatch is found.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MASTER = path.join(ROOT, "source-docs", "sops.json");
const I18N = path.join(ROOT, "source-docs", "i18n");
const LANGS = ["ko", "zh", "ja"];

const master = JSON.parse(fs.readFileSync(MASTER, "utf8"));
const errors = [];

function lenOf(b) {
  if (b.t === "list" || b.t === "checklist") return (b.items || []).length;
  if (b.t === "callout") return (b.lines || []).length;
  if (b.t === "table") return (b.head || []).length + "x" + (b.rows || []).length;
  if (b.t === "kv") return (b.rows || []).length;
  return 0;
}

master.data.forEach(function (s) {
  const f = path.join(I18N, s.id + ".json");
  if (!fs.existsSync(f)) { errors.push(s.id + ": translation file missing"); return; }
  let tr;
  try { tr = JSON.parse(fs.readFileSync(f, "utf8")); }
  catch (e) { errors.push(s.id + ": invalid JSON — " + e.message); return; }

  const en = s.body.en;
  LANGS.forEach(function (l) {
    if (!tr.purpose || !tr.purpose[l]) errors.push(s.id + "/" + l + ": purpose missing");
    const b = tr.body && tr.body[l];
    if (!Array.isArray(b)) { errors.push(s.id + "/" + l + ": body missing/not array"); return; }
    if (b.length !== en.length) {
      errors.push(s.id + "/" + l + ": block count " + b.length + " != en " + en.length); return;
    }
    en.forEach(function (eb, i) {
      if (b[i].t !== eb.t) errors.push(s.id + "/" + l + " block " + i + ": t '" + b[i].t + "' != '" + eb.t + "'");
      else if (lenOf(b[i]) !== lenOf(eb)) errors.push(s.id + "/" + l + " block " + i + " (" + eb.t + "): size " + lenOf(b[i]) + " != en " + lenOf(eb));
    });
  });
});

if (errors.length) {
  console.error("VALIDATION FAILED (" + errors.length + "):");
  errors.forEach(function (e) { console.error("  - " + e); });
  process.exit(1);
}

// All good — merge.
master.data.forEach(function (s) {
  const tr = JSON.parse(fs.readFileSync(path.join(I18N, s.id + ".json"), "utf8"));
  LANGS.forEach(function (l) {
    s.purpose[l] = tr.purpose[l];
    s.body[l] = tr.body[l];
  });
});
fs.writeFileSync(MASTER, JSON.stringify(master, null, 2));
console.log("Merged ko/zh/ja into " + master.data.length + " SOPs. All structure checks passed.");
