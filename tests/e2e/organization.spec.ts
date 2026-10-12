import { test, expect } from "@playwright/test";
import { emptyData, makeLead } from "../../src/lib/model";
test("CSV source/group/date persist, groups can be managed, leads and import can be deleted", async ({
  page,
}) => {
  page.on("dialog", (d) => d.accept());
  await page.goto("/leads");
  await page.getByRole("button", { name: "Importera", exact: true }).click();
  await page.getByLabel("Välj importfil").setInputFiles({
    name: "kartleads.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Företag;Telefon\nKartbolaget;0701234567\nBildbolaget;0707654321",
    ),
  });
  for (let i = 0; i < 3; i++)
    await page.getByRole("button", { name: "Fortsätt", exact: true }).click();
  await page.getByLabel("Källa för importen").fill("Google Maps");
  await page.getByLabel("Grupp för importen").selectOption("__new__");
  await page.getByLabel("Namn på ny grupp").fill("Kartleads Göteborg");
  await page
    .getByRole("button", { name: "Importera företag", exact: true })
    .click();
  await expect(page.getByText("Din nästa ringlista är redo.")).toBeVisible();
  await page.getByRole("button", { name: "Visa leads", exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole("button", { name: /^Kartleads Göteborg/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("row").filter({ hasText: "Kartbolaget" }),
  ).toContainText("Google Maps");
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("callflow.data.v1")!),
  );
  expect(stored.leads[0].importedAt).toBe(stored.batches[0].importedAt);
  await page.screenshot({
    path: "/private/tmp/callflow-organized-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/private/tmp/callflow-organized-mobile.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel("Välj Kartbolaget", { exact: true }).check();
  await page.getByLabel("Källa för valda leads").fill("Instagram");
  await page
    .getByRole("button", { name: "Spara gruppering", exact: true })
    .click();
  await page.getByLabel("Filtrera källa").selectOption("Instagram");
  await expect(
    page.getByRole("button", { name: /^Kartbolaget/ }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Bildbolaget/ })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Rensa filter", exact: true }).click();
  await page
    .getByRole("button", { name: "Hantera grupper", exact: true })
    .click();
  await page.getByLabel("Namn på Kartleads Göteborg").fill("Prioriterade");
  await page
    .getByRole("button", { name: "Spara gruppen Kartleads Göteborg" })
    .click();
  await expect(page.getByLabel("Namn på Prioriterade")).toBeVisible();
  await page
    .getByRole("button", { name: "Ta bort gruppen Prioriterade" })
    .click();
  await page.getByRole("button", { name: "Stäng dialog", exact: true }).click();
  await expect(
    page.getByRole("button", { name: /^Kartbolaget/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Ta bort Kartbolaget", exact: true })
    .click();
  await expect(page.getByRole("button", { name: /^Kartbolaget/ })).toHaveCount(
    0,
  );
  await page.getByLabel("Filtrera import").selectOption(stored.batches[0].id);
  await page
    .getByRole("button", { name: "Ta bort import", exact: true })
    .click();
  await expect(page.getByRole("button", { name: /^Bildbolaget/ })).toHaveCount(
    0,
  );
  const after = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("callflow.data.v1")!),
  );
  expect(after.leads).toEqual([]);
  expect(after.groups).toEqual([]);
  expect(after.batches).toEqual([]);
});
test("source/group/date filters and import-date sorting apply to legacy imports too", async ({
  page,
}) => {
  const d = emptyData();
  d.groups = [
    {
      id: "group",
      name: "Min ringlista",
      color: "#16724c",
      createdAt: "2026-10-01T09:00:00Z",
    },
  ];
  d.batches = [
    {
      id: "old",
      filename: "äldre.csv",
      importedAt: "2026-10-01T09:00:00Z",
      importedCount: 1,
      duplicateCount: 0,
      rejectedCount: 0,
    },
    {
      id: "new",
      filename: "nyare.csv",
      importedAt: "2026-10-12T09:00:00Z",
      importedCount: 1,
      duplicateCount: 0,
      rejectedCount: 0,
    },
  ];
  for (const [name, batch, source] of [
    ["Äldre företaget", "old", "Google Maps"],
    ["Nyare företaget", "new", "Instagram"],
  ])
    d.leads.push(
      makeLead(
        {
          companyName: name,
          phone: "0701234567",
          website: "",
          industry: "",
          city: "",
          contactName: "",
          notes: "",
          status: "Ej kontaktad",
          source,
          groupId: "group",
        },
        { importBatchId: batch },
      ),
    );
  await page.addInitScript((d) => {
    if (!localStorage.getItem("callflow.data.v1"))
      localStorage.setItem("callflow.data.v1", JSON.stringify(d));
  }, d);
  await page.goto("/leads");
  await page.getByLabel("Sortera leads").selectOption("importedAt:asc");
  await expect(page.locator("tbody tr").first()).toContainText(
    "Äldre företaget",
  );
  await page.getByLabel("Sortera leads").selectOption("importedAt:desc");
  await expect(page.locator("tbody tr").first()).toContainText(
    "Nyare företaget",
  );
  await page.getByLabel("Importerad från datum").fill("2026-10-10");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toContainText("Nyare företaget");
  await page.getByRole("button", { name: "Rensa filter", exact: true }).click();
  await page.getByLabel("Filtrera källa").selectOption("Google Maps");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toContainText("Äldre företaget");
});
