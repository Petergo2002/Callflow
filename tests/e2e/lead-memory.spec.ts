import { test, expect } from "@playwright/test";
import { emptyData, makeLead } from "../../src/lib/model";
test("contact memory explains blocked numbers and lead card schedules a followup without logging a call", async ({
  page,
}) => {
  const data = emptyData();
  data.leads = [
    makeLead(
      {
        companyName: "Redan ringd",
        phone: "0701234567",
        website: "",
        industry: "",
        city: "",
        contactName: "",
        notes: "Skicka offert",
        status: "Intresserad",
      },
      { lastContactedAt: new Date().toISOString() },
    ),
  ];
  await page.addInitScript((data) => {
    if (!localStorage.getItem("callflow.data.v1"))
      localStorage.setItem("callflow.data.v1", JSON.stringify(data));
  }, data);
  await page.goto("/focus");
  await expect(
    page.getByText("0 leads redo att ringa", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("1 redan ringda idag", { exact: true }),
  ).toBeVisible();
  await page.goto("/leads");
  await page
    .getByRole("button", { name: "Redan ringd", exact: true })
    .first()
    .click();
  await expect(page.getByRole("heading", { name: "Nästa steg" })).toBeVisible();
  await page
    .getByLabel("Uppföljningstid · svensk tid")
    .fill("2027-01-20T10:00");
  await page
    .getByRole("button", { name: "Boka uppföljning", exact: true })
    .click();
  await expect(page.getByText(/Planerad:.*20 jan/)).toBeVisible();
  await page.screenshot({
    path: "/private/tmp/callflow-lead-memory.png",
    fullPage: true,
  });
  const stored = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("callflow.data.v1")!),
  );
  expect(stored.calls).toHaveLength(0);
  expect(stored.followUps).toHaveLength(1);
  expect(stored.followUps[0]).toMatchObject({
    status: "pending",
    notes: "Skicka offert",
    dueAt: "2027-01-20T09:00:00.000Z",
  });
  await page.reload();
  await page
    .getByRole("button", { name: "Redan ringd", exact: true })
    .first()
    .click();
  await expect(page.getByText(/Planerad:.*20 jan/)).toBeVisible();
});

test("incoming number lookup pauses focus and opens unanswered company history without losing the queue", async ({
  page,
}) => {
  const data = emptyData();
  const input = {
    website: "",
    industry: "",
    city: "Göteborg",
    contactName: "Anna",
    notes: "",
    status: "Ej kontaktad" as const,
  };
  data.leads = [
    makeLead({ ...input, companyName: "Ringkön", phone: "0709999999" }),
    makeLead(
      {
        ...input,
        companyName: "Återringaren",
        phone: "070-123 45 67",
        status: "Inget svar",
        notes: "Fråga efter Anna",
      },
      { lastContactedAt: new Date().toISOString() },
    ),
  ];
  data.calls = [
    {
      id: "missed",
      leadId: data.leads[1].id,
      outcome: "Inget svar",
      notes: "Ringde om offert",
      createdAt: new Date().toISOString(),
    },
  ];
  await page.addInitScript((data) => {
    if (!localStorage.getItem("callflow.data.v1"))
      localStorage.setItem("callflow.data.v1", JSON.stringify(data));
  }, data);
  await page.goto("/focus");
  await page
    .getByRole("button", { name: "Starta ringpass", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ringkön", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Sök nummer eller företag", exact: true })
    .click();
  const search = page.getByLabel("Sök i arbetsrummet");
  await expect(search).toBeFocused();
  await search.fill("+46 70 123 45 67");
  await expect(
    page.getByText("Exakt nummerträff", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog").getByText("Inget svar", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: "/private/tmp/callflow-number-lookup.png",
    fullPage: true,
  });
  await search.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Återringaren", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Ringde om offert", { exact: true }),
  ).toBeVisible();
  const paused = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("callflow.data.v1")!),
  );
  expect(paused.sessions[0]).toMatchObject({
    status: "paused",
    currentLeadId: data.leads[0].id,
    visited: [],
  });
  expect(paused.calls).toHaveLength(1);
  await page.getByRole("button", { name: "Stäng", exact: true }).click();
  await page.getByRole("button", { name: "Fortsätt", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ringkön", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("/");
  await search.fill("000999888");
  await expect(
    page.getByText("Inga företag matchar din sökning."),
  ).toBeVisible();
  await search.fill("1234567");
  await expect(
    page.getByRole("dialog").getByText("Återringaren", { exact: true }),
  ).toBeVisible();
});
