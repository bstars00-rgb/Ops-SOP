/*
 * Merge glossary + decision trees into the JSON master as language maps.
 * Reads source-docs/extras/<lang>.json for each available language (en required)
 * and writes master.glossary + master.trees with {en,ko,zh,ja,vi} fields.
 *
 * English is the canonical structure; every other language must match it
 * (same glossary terms, same tree node ids, same option counts) or the script
 * aborts without writing.
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MASTER = path.join(ROOT, "source-docs", "sops.json");
const EXTRAS = path.join(ROOT, "source-docs", "extras");
const LANGS = ["en", "ko", "zh", "ja", "vi"];

const src = {};
LANGS.forEach(function (l) {
  const f = path.join(EXTRAS, l + ".json");
  if (fs.existsSync(f)) src[l] = JSON.parse(fs.readFileSync(f, "utf8"));
});
if (!src.en) { console.error("ERROR: source-docs/extras/en.json required."); process.exit(1); }
const present = Object.keys(src);
const errors = [];

// ---- validate structure of each non-en language against en ----
present.filter(function (l) { return l !== "en"; }).forEach(function (l) {
  const a = src.en, b = src[l];
  if (b.glossary.length !== a.glossary.length) errors.push(l + ": glossary length " + b.glossary.length + " != en " + a.glossary.length);
  a.glossary.forEach(function (g, i) {
    if (b.glossary[i] && b.glossary[i].term !== g.term) errors.push(l + " glossary " + i + ": term '" + (b.glossary[i] || {}).term + "' != '" + g.term + "'");
  });
  Object.keys(a.trees).forEach(function (id) {
    if (!b.trees[id]) { errors.push(l + ": tree " + id + " missing"); return; }
    Object.keys(a.trees[id].nodes).forEach(function (nid) {
      const an = a.trees[id].nodes[nid], bn = b.trees[id].nodes[nid];
      if (!bn) { errors.push(l + " " + id + ": node " + nid + " missing"); return; }
      if ((bn.options || []).length !== an.options.length) errors.push(l + " " + id + "/" + nid + ": option count mismatch");
    });
  });
});
if (errors.length) {
  console.error("VALIDATION FAILED (" + errors.length + "):");
  errors.forEach(function (e) { console.error("  - " + e); });
  process.exit(1);
}

function lmap(getter) { // build {lang: value} from each present language
  const o = {};
  present.forEach(function (l) { o[l] = getter(src[l]); });
  return o;
}

// ---- glossary ----
const glossary = src.en.glossary.map(function (g, i) {
  return {
    term: g.term,
    full: lmap(function (s) { return s.glossary[i].full; }),
    def: lmap(function (s) { return s.glossary[i].def; })
  };
});

// ---- trees ----
const trees = {};
Object.keys(src.en.trees).forEach(function (id) {
  const enT = src.en.trees[id];
  const nodes = {};
  Object.keys(enT.nodes).forEach(function (nid) {
    const enN = enT.nodes[nid];
    nodes[nid] = {
      q: lmap(function (s) { return s.trees[id].nodes[nid].q; }),
      options: enN.options.map(function (opt, oi) {
        const o = { label: lmap(function (s) { return s.trees[id].nodes[nid].options[oi].label; }) };
        if (opt.goto) o.goto = opt.goto;
        if (opt.outcome != null) o.outcome = lmap(function (s) { return s.trees[id].nodes[nid].options[oi].outcome; });
        return o;
      })
    };
  });
  trees[id] = { start: enT.start, nodes: nodes };
});

const master = JSON.parse(fs.readFileSync(MASTER, "utf8"));
master.glossary = glossary;
master.trees = trees;
fs.writeFileSync(MASTER, JSON.stringify(master, null, 2));
console.log("Merged extras: " + glossary.length + " glossary terms, " + Object.keys(trees).length + " decision trees. Languages: " + present.join(", "));
