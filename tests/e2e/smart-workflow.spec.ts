import { test, expect, Page } from "@playwright/test";
import { Data, emptyData, makeLead, stockholmInput } from "../../src/lib/model";
const input = (companyName: string, phone = "0701234567") => ({
  companyName,
  phone,
  website: "",
  city: "Göteborg",
  industry: "",
  contactName: "Anna",
  notes: "",
  status: "Ej kontaktad" as const,
});
async function seed(page: Page, data: Data, url = "/") {
  await page.addInitScript((data) => {
    if (!localStorage.getItem("callflow.data.v1"))
      localStorage.setItem("callflow.data.v1", JSON.stringify(data));
  }, data);
  await page.goto(url);
}
async function snapshot(page: Page): Promise<Data> {
  return page.evaluate(() =>
    JSON.parse(localStorage.getItem("callflow.data.v1")!),
  );
}

test("no-answer suggests a persisted retry and shows attempt history", async ({
  page,
}) => {
  const d = emptyData();
  d.leads = [makeLead(input("Obesvarat"))];
  await seed(page, d, "/focus");
  await page
    .getByRole("button", { name: "Starta ringpass", exact: true })
    .click();
  await page.getByRole("button", { name: "Inget svar 1", exact: true }).click();
  await expect(page.getByText(/Inget svar\. Nästa försök/)).toBeVisible();
  const stored = await snapshot(page);
  expect(new Date(stored.leads[0].nextRetryAt!).getTime()).toBeGreaterThan(
    Date.now(),
  );
  await page.goto("/leads");
  await page.getByRole("button", { name: "Obesvarat", exact: true }).click();
  await expect(page.getByText(/1 försök, aldrig svarat/)).toBeVisible();
  await page.reload();
  expect((await snapshot(page)).leads[0].nextRetryAt).toBe(
    stored.leads[0].nextRetryAt,
  );
});

