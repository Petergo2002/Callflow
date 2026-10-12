import { test, expect } from "@playwright/test";
test("desktop, focus, dark theme and mobile visual verification", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "En bra dag för nya möjligheter." }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/dashboard.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Aktivera mörkt tema", exact: true })
    .click();
  await expect(page.locator("html")).toHaveClass("dark");
  await page.screenshot({
    path: "docs/screenshots/dashboard-dark.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("button", { name: "Aktivera ljust tema", exact: true })
    .click();
  await page.getByRole("link", { name: "Fokusläge", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ett samtal i taget.", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Starta ringpass", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Inget svar 1", exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "docs/screenshots/focus.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "docs/screenshots/focus-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  for (const route of [
    "/",
    "/leads",
    "/followups",
    "/statistics",
    "/settings",
  ]) {
    await page.goto(route);
    await expect(page.getByRole("heading").first()).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      route,
    ).toBe(true);
  }
  await page.goto("/");
  await page.screenshot({
    path: "docs/screenshots/dashboard-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});
