/*
 * Encrypt the SOP dataset for safe publishing on a PUBLIC static host.
 *
 *   Input : source-docs/sops.json        (PLAINTEXT, gitignored — the editable master,
 *                                          {secret, categories, data}; multilingual)
 *   Output: data/sops.enc.js             (CIPHERTEXT, committed — useless without the password)
 *
 * Crypto: PBKDF2-SHA256(passphrase, salt, iterations) -> AES-256-GCM key.
 *         passphrase = "<USERNAME-UPPERCASED>:<PASSWORD>"  → both ID and password are
 *         required to decrypt (a wrong ID fails just like a wrong password).
 *         The browser (assets/auth.js) reverses this with the Web Crypto API.
 *
 * Usage:
 *   node tools/encrypt.js
 *   SOP_USER=OHMYHOTEL SOP_PASS=OHMYHOTEL2026 node tools/encrypt.js
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const USER = (process.env.SOP_USER || "OHMYHOTEL").trim().toUpperCase();
const PASS = (process.env.SOP_PASS || "OHMYHOTEL2026").trim();
const ITERATIONS = 200000;

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "source-docs", "sops.json");
const OUT = path.join(ROOT, "data", "sops.enc.js");

// --- load the plaintext JSON master ---
const master = JSON.parse(fs.readFileSync(SRC, "utf8"));
if (!master.data || !master.data.length) {
  console.error("ERROR: sops.json has no data. Aborting.");
  process.exit(1);
}
const payload = JSON.stringify({
  secret: master.secret,
  categories: master.categories,
  data: master.data
});

// --- derive key + encrypt ---
const passphrase = USER + ":" + PASS;
const salt = crypto.randomBytes(16);
const iv = crypto.randomBytes(12);
const key = crypto.pbkdf2Sync(Buffer.from(passphrase, "utf8"), salt, ITERATIONS, 32, "sha256");

const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
const ct = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
const tag = cipher.getAuthTag();
// Web Crypto expects the GCM tag appended to the ciphertext.
const ctWithTag = Buffer.concat([ct, tag]);

const blob = {
  v: 1,
  kdf: "PBKDF2-SHA256",
  iterations: ITERATIONS,
  cipher: "AES-256-GCM",
  salt: salt.toString("base64"),
  iv: iv.toString("base64"),
  ct: ctWithTag.toString("base64")
};

const banner =
  "/* AUTO-GENERATED — do NOT edit. Encrypted SOP data.\n" +
  " * Source: source-docs/sops.source.js  |  Regenerate: node tools/encrypt.js\n" +
  " * Useless without the login password. */\n";
fs.writeFileSync(OUT, banner + "window.SOP_ENC = " + JSON.stringify(blob) + ";\n");

console.log("Encrypted " + master.data.length + " SOPs.");
console.log("  user (label): " + USER);
console.log("  output: " + path.relative(ROOT, OUT) + " (" + ctWithTag.length + " bytes ciphertext)");
