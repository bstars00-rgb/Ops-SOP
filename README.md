# VNOP SOP Hub

A fast, searchable, multilingual reference site for the VNOP Operations team's
Standard Operating Procedures (SOP-001 → SOP-018).

> **English is the base language.** Korean (한국어), Chinese (中文), and Japanese (日本語)
> are selectable from the top-right language switcher. Light/Dark mode included.

![status](https://img.shields.io/badge/type-static_prototype-blue) ![langs](https://img.shields.io/badge/i18n-en%20%C2%B7%20ko%20%C2%B7%20zh%20%C2%B7%20ja-green)

---

## ✨ Features

- 🔎 **Instant full-text search** — title, summary, keyword, body text, or SOP number (`SOP-015`).
- 🗂 **Category filters** — Booking Handling · Agent Requests · Manual Booking · Finance & Disputes.
- 🌐 **4 languages** — English (base) + Korean / Chinese / Japanese. UI, SOP titles & summaries are fully translated; SOP body text is in English with a structure ready for translation.
- 🌗 **Dark mode** — auto-detects system preference, remembers your choice.
- 🔗 **Deep links** — every SOP has its own URL (`#/sop/SOP-008`); use **Copy link** to share.
- 🖨 **Print-friendly** — clean printout per SOP.
- 🔒 **Safe to publish** — all passwords, access keys, and the card reference from the source documents have been replaced with `🔒 [Stored in the team password manager]`.
- ⚡ **Zero build, zero dependencies** — plain HTML/CSS/JS. Works offline; open `index.html` directly or host anywhere.

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

No build step. Either:

- **Open directly:** double-click `index.html` (works because data is loaded as plain `<script>`, not `fetch`), **or**
- **Serve it** (recommended, avoids any browser file:// quirks):
  ```bash
  npx serve .          # then open http://localhost:3000
  # or
  python -m http.server 8080
  ```

---

## 📁 Project structure

```
OP-SOP/
├── index.html            # App shell
├── .nojekyll             # GitHub Pages: serve files as-is
├── assets/
│   ├── styles.css        # Light/dark theming + layout
│   ├── app.js            # Search, filters, routing, i18n, theme
│   └── i18n.js           # UI string translations (en/ko/zh/ja)
├── data/
│   └── sops.js           # ⭐ All 18 SOPs (single source of truth)
├── source-docs/          # Original source .docx (gitignored — has plaintext credentials)
├── ROADMAP.md            # Planned enhancements (고도화 기획)
└── README.md
```

---

## ✏️ How to edit / add a SOP

Everything lives in **`data/sops.js`** — no code changes needed for content.

Each SOP is one object. To add or edit:

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
active language — see `ROADMAP.md`.

---

## 🇰🇷 빠른 시작 (Korean quick start)

1. 이 폴더를 GitHub 새 저장소에 올립니다 (위 *Deploy* 명령 참고).
2. **Settings → Pages → Branch: main / root** 로 배포합니다.
3. 우측 상단에서 **언어(영어·한국어·중국어·일본어)** 와 **다크모드**를 전환할 수 있습니다.
4. SOP 내용 수정은 **`data/sops.js`** 파일만 편집하면 됩니다.
5. ⚠️ 자격 증명·내부 규칙이 포함되어 있으므로 **비공개(private) 저장소** 사용을 권장합니다.
6. 추가 고도화 계획은 [`ROADMAP.md`](ROADMAP.md) 를 확인하세요.

---

_Internal reference for the VNOP Operations team. Always verify the latest SOP version before acting._
