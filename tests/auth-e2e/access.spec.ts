import { test, expect } from "@playwright/test";
for (const path of ["/", "/leads", "/focus"]) {
  test(`production ${path} requires login even with missing config and local-mode env`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.addInitScript(() =>
      localStorage.setItem(
        "callflow.data.v1",
        JSON.stringify({ leads: [{ companyName: "Gammal demo" }] }),
      ),
    );
    await page.goto(path);
    await expect(
      page.getByRole("heading", { name: "Välkommen tillbaka." }),
    ).toBeVisible();
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: "Inloggningen är inte konfigurerad" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "En bra dag för nya möjligheter." }),
    ).toHaveCount(0);
    await expect(page.getByText("Gammal demo", { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: /Återställ demodata|Öppna lokalt arbetsrum/,
      }),
    ).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}