test("records and undoes an incoming callback without replacing the original focus queue", async ({
  page,
}) => {
  const d = emptyData();
  d.groups = [
    {
      id: "queue",
      name: "Kön",
      color: "#16724c",
      createdAt: new Date().toISOString(),
    },
  ];
  d.leads = [
    makeLead({ ...input("Köföretaget", "0709999999"), groupId: "queue" }),
    makeLead(
      { ...input("Ringer tillbaka"), status: "Inget svar" },
      { lastContactedAt: new Date().toISOString() },
    ),
  ];
  await seed(page, d, "/focus");
  await page.getByLabel("Välj grupp för ringpass").selectOption("queue");
  await page
    .getByRole("button", { name: "Starta ringpass", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Sök nummer eller företag", exact: true })
    .click();
  await page.getByLabel("Sök i arbetsrummet").fill("+46701234567");
  await page.getByLabel("Sök i arbetsrummet").press("Enter");
  await page
    .getByRole("button", { name: "Registrera inkommande samtal", exact: true })
    .click();
  await page
    .getByLabel("Resultat av inkommande samtal")
    .selectOption("Återkom senare");
  await page
    .getByLabel("Anteckning från inkommande samtal")
    .fill("Vill ha offert, ring på torsdag");
  const dueAt = new Date(Date.now() + 2 * 86400000).toISOString();
  await page
    .getByLabel("Återringning efter inkommande samtal")
    .fill(stockholmInput(dueAt));
  await page
    .getByRole("button", { name: "Spara inkommande samtal", exact: true })
    .click();
  await expect(page.getByText(/Inkommande samtal sparat/)).toBeVisible();
  const stored = await snapshot(page);
  expect(stored.calls).toHaveLength(1);
  expect(stored.calls[0]).toMatchObject({
    direction: "incoming",
    leadId: d.leads[1].id,
    outcome: "Återkom senare",
    notes: "Vill ha offert, ring på torsdag",
  });
  expect(stored.sessions[0]).toMatchObject({
    status: "paused",
    selectedGroup: "queue",
    currentLeadId: d.leads[0].id,
    visited: [],
  });
  expect(stored.leads[1].nextStep?.kind).toBe("call");
  await page.screenshot({
    path: "/private/tmp/callflow-incoming-outcome.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Ångra", exact: true }).click();
  expect((await snapshot(page)).calls).toHaveLength(0);
  await page.getByRole("button", { name: "Stäng", exact: true }).click();
  await page.getByRole("button", { name: "Fortsätt", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Köföretaget", exact: true }),
  ).toBeVisible();
});

test("work-now surfaces missing plans and overdue tasks, planning survives reload and completion", async ({
  page,
}) => {
  const d = emptyData();
  d.leads = [
    makeLead({ ...input("Behöver plan"), status: "Intresserad" }),
    makeLead(
      { ...input("Försenad offert", "0702222222"), status: "Intresserad" },
      {
        nextStep: {
          kind: "offer",
          dueAt: new Date(Date.now() - 86400000).toISOString(),
          note: "Pris till Anna",
        },
      },
    ),
  ];
  await seed(page, d);
  const now = page.getByRole("region", { name: "Gör detta nu" });
  await expect(
    now.getByRole("button", { name: /Försenad offert/ }),
  ).toBeVisible();
  await expect(now.getByRole("button", { name: /Behöver plan/ })).toBeVisible();
  await page.screenshot({
    path: "/private/tmp/callflow-work-now.png",
    fullPage: true,
  });
  await now.getByRole("button", { name: /Behöver plan/ }).click();
  await page.getByLabel("Vad ska hända?").selectOption("offer");
  await page
    .getByLabel("Offert klar senast · svensk tid")
    .fill(stockholmInput(new Date(Date.now() + 86400000).toISOString()));
  await page
    .getByLabel("Kort beskrivning av nästa steg")
    .fill("Pris på hemsida till Anna");
  await page
    .getByRole("button", { name: "Spara nästa steg", exact: true })
    .click();
  await expect(
    page.getByText("Nästa steg sparat.", { exact: true }),
  ).toBeVisible();
  expect((await snapshot(page)).leads[0].nextStep).toMatchObject({
    kind: "offer",
    note: "Pris på hemsida till Anna",
  });
  await page.getByRole("button", { name: "Stäng", exact: true }).click();
  await expect(now.getByRole("button", { name: /Behöver plan/ })).toHaveCount(
    0,
  );
  await page.reload();
  await now.getByRole("button", { name: /Försenad offert/ }).click();
  await page
    .getByRole("button", { name: "Markera nästa steg klart", exact: true })
    .click();
  expect((await snapshot(page)).leads[1].nextStep).toBeUndefined();
  await page.getByRole("button", { name: "Stäng", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/private/tmp/callflow-work-now-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("duplicate review merges selected records and keeps alternative numbers searchable after reload", async ({
  page,
}) => {
  const d = emptyData();
  d.leads = [
    makeLead({
      ...input("Huvudpost"),
      website: "same.se",
      notes: "Spara denna",
      status: "Intresserad",
    }),
    makeLead({
      ...input("Dubblettpost", "0702222222"),
      website: "www.same.se",
      notes: "Även denna ska sparas",
    }),
  ];
  d.calls = [
    {
      id: "old",
      leadId: d.leads[1].id,
      createdAt: new Date().toISOString(),
      notes: "Ringde utan svar",
      outcome: "Inget svar",
    },
  ];
  d.followUps = [
    {
      id: "promise",
      leadId: d.leads[1].id,
      dueAt: new Date(Date.now() + 86400000).toISOString(),
      notes: "Ring igen",
      status: "pending",
    },
  ];
  await seed(page, d, "/leads");
  await page
    .getByRole("button", { name: "Granska dubbletter", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: /Huvudpost.*Dubblettpost|Dubblettpost.*Huvudpost/,
    })
    .click();
  await page.getByLabel("Behåll Huvudpost som huvudpost").check();
  await expect(page.getByText("Spara denna", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Även denna ska sparas", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "/private/tmp/callflow-duplicate-review.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({
    path: "/private/tmp/callflow-duplicate-review-mobile.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page
    .getByRole("button", { name: "Slå ihop valda företag", exact: true })
    .click();
  await expect(page.getByText(/Sammanslaget till Huvudpost/)).toBeVisible();
  await page
    .getByRole("button", { name: "Ångra sammanslagning", exact: true })
    .click();
  expect((await snapshot(page)).leads).toHaveLength(2);
  await page
    .getByRole("button", {
      name: /Huvudpost.*Dubblettpost|Dubblettpost.*Huvudpost/,
    })
    .click();
  await page.getByLabel("Behåll Huvudpost som huvudpost").check();
  await page
    .getByRole("button", { name: "Slå ihop valda företag", exact: true })
    .click();

  const merged = await snapshot(page);
  expect(merged.leads).toHaveLength(1);
  expect(merged.leads[0].notes).toContain("Även denna ska sparas");
  expect(merged.calls[0].leadId).toBe(d.leads[0].id);
  expect(merged.followUps[0].leadId).toBe(d.leads[0].id);
  await page.getByRole("button", { name: "Stäng", exact: true }).click();
  await page.reload();
  await page.getByLabel("Sök företag", { exact: true }).fill("+46702222222");
  await expect(
    page.getByRole("button", { name: "Huvudpost", exact: true }),
  ).toBeVisible();
});
