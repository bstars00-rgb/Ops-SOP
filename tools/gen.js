/*
 * Migrate the SOP master to a multilingual JSON model and split English bodies
 * into per-SOP files for translators.
 *
 *   Reads : source-docs/sops.source.js   (current master; blocks=[], purpose="")
 *   Writes: source-docs/sops.json        ({secret, categories, data}) with
 *                                          purpose:{en}, body:{en:[...]}
 *           source-docs/i18n/en/<id>.json (English purpose + blocks per SOP)
 *
 * Idempotent: if source-docs/sops.json already exists with translations, run
 * tools/merge.js instead — this only (re)generates the English baseline.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "source-docs", "sops.source.js");
const OUT_JSON = path.join(ROOT, "source-docs", "sops.json");
const EN_DIR = path.join(ROOT, "source-docs", "i18n", "en");

fs.mkdirSync(EN_DIR, { recursive: true });

global.window = {};
require(SRC);
const SOPS = global.window.SOP_DATA;
const CATS = global.window.SOP_CATEGORIES;
const SECRET = global.window.SOP_SECRET;

const data = SOPS.map(function (s) {
  const out = {};
  // copy scalar / unchanged fields in a stable order
  ["id", "cat", "version", "effective", "revised", "by", "applicable", "related"]
    .forEach(function (k) { if (s[k] != null) out[k] = s[k]; });
  out.title = s.title;
  out.summary = s.summary;
  out.purpose = { en: s.purpose };
  out.tags = s.tags || [];
  out.body = { en: s.blocks || [] };

  // English split for translators
  fs.writeFileSync(
    path.join(EN_DIR, s.id + ".json"),
    JSON.stringify({ id: s.id, title: s.title.en, purpose: s.purpose, blocks: s.blocks }, null, 2)
  );
  return out;
});

fs.writeFileSync(OUT_JSON, JSON.stringify({ secret: SECRET, categories: CATS, data: data }, null, 2));
console.log("Wrote sops.json (" + data.length + " SOPs) and " + data.length + " English split files.");
