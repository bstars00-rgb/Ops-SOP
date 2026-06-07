/*
 * Emit per-SOP English input for the Vietnamese translation pass.
 * Reads the CURRENT master (source-docs/sops.json, already multilingual) and
 * writes source-docs/i18n/vi-en/<ID>.json = {id, title, summary, purpose, blocks}
 * using the English values. Does NOT modify the master.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const master = JSON.parse(fs.readFileSync(path.join(ROOT, "source-docs", "sops.json"), "utf8"));
const OUT = path.join(ROOT, "source-docs", "i18n", "vi-en");
fs.mkdirSync(OUT, { recursive: true });

master.data.forEach(function (s) {
  fs.writeFileSync(
    path.join(OUT, s.id + ".json"),
    JSON.stringify({
      id: s.id,
      title: s.title.en,
      summary: s.summary.en,
      purpose: s.purpose.en,
      blocks: s.body.en
    }, null, 2)
  );
});
console.log("Wrote " + master.data.length + " Vietnamese input files to source-docs/i18n/vi-en/");
