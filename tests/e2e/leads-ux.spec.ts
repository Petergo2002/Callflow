import { test, expect, Page } from "@playwright/test";
import { Data, emptyData, makeLead } from "../../src/lib/model";
function fixture(count = 1) {
  const d = emptyData();
  d.leads = Array.from({ length: count }, (_, i) =>
    makeLead({
      companyName: `Företag ${String(i).padStart(2, "0")}`,
      phone: "0701234567",
      website: "https://example.com",
      industry: "",
      city: "",
      contactName: "",
      notes: "",
      status: "Ej kontaktad",
      source: i % 2 ? "Instagram" : "Google Maps",
    }),
  );
  return d;
}
async function seed(page: Page, data: Data) {
  await page.addInitScript((d) => {
    if (!localStorage.getItem("callflow.data.v1"))
      localStorage.setItem("callflow.data.v1", JSON.stringify(d));
  }, data);
  await page.goto("/leads");
}
async function snapshot(page: Page) {
  return page.evaluate(
    () => JSON.parse(localStorage.getItem("callflow.data.v1")!) as Data,
  );
}
test("group creation, selected-group context and repeated lead saves", async ({
  page,
}) => {
  await seed(page, fixture());
  await expect(page.getByLabel("Filtrera källa")).toHaveCount(0);
  await expect(
    page.getByRole("columnheader", { name: "Hemsida", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("button", { name: "Hantera grupper", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Skapa din första grupp", exact: true })
    .click();
  await page
    .getByLabel("Gruppnamn", { exact: true })
    .fill("Restauranger Göteborg");
  await page.getByLabel("Blå", { exact: true }).check();
  await page.screenshot({
    path: "/private/tmp/callflow-group-editor.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Skapa grupp", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Öppna gruppen Restauranger Göteborg",
      exact: true,
    })
    .click();
  const group = (await snapshot(page)).groups[0];
  await expect(page.getByLabel("Filtrera grupp")).toHaveValue(group.id);
  await page
    .getByRole("button", { name: "Lägg till företag", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Grupp", exact: true }),
  ).toHaveValue(group.id);
  await page.getByLabel("Företagsnamn *").fill("Nya restaurangen");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Lägg till företag", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /^Nya restaurangen/ }),
  ).toBeVisible();
  expect(
    (await snapshot(page)).leads.find(
      (l) => l.companyName === "Nya restaurangen",
    )?.groupId,
  ).toBe(group.id);
  await page.getByRole("button", { name: "Importera", exact: true }).click();
  await page.getByLabel("Välj importfil").setInputFiles({
    name: "grupp.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Företag;Telefon\nImportbolaget;0701112233"),
  });
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Fortsätt", exact: true }).click();
  await expect(page.getByLabel("Grupp för importen")).toHaveValue(group.id);
  await page.getByRole("button", { name: "Stäng dialog", exact: true }).click();
  await page.getByRole("button", { name: /^Nya restaurangen/ }).click();
  await page
    .getByRole("combobox", { name: "Grupp", exact: true })
    .selectOption("__new__");
  await page.getByLabel("Namn på ny grupp").fill("VIP-listan");
  await page
    .getByRole("button", { name: "Spara ändringar", exact: true })
    .click();
  const created = (await snapshot(page)).groups.find(
    (g) => g.name === "VIP-listan",
  )!;
  await expect(
    page.getByRole("combobox", { name: "Grupp", exact: true }),
  ).toHaveValue(created.id);
  await page
    .getByLabel("Anteckningar", { exact: true })
    .fill("Andra ändringen sparas också");
  await page
    .getByRole("button", { name: "Spara ändringar", exact: true })
    .click();
  expect((await snapshot(page)).groups).toHaveLength(2);
  expect(
    (await snapshot(page)).leads.find(
      (l) => l.companyName === "Nya restaurangen",
    )?.notes,
  ).toBe("Andra ändringen sparas också");
});
test("contextual bulk actions handle all pages and create a group atomically", async ({
  page,
}) => {
  await seed(page, fixture(55));
  await page.getByLabel("Sortera leads").selectOption("companyName:asc");
  await expect(page.getByLabel("Källa för valda leads")).toHaveCount(0);
  await page
    .getByRole("checkbox", { name: "Välj alla på sidan", exact: true })
    .check();
  await expect(page.getByText("50 valda", { exact: true })).toBeVisible();
  await page
    .getByRole("button", { name: "Välj alla 55 träffar", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Flytta till grupp", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Flytta leads", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("Grupp för valda leads").selectOption("__new__");
  await page.getByLabel("Namn på ny grupp").fill("Nästa veckas ringlista");
  await page.screenshot({
    path: "/private/tmp/callflow-bulk-group.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Flytta leads", exact: true }).click();
  const d = await snapshot(page);
  expect(d.groups).toHaveLength(1);
  expect(d.leads.every((l) => l.groupId === d.groups[0].id)).toBe(true);
  await expect(
    page.getByText("55 leads har flyttats till gruppen.", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("checkbox", { name: "Välj Företag 00", exact: true })
    .check();
  await page.getByRole("button", { name: "Ändra status", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Spara ändring", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Ny status för valda leads")
    .selectOption("Intresserad");
  await page
    .getByRole("button", { name: "Spara ändring", exact: true })
    .click();
  expect(
    (await snapshot(page)).leads.find((l) => l.companyName === "Företag 00")
      ?.status,
  ).toBe("Intresserad");
  await page
    .getByRole("checkbox", { name: "Välj Företag 00", exact: true })
    .check();
  await page.getByRole("button", { name: /^Filter/ }).click();
  await page.getByLabel("Filtrera källa").selectOption("Instagram");
  await expect(
    page.getByRole("button", { name: "Flytta till grupp", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Stäng filter", exact: true }).click();
  await expect(
    page.getByRole("button", {
      name: "Ta bort filter Källa: Instagram",
      exact: true,
    }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "Ta bort filter Källa: Instagram",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "Välj Företag 00", exact: true }),
  ).not.toBeChecked();
});
test("mobile cards preserve selection, details and filters without horizontal scrolling", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await seed(page, fixture(3));
  await expect(page.locator(".lead-card")).toHaveCount(3);
  await expect(page.locator("table")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Visa fler detaljer", exact: true })
    .click();
  await expect(page.locator(".lead-card").first()).toContainText(
    "samtalsförsök",
  );
  await page
    .getByRole("checkbox", { name: "Välj Företag 00", exact: true })
    .check();
  await expect(
    page.getByRole("button", { name: "Flytta till grupp", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^Filter/ }).click();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Filtrera källa").selectOption("Instagram");
  await expect(page.locator(".lead-card")).toHaveCount(1);
  await page.screenshot({
    path: "/private/tmp/callflow-leads-filters-mobile.png",
    fullPage: true,
  });
});
