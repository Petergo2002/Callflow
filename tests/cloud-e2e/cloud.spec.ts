import { test, expect, Page } from "@playwright/test";
import { Data, emptyData, makeLead } from "../../src/lib/model";
const url = "https://wnexrlghlmotkysrofkl.supabase.co";
const owner = "11111111-1111-4111-8111-111111111111";
const email = "agenter0202@gmail.com";
interface Server {
  document: Data | null;
  revision: number;
  offline: boolean;
  allowed: boolean;
}
async function mockCloud(page: Page, server: Server, authenticated = true) {
  await page.route(url + "/**", async (route) => {
    const request = route.request(),
      u = new URL(request.url());
    const headers = { "Content-Type": "application/json" };
    const send = (value: unknown, status = 200) =>
      route.fulfill({ status, headers, body: JSON.stringify(value) });
    if (u.pathname === "/auth/v1/user")
      return send({
        id: owner,
        email,
        aud: "authenticated",
        role: "authenticated",
        app_metadata: { provider: "email", providers: ["email"] },
        user_metadata: {},
        created_at: "2026-10-12T10:00:00Z",
      });
    if (u.pathname === "/auth/v1/token") {
      const body = request.postDataJSON();
      expect(u.searchParams.get("grant_type")).toBe("password");
      if (body.email !== email || body.password !== "test-password")
        return send(
          { code: "invalid_credentials", message: "Invalid login credentials" },
          400,
        );
      const payload = btoa(
        JSON.stringify({
          sub: owner,
          email,
          role: "authenticated",
          exp: Math.floor(Date.now() / 1000) + 3600,
        }),
      );
      return send({
        access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.test-only`,
        refresh_token: "test-only",
        token_type: "bearer",
        expires_in: 3600,
        user: {
          id: owner,
          email,
          aud: "authenticated",
          role: "authenticated",
          app_metadata: { provider: "email", providers: ["email"] },
          user_metadata: {},
          created_at: "2026-10-12T10:00:00Z",
        },
      });
    }
    if (u.pathname === "/rest/v1/rpc/callflow_read_workspace") {
      if (server.offline) return route.abort("failed");
      expect(request.headers().authorization).toContain("Bearer ");
      return send(
        server.document
          ? [{ document: server.document, revision: server.revision }]
          : [],
      );
    }
    if (u.pathname === "/auth/v1/logout") return send({});
    if (u.pathname === "/rest/v1/callflow_access")
      return send(server.allowed ? [{ email }] : []);
    if (u.pathname === "/rest/v1/callflow_workspaces") {
      if (server.offline) return route.abort("failed");
      if (request.method() === "GET")
        return send(
          server.document
            ? [{ document: server.document, revision: server.revision }]
            : [],
        );
      const body = request.postDataJSON();
      if (request.method() === "POST" && server.document)
        return send({ code: "23505", message: "duplicate" }, 409);
      if (
        request.method() === "PATCH" &&
        u.searchParams.get("revision") !== `eq.${server.revision}`
      )
        return send([]);
      expect(request.headers().authorization).toContain("Bearer ");
      if (request.method() === "POST") expect(body.owner_id).toBe(owner);
      expect(body.revision).toBe(server.revision + 1);
      server.document = body.document;
      server.revision = body.revision;
      return send(
        request.headers().accept?.includes("vnd.pgrst.object")
          ? { revision: server.revision }
          : [{ revision: server.revision }],
      );
    }
    return send({ error: "Unexpected mocked request" }, 500);
  });
  if (authenticated)
    await page.addInitScript(
      ({ owner, email }) => {
        const payload = btoa(
          JSON.stringify({
            sub: owner,
            email,
            role: "authenticated",
            exp: Math.floor(Date.now() / 1000) + 3600,
          }),
        );
        localStorage.setItem(
          "sb-wnexrlghlmotkysrofkl-auth-token",
          JSON.stringify({
            access_token: `eyJhbGciOiJIUzI1NiJ9.${payload}.test-only`,
            refresh_token: "test-only",
            token_type: "bearer",
            expires_in: 3600,
            expires_at: Math.floor(Date.now() / 1000) + 3600,
            user: {
              id: owner,
              email,
              aud: "authenticated",
              role: "authenticated",
              app_metadata: { provider: "email", providers: ["email"] },
              user_metadata: {},
              created_at: "2026-10-12T10:00:00Z",
            },
          }),
        );
      },
      { owner, email },
    );
}
function fixture() {
  const d = emptyData();
  d.leads = [
    makeLead({
      companyName: "Molnföretag AB",
      phone: "0701234567",
      website: "",
      industry: "Bygg",
      city: "Göteborg",
      contactName: "",
      notes: "",
      status: "Ej kontaktad",
    }),
    makeLead({
      companyName: "Nästa företag AB",
      phone: "0311234567",
      website: "",
      industry: "",
      city: "",
      contactName: "",
      notes: "",
      status: "Ej kontaktad",
    }),
  ];
  return d;
}
test("password login, rejected credentials and no registration or magic-link account creation", async ({
  page,
}) => {
  const server: Server = {
    document: null,
    revision: 0,
    offline: false,
    allowed: true,
  };
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().startsWith(url))
      requests.push(new URL(request.url()).pathname);
  });
  await mockCloud(page, server, false);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Välkommen tillbaka." }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", {
      name: /Skapa konto|Registrera|Öppna lokalt arbetsrum/,
    }),
  ).toHaveCount(0);
  await page.getByLabel("Din mejladress").fill("someone-else@example.com");
  await page.getByLabel("Lösenord", { exact: true }).fill("wrong-password");
  await page.getByRole("button", { name: "Logga in", exact: true }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Kontrollera mejladress och lösenord" }),
  ).toBeVisible();
  expect(server.document).toBeNull();
  const retired = await page.request.post("/api/auth/login", {
    data: { email },
  });
  expect(retired.status()).toBe(410);
  await page.getByLabel("Din mejladress").fill(email);
  await page.getByLabel("Lösenord", { exact: true }).fill("test-password");
  await page.getByRole("button", { name: "Visa lösenord" }).click();
  await expect(page.getByLabel("Lösenord", { exact: true })).toHaveAttribute(
    "type",
    "text",
  );
  await page.getByRole("button", { name: "Dölj lösenord" }).click();
  await page.getByRole("button", { name: "Logga in", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "En bra dag för nya möjligheter." }),
  ).toBeVisible();
  await expect(
    page.getByText("Sparat i Supabase", { exact: true }),
  ).toBeVisible();
  expect(requests).not.toContain("/auth/v1/signup");
  expect(requests).not.toContain("/auth/v1/otp");
  await page.goto("/settings");
  await expect(
    page.getByRole("button", { name: "Återställ demodata" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Logga ut", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Välkommen tillbaka." }),
  ).toBeVisible();
  await page.goto("/leads");
  await expect(
    page.getByRole("heading", { name: "Välkommen tillbaka." }),
  ).toBeVisible();
});
test("migrates local history once and keeps the original local copy", async ({
  page,
}) => {
  const old = fixture();
  const server: Server = {
    document: null,
    revision: 0,
    offline: false,
    allowed: true,
  };
  await mockCloud(page, server);
  await page.addInitScript((d) => {
    if (!localStorage.getItem("callflow.data.v1"))
      localStorage.setItem("callflow.data.v1", JSON.stringify(d));
  }, old);
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Ta med ditt momentum." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Överför mitt lokala arbetsrum" })
    .click();
  await expect(
    page.getByText("Sparat i Supabase", { exact: true }),
  ).toBeVisible();
  expect(server.document?.leads.length).toBe(2);
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem("callflow.data.v1")!).leads.length,
    ),
  ).toBe(2);
  const revision = server.revision;
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "En bra dag för nya möjligheter." }),
  ).toBeVisible();
  expect(server.revision).toBe(revision);
});
test("cloud call transaction, reload, outage and cross-device visibility", async ({
  page,
  browser,
}) => {
  const server: Server = {
    document: fixture(),
    revision: 1,
    offline: false,
    allowed: true,
  };
  await mockCloud(page, server);
  await page.goto("/focus");
  await page
    .getByRole("button", { name: "Starta ringpass", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Molnföretag AB" }),
  ).toBeVisible();
  await page.getByLabel("Dina anteckningar").fill("Sparat i molnet ÅÄÖ");
  await page.getByRole("button", { name: "Kund 6", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Nästa företag AB" }),
  ).toBeVisible();
  await expect(
    page.getByText("Sparat i Supabase", { exact: true }),
  ).toBeVisible();
  expect(server.document?.calls.length).toBe(1);
  expect(server.document?.xp.reduce((n, e) => n + e.points, 0)).toBe(105);
  const other = await browser.newContext();
  const second = await other.newPage();
  await mockCloud(second, server);
  await second.goto("/leads");
  await expect(
    second.getByRole("button", { name: /^Molnföretag AB/ }),
  ).toBeVisible();
  expect(
    await second.evaluate(
      () =>
        JSON.parse(
          localStorage.getItem(
            "callflow.cloud.wnexrlghlmotkysrofkl.11111111-1111-4111-8111-111111111111",
          )!,
        ).document.calls.length,
    ),
  ).toBe(1);
  await other.close();
  server.offline = true;
  await page.getByLabel("Dina anteckningar").fill("Sparat under avbrott");
  await expect(
    page.getByText("Sparat lokalt · väntar på nätverk", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Ta ett andetag." }),
  ).toBeVisible();
  server.offline = false;
  await page
    .getByRole("button", { name: "Försök synka igen", exact: true })
    .click();
  await expect(
    page.getByText("Sparat i Supabase", { exact: true }),
  ).toBeVisible();
  expect(
    server.document?.leads.find((l) => l.companyName === "Nästa företag AB")
      ?.notes,
  ).toBe("Sparat under avbrott");
  expect(server.document?.calls.length).toBe(1);
});
test("a different authenticated account cannot open the workspace", async ({
  page,
}) => {
  const server: Server = {
    document: fixture(),
    revision: 1,
    offline: false,
    allowed: false,
  };
  await mockCloud(page, server);
  await page.goto("/leads");
  await expect(
    page.getByRole("heading", { name: "Ett privat arbetsrum." }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Dina leads" })).toHaveCount(
    0,
  );
  expect(
    await page.evaluate(() =>
      localStorage.getItem(
        "callflow.cloud.wnexrlghlmotkysrofkl.11111111-1111-4111-8111-111111111111",
      ),
    ),
  ).toBeNull();
});

test("existing cloud examples are removed while real leads remain", async ({
  page,
}) => {
  const document = fixture();
  document.leads[0].demo = true;
  const server: Server = {
    document,
    revision: 1,
    offline: false,
    allowed: true,
  };
  await mockCloud(page, server);
  await page.goto("/leads");
  await expect(
    page.getByText("Sparat i Supabase", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Nästa företag AB/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Molnföretag AB/ }),
  ).toHaveCount(0);
  expect(server.document?.leads.map((l) => l.companyName)).toEqual([
    "Nästa företag AB",
  ]);
});
