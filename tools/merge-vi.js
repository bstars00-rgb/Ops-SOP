/*
 * Merge Vietnamese (vi) translations into the JSON master, validating that the
 * vi body mirrors the English block structure. Also adds vi category labels.
 *
 *   Reads : source-docs/sops.json, source-docs/i18n/vi/<ID>.json
 *   Writes: source-docs/sops.json (adds title.vi, summary.vi, purpose.vi, body.vi)
 *
 * Exits non-zero and writes nothing if any structural mismatch is found.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MASTER = path.join(ROOT, "source-docs", "sops.json");
const VI = path.join(ROOT, "source-docs", "i18n", "vi");

const CAT_VI = {
  booking: "Xử lý đặt phòng",
  requests: "Yêu cầu từ đại lý",
  manual: "Đặt phòng thủ công",
  finance: "Tài chính & Tranh chấp"
};

const master = JSON.parse(fs.readFileSync(MASTER, "utf8"));
const errors = [];

function lenOf(b) {
  if (b.t === "list" || b.t === "checklist") return (b.items || []).length;
  if (b.t === "callout") return (b.lines || []).length;
  if (b.t === "table") return (b.head || []).length + "x" + (b.rows || []).length;
  if (b.t === "kv") return (b.rows || []).length;
  return 0;
}

const tr = {};
master.data.forEach(function (s) {
  const f = path.join(VI, s.id + ".json");
  if (!fs.existsSync(f)) { errors.push(s.id + ": vi file missing"); return; }
  let t;
  try { t = JSON.parse(fs.readFileSync(f, "utf8")); }
  catch (e) { errors.push(s.id + ": invalid JSON — " + e.message); return; }
  tr[s.id] = t;

  if (!t.title) errors.push(s.id + ": title missing");
  if (!t.summary) errors.push(s.id + ": summary missing");
  if (!t.purpose) errors.push(s.id + ": purpose missing");
  const en = s.body.en, b = t.body;
  if (!Array.isArray(b)) { errors.push(s.id + ": body not array"); return; }
  if (b.length !== en.length) { errors.push(s.id + ": block count " + b.length + " != en " + en.length); return; }
  en.forEach(function (eb, i) {
    if (b[i].t !== eb.t) errors.push(s.id + " block " + i + ": t '" + b[i].t + "' != '" + eb.t + "'");
    else if (lenOf(b[i]) !== lenOf(eb)) errors.push(s.id + " block " + i + " (" + eb.t + "): size " + lenOf(b[i]) + " != en " + lenOf(eb));
  });
});

if (errors.length) {
  console.error("VALIDATION FAILED (" + errors.length + "):");
  errors.forEach(function (e) { console.error("  - " + e); });
  process.exit(1);
}

master.data.forEach(function (s) {
  const t = tr[s.id];
  s.title.vi = t.title;
  s.summary.vi = t.summary;
  s.purpose.vi = t.purpose;
  s.body.vi = t.body;
});
master.categories.forEach(function (c) {
  if (CAT_VI[c.id]) c.label.vi = CAT_VI[c.id];
});

fs.writeFileSync(MASTER, JSON.stringify(master, null, 2));
console.log("Merged vi into " + master.data.length + " SOPs + categories. All checks passed.");
