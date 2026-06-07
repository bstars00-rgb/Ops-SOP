// @ts-check
const { test, expect } = require("@playwright/test");

const ID = process.env.SOP_TEST_ID || "OHMYHOTEL";
const PW = process.env.SOP_TEST_PASS; // required — never hardcoded

test.skip(!PW, "Set SOP_TEST_PASS (and optionally SOP_TEST_ID) to run E2E tests.");

async function unlock(page) {
  await page.goto("/");
  await page.fill("#authId", ID);
  await page.fill("#authPw", PW);
  await page.click("#authSubmit");
  await expect(page.locator("#listView")).toBeVisible();
}

test("login gate rejects a wrong password", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#authGate")).toBeVisible();
  await page.fill("#authId", ID);
  await page.fill("#authPw", "definitely-wrong");
  await page.click("#authSubmit");
  await expect(page.locator("#authError")).toBeVisible();
  await expect(page.locator("#cardGrid .card")).toHaveCount(0);
});

test("correct credentials unlock and show 18 SOPs", async ({ page }) => {
  await unlock(page);
  await expect(page.locator("#cardGrid .card")).toHaveCount(18);
});

test("search filters the list", async ({ page }) => {
  await unlock(page);
  await page.fill("#searchInput", "Agoda");
  await expect(page.locator("#cardGrid .card")).not.toHaveCount(18);
  await expect(page.locator("#cardGrid .card").first()).toBeVisible();
});

test("language switch translates the UI", async ({ page }) => {
  await unlock(page);
  await page.selectOption("#langSelect", "ja");
  await expect(page.locator(".hero-title")).toContainText("ハブ");
  await page.selectOption("#langSelect", "vi");
  await expect(page.locator(".hero-title")).toContainText("Trung tâm");
});

test("detail view + guided decision tree works", async ({ page }) => {
  await unlock(page);
  await page.goto("/#/sop/SOP-008");
  await expect(page.locator(".detail-title")).toBeVisible();
  await page.click("#guidedBtn");
  await expect(page.locator("#treePanel .tree-q")).toBeVisible();
  await page.locator("#treePanel .tree-opt").first().click();
  await expect(page.locator("#treePanel")).toBeVisible();
});

test("glossary modal opens and lists terms", async ({ page }) => {
  await unlock(page);
  await page.click("#glossaryBtn");
  await expect(page.locator("#glossaryModal")).toBeVisible();
  await expect(page.locator("#glossaryList .gitem").first()).toBeVisible();
  await expect(page.locator("#glossaryList .gitem")).toHaveCount(19);
  await page.fill("#glossaryInput", "HCN");
  const n = await page.locator("#glossaryList .gitem").count();
  expect(n).toBeGreaterThan(0);
  expect(n).toBeLessThan(19);
  await expect(page.locator("#glossaryList .gitem-term", { hasText: "HCN" })).toBeVisible();
});
