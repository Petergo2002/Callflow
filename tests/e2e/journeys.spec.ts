import { test, expect, Page } from "@playwright/test";
import ExcelJS from "exceljs";
import { emptyData, makeLead } from "../../src/lib/model";
import { readFile } from "node:fs/promises";
const key = "callflow.data.v1";
async function snapshot(page: Page) {
  return page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), key);
}
async function clean(page: Page) {
  await page.addInitScript(
    ({ key, data }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(data));
    },
    { key, data: emptyData() },
  );
}
async function uploadCsv(
  page: Page,
  content: string,
  filename = "företag.csv",
) {
  await page.getByRole("button", { name: "Importera", exact: true }).click();
  await page.getByLabel("Välj importfil").setInputFiles({
    name: filename,
    mimeType: "text/csv",
    buffer: Buffer.from(content),
  });
  await expect(
    page.getByRole("button", { name: "Fortsätt", exact: true }),
  ).toBeEnabled();
}
async function importSteps(page: Page) {
  await page.getByRole("button", { name: "Fortsätt", exact: true }).click();
  await page.getByRole("button", { name: "Fortsätt", exact: true }).click();
  await page.getByRole("button", { name: "Fortsätt", exact: true }).click();
  await page
    .getByRole("button", { name: "Importera företag", exact: true })
    .click();
  await expect(page.getByText("Din nästa ringlista är redo.")).toBeVisible();
}
test("500 CSV leads → call → keyboard → callback → pause/refresh → undo → export → edit/delete", async ({
  page,
}) => {
  await clean(page);
  await page.goto("/leads");
  await uploadCsv(
    page,
    "Företagsnamn;Telefon;Hemsida;Bransch;Ort\r\n" +
      Array.from(
        { length: 500 },
        (_, i) =>
          `Ångström ${String(i).padStart(3, "0")};070${String(i).padStart(7, "0")};firma${i}.se;Bygg;Göteborg`,
      ).join("\r\n"),
  );
  await page.getByRole("button", { name: "Fortsätt", exact: true }).click();
  await expect(page.getByLabel("Företagsnamn *")).toHaveValue("0");
  await expect(
    page.getByRole("combobox", { name: "Telefon", exact: true }),
  ).toHaveValue("1");
  await page.getByRole("button", { name: "Fortsätt", exact: true }).click();
  await expect(page.getByText("0700000000", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Fortsätt", exact: true }).click();
  await page
    .getByRole("button", { name: "Importera företag", exact: true })
    .click();
  await expect(
    page.getByText("500 företag importerades.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Visa leads", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(50);
  expect((await snapshot(page)).leads.length).toBe(500);
  await uploadCsv(
    page,
    "Company,Phone,Website\nÅngström 000,0700000000,firma0.se",
  );
  await importSteps(page);
  await expect(
    page.getByText("1 dubbletter hoppades över.", { exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Visa leads", exact: true }).click();
  await page.getByRole("link", { name: "Fokusläge", exact: true }).click();
  await page
    .getByLabel("Välj ringlista")
    .selectOption({ label: "företag.csv" });
  await page
    .getByRole("button", { name: "Starta ringpass", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ångström 000", exact: true }),
  ).toBeVisible();
  const before = await snapshot(page);
  await page
    .getByRole("button", { name: "Inget svar 1", exact: true })
    .dblclick();
  await expect(
    page.getByRole("heading", { name: "Ångström 001", exact: true }),
  ).toBeVisible();
  expect((await snapshot(page)).calls.length - before.calls.length).toBe(1);
  await expect(
    page.getByRole("button", { name: "Inget svar 1", exact: true }),
  ).toBeEnabled();
  await page.locator("body").press("4");
  await expect(
    page.getByRole("heading", { name: "Ångström 002", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ring tillbaka 3", exact: true }),
  ).toBeEnabled();
  await page
    .getByRole("button", { name: "Ring tillbaka 3", exact: true })
    .click();
  await page.getByRole("button", { name: "Imorgon", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ångström 003", exact: true }),
  ).toBeVisible();
  let d = await snapshot(page);
  expect(d.calls.length).toBe(3);
  expect(
    d.xp.reduce((s: number, e: { points: number }) => s + e.points, 0),
  ).toBe(15);
  expect(d.followUps.length).toBe(1);
  await page
    .getByLabel("Dina anteckningar")
    .fill("Svenska anteckningar ÅÄÖ 123");
  await page.getByLabel("Dina anteckningar").press("1");
  expect((await snapshot(page)).calls.length).toBe(3);
  await page.getByRole("button", { name: "Pausa", exact: true }).click();
  const savedDuration = (await snapshot(page)).sessions[0].activeDuration;
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Ta ett andetag.", exact: true }),
  ).toBeVisible();
  expect((await snapshot(page)).sessions[0].activeDuration).toBe(savedDuration);
  await page
    .getByRole("button", { name: "Fortsätt ringpass", exact: true })
    .click();
  await expect(page.getByLabel("Dina anteckningar")).toHaveValue(
    "Svenska anteckningar ÅÄÖ 1231",
  );
  await page.getByRole("button", { name: "Kund 6", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ångström 004", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Ångra", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ångström 003", exact: true }),
  ).toBeVisible();
  d = await snapshot(page);
  expect(d.calls.length).toBe(3);
  expect(
    d.xp.reduce((s: number, e: { points: number }) => s + e.points, 0),
  ).toBe(15);
  await expect(
    page.getByRole("button", { name: "Hoppa över N", exact: true }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Hoppa över N", exact: true }).click();
  expect((await snapshot(page)).calls.length).toBe(3);
  await page.getByRole("button", { name: "Avsluta", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Bra jobbat. Du tog nästa steg." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Klart", exact: true }).click();
  await page.goto("/statistics");
  await expect(page.getByText("3 samtal", { exact: true })).toBeVisible();
  await page.goto("/leads");
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Exportera CSV", exact: true })
    .click();
  const download = await downloading;
  const path = await download.path();
  const exported = await readFile(path!, "utf8");
  expect(exported.startsWith("\ufeff")).toBe(true);
  expect(exported).toContain("Ångström 000");
  expect(exported).toContain("0700000000");
  await page.getByLabel("Sök företag", { exact: true }).fill("Ångström 010");
  await page.getByRole("button", { name: /^Ångström 010 Bygg/ }).click();
  await page.getByLabel("Kontaktperson", { exact: true }).fill("Emma Öster");
  await page
    .getByRole("button", { name: "Spara ändringar", exact: true })
    .click();
  await page.getByRole("button", { name: "Stäng", exact: true }).click();
  expect(
    (await snapshot(page)).leads.find(
      (l: { companyName: string }) => l.companyName === "Ångström 010",
    ).contactName,
  ).toBe("Emma Öster");
  await page.getByLabel("Välj Ångström 010", { exact: true }).check();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Ta bort", exact: true }).click();
  expect((await snapshot(page)).leads.length).toBe(499);
  await page.reload();
  expect((await snapshot(page)).leads.length).toBe(499);
});
test("Excel requires worksheet selection, preserves zeroes and ignores formulas", async ({
  page,
}) => {
  await clean(page);
  await page.goto("/leads");
  const wb = new ExcelJS.Workbook();
  const a = wb.addWorksheet("Välj inte mig");
  a.addRow(["Company", "Phone"]);
  a.addRow(["Fel företag", "0709999999"]);
  const b = wb.addWorksheet("Rätt lista");
  b.addRow(["Företag", "Telefon", "Hemsida"]);
  b.addRow(["Öster & Äng", "031-123 45 67", "oster.se"]);
  const row = b.addRow([
    "Björk AB",
    701234567,
    { formula: 'HYPERLINK("https://bad.test")', result: "Kör inte" },
  ]);
  row.getCell(2).numFmt = "0000000000";
  await page.getByRole("button", { name: "Importera", exact: true }).click();
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  await page.getByLabel("Välj importfil").setInputFiles({
    name: "listor.xlsx",
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    buffer,
  });
  await expect(page.getByLabel("Välj kalkylblad")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Fortsätt", exact: true }),
  ).toBeDisabled();
  await page
    .getByLabel("Välj kalkylblad")
    .selectOption({ label: "Rätt lista · 2 rader" });
  await importSteps(page);
  const d = await snapshot(page);
  expect(d.leads.length).toBe(2);
  expect(d.leads[0].companyName).toBe("Öster & Äng");
  expect(d.leads[1].phone).toBe("0701234567");
  expect(d.leads[1].website).toBe("");
});
test("manual lead creation, goals, theme and clear data persist without restoring demo", async ({
  page,
}) => {
  await clean(page);
  await page.goto("/leads");
  await page
    .getByRole("button", { name: "Lägg till företag", exact: true })
    .first()
    .click();
  await page.getByLabel("Företagsnamn *").fill("Nytt ÅÄÖ AB");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Lägg till företag", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: /^Nytt ÅÄÖ AB/ }),
  ).toBeVisible();
  await page.goto("/settings");
  await page.getByLabel("Samtal per dag", { exact: true }).fill("50");
  await page.getByLabel("Tema", { exact: true }).selectOption("dark");
  await page.getByRole("button", { name: "Spara inställningar" }).click();
  await expect(page.locator("html")).toHaveClass("dark");
  await page.reload();
  await expect(page.getByLabel("Samtal per dag", { exact: true })).toHaveValue(
    "50",
  );
  expect((await snapshot(page)).settings.theme).toBe("dark");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Radera all data" }).click();
  await page.reload();
  expect((await snapshot(page)).leads.length).toBe(0);
  await page.goto("/");
  await expect(
    page.getByText("Du utforskar ett arbetsrum", { exact: false }),
  ).toHaveCount(0);
});
test("storage quota failure does not claim success or lose the previous data", async ({
  page,
}) => {
  await clean(page);
  await page.goto("/leads");
  await page.evaluate(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("Quota", "QuotaExceededError");
    };
  });
  await page
    .getByRole("button", { name: "Lägg till företag", exact: true })
    .first()
    .click();
  await page.getByLabel("Företagsnamn *").fill("Ska inte sparas");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Lägg till företag", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("kunde inte sparas");
  expect((await snapshot(page)).leads.length).toBe(0);
  await expect(page.getByRole("dialog")).toBeVisible();
});
test("future callback becomes first eligible lead next day, mobile screens fit", async ({
  page,
}) => {
  const d = emptyData();
  const first = makeLead(
    {
      companyName: "Framtida callback",
      phone: "0701234567",
      website: "",
      industry: "",
      city: "",
      contactName: "",
      notes: "",
      status: "Återkom senare",
    },
    { nextFollowUpAt: "2026-10-13T07:00:00.000Z" },
  );
  const second = makeLead({
    companyName: "Ny möjlighet",
    phone: "0311234567",
    website: "",
    industry: "",
    city: "",
    contactName: "",
    notes: "",
    status: "Ej kontaktad",
  });
  d.leads.push(first, second);
  d.followUps.push({
    id: "f",
    leadId: first.id,
    dueAt: first.nextFollowUpAt!,
    notes: "Ring imorgon",
    status: "pending",
  });
  await page.clock.install({ time: new Date("2026-10-12T10:00Z") });
  await page.addInitScript(
    ({ key, d }) => {
      if (!localStorage.getItem(key))
        localStorage.setItem(key, JSON.stringify(d));
    },
    { key, d },
  );
  await page.goto("/focus");
  await page
    .getByRole("button", { name: "Starta ringpass", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ny möjlighet", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Avsluta", exact: true }).click();
  await page.getByRole("button", { name: "Klart", exact: true }).click();
  await page.clock.setSystemTime(new Date("2026-10-13T08:00Z"));
  await page
    .getByRole("button", { name: "Starta ringpass", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Framtida callback", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Ring tillbaka 3", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
