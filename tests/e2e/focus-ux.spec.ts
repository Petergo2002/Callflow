import { test, expect, Page } from "@playwright/test";
import { Data, emptyData, makeLead } from "../../src/lib/model";
function fixture() {
  const d = emptyData();
  d.groups = [
    {
      id: "maps",
      name: "Google Maps Göteborg",
      color: "#16724c",
      createdAt: new Date().toISOString(),
    },
    {
      id: "insta",
      name: "Instagram",
      color: "#3568b0",
      createdAt: new Date().toISOString(),
    },
  ];
  d.leads = ["Kartbolag A", "Kartbolag B", "Bildbolaget"].map(
    (companyName, i) =>
      makeLead({
        companyName,
        phone: `070123456${i}`,
        website: "",
        industry: "",
        city: "",
        contactName: "",
        notes: "",
        status: "Ej kontaktad",
        groupId: i < 2 ? "maps" : "insta",
        source: i < 2 ? "Google Maps" : "Instagram",
      }),
  );
  return d;
}
async function seed(page: Page, d = fixture()) {
  await page.addInitScript((data) => {
    if (!localStorage.getItem("callflow.data.v1"))
      localStorage.setItem("callflow.data.v1", JSON.stringify(data));
  }, d);
  await page.goto("/focus");
}
async function snapshot(page: Page): Promise<Data> {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("callflow.data.v1")!),
  );
}
test("group selection persists, navigation stays scoped and changing groups preserves work", async ({
  page,
}) => {
  await seed(page);
  await expect(page.getByLabel("Välj ringlista")).toBeHidden();
  await page.getByLabel("Välj grupp för ringpass").selectOption("maps");
  await expect(
    page.getByText("2 leads redo att ringa", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "/private/tmp/callflow-focus-setup.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Starta ringpass", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Kartbolag A", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Inget svar 1", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Kartbolag B", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Pausa", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Ta ett andetag.", exact: true }),
  ).toBeVisible();
  expect((await snapshot(page)).sessions[0].selectedGroup).toBe("maps");
  await page
    .getByRole("button", { name: "Fortsätt ringpass", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Kartbolag B", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ändra urval", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Välj grupp för ringpass")).toHaveValue(
    "maps",
  );
  expect((await snapshot(page)).sessions[0].status).toBe("paused");
  await dialog.getByLabel("Välj grupp för ringpass").selectOption("insta");
  await dialog
    .getByRole("button", { name: "Spara och fortsätt", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bildbolaget", exact: true }),
  ).toBeVisible();
  expect((await snapshot(page)).calls).toHaveLength(1);
  expect((await snapshot(page)).xp.reduce((sum, x) => sum + x.points, 0)).toBe(
    5,
  );
  await expect(
    page.getByRole("button", { name: "Föregående P", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: "/private/tmp/callflow-focus-active.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Hoppa över N", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Du har gått igenom din ringlista.",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Föregående företag", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Bildbolaget", exact: true }),
  ).toBeVisible();
});
test("empty queues explain future callbacks and missing phones; advanced filters are optional", async ({
  page,
}) => {
  const d = fixture();
  d.leads[0].phone = "";
  d.leads[1].nextFollowUpAt = new Date(Date.now() + 86400000).toISOString();
  await seed(page, d);
  await page.getByLabel("Välj grupp för ringpass").selectOption("maps");
  await expect(
    page.getByText("0 leads redo att ringa", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText(
      "1 väntar på nästa kontakttid · 1 saknar telefonnummer",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Starta ringpass", exact: true }),
  ).toBeDisabled();
  await page.getByText("Anpassa urval", { exact: true }).click();
  await page.getByLabel("Välj källa för ringpass").selectOption("Instagram");
  await expect(
    page.getByText("0 leads redo att ringa", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Återställ till standardurval", exact: true })
    .click();
  await expect(page.getByLabel("Välj källa för ringpass")).toHaveValue("");
  await page.getByLabel("Välj grupp för ringpass").selectOption("insta");
  await expect(
    page.getByText("1 lead redo att ringa", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Starta ringpass", exact: true }),
  ).toBeEnabled();
});
test("mobile focus controls fit, clipboard errors are honest and shortcuts respect typing", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page);
  await page.getByLabel("Välj grupp för ringpass").selectOption("maps");
  await page
    .getByRole("button", { name: "Starta ringpass", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Kartbolag A", exact: true }),
  ).toBeVisible();
  await page.evaluate(() =>
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: () => Promise.reject(new Error("denied")) },
    }),
  );
  await page
    .getByRole("button", { name: "Kopiera telefonnummer", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Kunde inte kopiera" }),
  ).toBeVisible();
  await expect(page.getByText("Kopierat!", { exact: true })).toHaveCount(0);
  await page.getByLabel("Dina anteckningar").fill("Sparad anteckning");
  await page.getByLabel("Dina anteckningar").press("Space");
  expect((await snapshot(page)).sessions[0].status).toBe("active");
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("heading", { name: "Ta ett andetag.", exact: true }),
  ).toBeVisible();
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.keyboard.press("Space");
  await expect(
    page.getByRole("heading", { name: "Kartbolag A", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/private/tmp/callflow-focus-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Ändra urval", exact: true }).click();
  await page.getByLabel("Välj grupp för ringpass").selectOption("insta");
  await page.screenshot({
    path: "/private/tmp/callflow-focus-mobile-selection.png",
    fullPage: true,
  });
  await page
    .getByRole("button", { name: "Behåll pausat", exact: true })
    .click();
  expect((await snapshot(page)).sessions[0].selectedGroup).toBe("maps");
  expect((await snapshot(page)).sessions[0].status).toBe("paused");
});

test("an unvisited callback enters an empty active queue when its time arrives", async ({
  page,
}) => {
  await page.clock.install({ time: new Date() });
  const d = fixture();
  d.leads[1].nextFollowUpAt = new Date(Date.now() + 120000).toISOString();
  await seed(page, d);
  await page.getByLabel("Välj grupp för ringpass").selectOption("maps");
  await page
    .getByRole("button", { name: "Starta ringpass", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Kartbolag A", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Hoppa över N", exact: true }).click();
  await expect(
    page.getByRole("heading", {
      name: "Alla leads som är redo är genomgångna.",
      exact: true,
    }),
  ).toBeVisible();
  await page.clock.fastForward(121000);
  await expect(
    page.getByRole("heading", { name: "Kartbolag B", exact: true }),
  ).toBeVisible();
  expect((await snapshot(page)).calls).toHaveLength(0);
});
