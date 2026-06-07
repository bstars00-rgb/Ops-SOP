# VNOP SOP Hub

A fast, searchable, multilingual reference site for the VNOP Operations team's
Standard Operating Procedures (SOP-001 → SOP-018).

> **English is the base language.** Korean (한국어), Chinese (中文), and Japanese (日本語)
> are selectable from the top-right language switcher. Light/Dark mode included.
>
> 🔐 **The site is login-gated.** SOP content ships **AES-256-GCM encrypted** and is
> decrypted in the browser only after the correct **ID + password** are entered.
> Credentials are shared with the team privately — they are **not** stored in this repo.

![status](https://img.shields.io/badge/type-static_prototype-blue) ![langs](https://img.shields.io/badge/i18n-en%20%C2%B7%20ko%20%C2%B7%20zh%20%C2%B7%20ja-green)

---

## ✨ Features

- 🔎 **Instant full-text search** — title, summary, keyword, body text, or SOP number (`SOP-015`).
- 🗂 **Category filters** — Booking Handling · Agent Requests · Manual Booking · Finance & Disputes.
- 📖 **Glossary** — searchable, multilingual definitions (HCN, ELLIS, Override, …); acronyms in a SOP show their definition on hover.
- 🧭 **Guided mode (decision trees)** — interactive yes/no flows for branch-heavy SOPs (001, 002, 004, 005, 006, 008) that lead the operator to the correct action.
- 🌐 **4 languages** — English (base) + Korean / Chinese / Japanese. UI, SOP titles & summaries are fully translated; SOP body text is in English with a structure ready for translation.
- 🌗 **Dark mode** — auto-detects system preference, remembers your choice.
- 🔗 **Deep links** — every SOP has its own URL (`#/sop/SOP-008`); use **Copy link** to share.
- 🖨 **Print-friendly** — clean printout per SOP.
- 🔐 **Login gate + encrypted content** — SOP data is published as ciphertext (`data/sops.enc.js`) and decrypted client-side only after a correct ID + password. Without the password, the content cannot be read even by downloading the files.
- 🔒 **Credentials redacted** — passwords, access keys, and the card reference from the source documents are replaced with `🔒 [Stored in the team password manager]`.
- ⚡ **Near-zero build** — plain HTML/CSS/JS. The only "build" step is re-encrypting the data after a content edit (`node tools/encrypt.js`).

---

## 🚀 Deploy to GitHub Pages

```bash
# 1. From this folder, initialize git and push to a new GitHub repo
git init
git add .
git commit -m "VNOP SOP Hub prototype"
git branch -M main
git remote add origin https://github.com/<your-org>/<repo>.git
git push -u origin main
```

Then on GitHub:

1. **Settings → Pages**
2. **Source:** `Deploy from a branch`
3. **Branch:** `main` / `/ (root)` → **Save**
4. Wait ~1 minute. Your site is live at `https://<your-org>.github.io/<repo>/`

> The included `.nojekyll` file tells GitHub Pages to serve the files as-is (no Jekyll processing).

### ⚠️ Public vs. private

This SOP set is an **internal operations manual**. Even with credentials redacted, it
exposes internal workflows and business rules (e.g. Agoda handling, override tiers).
**Recommendation:** use a **private** repository, or GitHub Pages with access control,
rather than a fully public site.

---

## 🖥 Run locally

Decryption uses the Web Crypto API, which browsers only enable in a **secure context**
(`https://` or `localhost`). So **serve it** rather than opening `index.html` from disk:

```bash
npx serve .          # then open http://localhost:3000
# or
python -m http.server 8080
```

> Opening `index.html` directly via `file://` will show the login screen but cannot decrypt.
> Use the served URL or the live site.

---

## 📁 Project structure

```
OP-SOP/
├── index.html              # App shell + login gate markup
├── .nojekyll               # GitHub Pages: serve files as-is
├── assets/
│   ├── styles.css          # Light/dark theming + layout + gate
│   ├── app.js              # Search, filters, routing, i18n (booted after unlock)
│   ├── auth.js             # Login gate + AES decryption + boot
│   └── i18n.js             # UI string translations (en/ko/zh/ja)
├── data/
│   └── sops.enc.js         # ⭐ Encrypted SOP data (committed; useless without password)
├── tools/
│   └── encrypt.js          # Regenerates data/sops.enc.js from the master
├── source-docs/            # GITIGNORED — never published:
│   ├── sops.source.js      #   ⭐ PLAINTEXT master you edit
│   └── *.docx              #   original source documents (plaintext credentials)
├── ROADMAP.md              # Planned enhancements (고도화 기획)
└── README.md
```

---

## ✏️ How to edit / add a SOP

Content lives in the **plaintext master `source-docs/sops.json`** (gitignored — keep a
private backup). It has the shape `{ secret, categories, data: [ …SOPs… ] }`, and every
SOP is fully multilingual. After editing, **re-encrypt** so `data/sops.enc.js` updates:

```bash
node tools/encrypt.js
git add data/sops.enc.js && git commit -m "Update SOPs" && git push
```

> Helper scripts (build the multilingual master, then re-encrypt):
> `tools/gen.js` (legacy migrate), `tools/merge.js` (ko/zh/ja SOP bodies),
> `tools/gen-vi-input.js` + `tools/merge-vi.js` (Vietnamese pass),
> `tools/merge-extras.js` (glossary + decision trees from `source-docs/extras/<lang>.json`).
> The glossary and decision trees live in `source-docs/extras/*.json` and are merged into
> `sops.json` under `glossary` and `trees`, so they are encrypted and login-gated like the SOPs.

Each SOP is one object. `purpose` and `body` are language maps (`{en,ko,zh,ja}`); `body`
holds the block array per language (English is the fallback). To add or edit:

```js
{
  id: "SOP-019", cat: "booking",          // cat: booking | requests | manual | finance
  version: "1.0", effective: "01-Jul-2026", revised: "", by: "Name / Operation",
  title:   { en: "...", ko: "...", zh: "...", ja: "..." },
  summary: { en: "...", ko: "...", zh: "...", ja: "..." },
  purpose: "English purpose statement…",
  tags: ["keyword1", "keyword2"],
  blocks: [
    { t: "h",    text: "Step 1 – …" },
    { t: "para", text: "A paragraph." },
    { t: "list", ordered: false, items: ["point a", "point b"] },
    { t: "table", head: ["Col A", "Col B"], rows: [["a1", "b1"], ["a2", "b2"]] },
    { t: "callout", v: "warn", title: "Heads up", lines: ["line 1", "line 2"] },
    { t: "kv", title: "Login", rows: [["Account", window.SOP_SECRET]] },
    { t: "checklist", items: ["check 1", "check 2"] }
  ]
}
```

**Block types:** `h`, `para`, `list`, `table`, `callout` (`v`: `info|warn|critical|note|tip`), `kv`, `checklist`.

**Never paste a real password / key / card number.** Use `window.SOP_SECRET` for the value
so it renders as the safe 🔒 placeholder.

To translate a SOP body into ko/zh/ja later, the cleanest path is to make `blocks`
language-aware (e.g. `blocks: { en: [...], ko: [...] }`) and have `renderDetail` pick the
active language — see `ROADMAP.md`. (Remember to re-run `node tools/encrypt.js` afterwards.)

---

## 🔐 Login & changing the password

- Both **ID and password** are required — they together derive the AES key, so a wrong ID
  fails exactly like a wrong password.
- The login is remembered for the browser-tab session only (`sessionStorage`); closing the
  tab requires logging in again.
- **To change the password** (or ID), re-encrypt with new values and push:
  ```bash
  SOP_USER=OHMYHOTEL SOP_PASS=YourNewPassword node tools/encrypt.js
  git add data/sops.enc.js && git commit -m "Rotate access password" && git push
  ```
- Share the password with the team **out-of-band** (chat/password manager) — never commit it.

> ⚠️ **What this protects (and doesn't).** Encryption keeps the content unreadable without
> the password — strong as long as the password is strong and shared carefully. It does **not**
> protect against an authorized person re-sharing the decrypted content. For stronger control,
> combine with a private repo / authenticated hosting.

---

## 🇰🇷 빠른 시작 (Korean quick start)

1. 이 폴더를 GitHub 새 저장소에 올립니다 (위 *Deploy* 명령 참고).
2. **Settings → Pages → Branch: main / root** 로 배포합니다.
3. 접속 시 **아이디 + 비밀번호**로 로그인합니다. 콘텐츠는 암호화되어 있어 비밀번호 없이는 내용을 볼 수 없습니다. (비밀번호는 팀에 별도로 공유 — 저장소에는 없음)
4. 우측 상단에서 **언어(영어·한국어·중국어·일본어)** 와 **다크모드**를 전환할 수 있습니다.
5. SOP 내용 수정은 비공개 마스터 **`source-docs/sops.source.js`** 를 편집한 뒤 **`node tools/encrypt.js`** 로 재암호화하고 `data/sops.enc.js` 를 커밋합니다.
6. 비밀번호 변경: `SOP_PASS=새비밀번호 node tools/encrypt.js` 실행 후 커밋.
7. 추가 고도화 계획은 [`ROADMAP.md`](ROADMAP.md) 를 확인하세요.

---

_Internal reference for the VNOP Operations team. Always verify the latest SOP version before acting._
