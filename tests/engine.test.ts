import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  dateKey,
  emptyData,
  fromStockholm,
  makeLead,
  metrics,
  normalizePhone,
  rankedLeads,
  safeWebsite,
  sessionSeconds,
  streak,
} from "../src/lib/model";
import {
  changeSession,
  completeFollowUp,
  deleteLeads,
  logCall,
  nextLead,
  startSession,
  undoCall,
  updateLead,
} from "../src/lib/engine";
import {
  applyImport,
  autoMapping,
  exportCSV,
  prepareImport,
  Sheet,
} from "../src/lib/import";
import {
  LocalStorageRepository,
  STORAGE_KEY,
  validateData,
} from "../src/lib/repository";
const input = (companyName: string, phone = "031-123 45 67") => ({
  companyName,
  phone,
  website: "",
  industry: "",
  city: "",
  contactName: "",
  notes: "",
  status: "Ej kontaktad" as const,
});
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-12T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());
function fixture() {
  const d = emptyData();
  d.leads = [
    makeLead(input("Ångström AB")),
    makeLead(input("Björk AB", "070-222 22 22")),
    makeLead(input("Öster AB", "031-555 55 55")),
  ];
  return d;
}
describe("Samtal och dataintegritet", () => {
  it("counts only explicit outcomes, advances once and prevents replay", () => {
    let d = startSession(fixture(), "", emptyData().settings.defaultStatuses);
    const s = d.sessions[0];
    const current = s.currentLeadId!;
    expect(d.calls).toHaveLength(0);
    const r = logCall(d, {
      leadId: current,
      sessionId: s.id,
      outcome: "Inget svar",
      eventId: "event",
    });
    d = r.data;
    expect(d.calls).toHaveLength(1);
    expect(d.xp.reduce((n, e) => n + e.points, 0)).toBe(5);
    expect(d.sessions[0].currentLeadId).not.toBe(current);
    expect(
      logCall(d, {
        leadId: current,
        sessionId: s.id,
        outcome: "Inget svar",
        eventId: "event",
      }).data,
    ).toEqual(d);
    expect(
      logCall(d, {
        leadId: current,
        sessionId: s.id,
        outcome: "Inget svar",
        eventId: "rapid",
      }).data.calls,
    ).toHaveLength(1);
  });
  it("undo restores call, followup, XP and queue while preserving newer notes", () => {
    let d = fixture();
    d.followUps = [
      {
        id: "f",
        leadId: d.leads[0].id,
        dueAt: "2026-10-11T08:00:00Z",
        status: "pending",
        notes: "Follow",
      },
    ];
    d.leads[0].nextFollowUpAt = d.followUps[0].dueAt;
    d = startSession(d, "", d.settings.defaultStatuses);
    const original = d.leads[0];
    const r = logCall(d, {
      leadId: original.id,
      sessionId: d.sessions[0].id,
      outcome: "Möte bokat",
      eventId: "meeting",
    });
    expect(r.data.xp.reduce((n, e) => n + e.points, 0)).toBe(45);
    expect(r.data.followUps[0].status).toBe("completed");
    r.data.leads[0].notes = "Sparad efter samtalet";
    const restored = undoCall(r.data, r.undo!);
    expect(restored.calls).toHaveLength(0);
    expect(restored.xp).toHaveLength(0);
    expect(restored.followUps[0].status).toBe("pending");
    expect(restored.leads[0].notes).toBe("Sparad efter samtalet");
    expect(restored.sessions[0].currentLeadId).toBe(original.id);
  });
  it("grants customer/meeting reward once per lead and no XP for editing", () => {
    let d = fixture();
    const l = d.leads[0];
    d = logCall(d, { leadId: l.id, outcome: "Kund", eventId: "one" }).data;
    d = logCall(d, { leadId: l.id, outcome: "Kund", eventId: "two" }).data;
    expect(d.xp.reduce((n, e) => n + e.points, 0)).toBe(110);
    expect(metrics(d, "2026-10-12", "2026-10-12").customers).toBe(1);
    const edited = updateLead(d, l.id, { ...l, status: "Möte bokat" });
    expect(edited.xp).toEqual(d.xp);
  });
  it("skipping never counts and paused time is excluded", () => {
    let d = startSession(fixture(), "", emptyData().settings.defaultStatuses);
    const sid = d.sessions[0].id;
    d = nextLead(d, sid);
    expect(d.calls).toHaveLength(0);
    vi.advanceTimersByTime(10000);
    d = changeSession(d, sid, "paused");
    expect(sessionSeconds(d.sessions[0])).toBe(10);
    vi.advanceTimersByTime(20000);
    expect(sessionSeconds(d.sessions[0])).toBe(10);
    d = changeSession(d, sid, "active");
    vi.advanceTimersByTime(5000);
    expect(sessionSeconds(d.sessions[0])).toBe(15);
  });
  it("prioritizes overdue and due callbacks and respects future times and closed statuses", () => {
    const d = fixture();
    d.leads[0].status = "Kund";
    d.leads[1].nextFollowUpAt = "2026-10-13T07:00:00Z";
    d.leads.push(
      makeLead(
        { ...input("Försenad", "0701111111"), status: "Återkom senare" },
        { nextFollowUpAt: "2026-10-11T07:00:00Z" },
      ),
    );
    d.leads.push(
      makeLead(
        { ...input("Idag", "0703333333"), status: "Återkom senare" },
        { nextFollowUpAt: "2026-10-12T07:00:00Z" },
      ),
    );
    const started = startSession(d, "", d.settings.defaultStatuses);
    expect(
      rankedLeads(started, started.sessions[0]).map((l) => l.companyName),
    ).toEqual(["Försenad", "Idag", "Öster AB"]);
    vi.setSystemTime(new Date("2026-10-13T08:00Z"));
    expect(
      rankedLeads(started, started.sessions[0]).some(
        (l) => l.companyName === "Björk AB",
      ),
    ).toBe(true);
  });
  it("followup completion is idempotent and deletion cleans relationships", () => {
    let d = fixture();
    d.followUps.push({
      id: "f",
      leadId: d.leads[0].id,
      dueAt: "2026-10-12T08:00Z",
      status: "pending",
      notes: "",
    });
    d = completeFollowUp(d, "f");
    d = completeFollowUp(d, "f");
    expect(d.xp.reduce((n, e) => n + e.points, 0)).toBe(10);
    d = logCall(d, {
      leadId: d.leads[0].id,
      outcome: "Intresserad",
      eventId: "c",
    }).data;
    d = deleteLeads(d, [d.leads[0].id]);
    expect(d.calls).toHaveLength(0);
    expect(d.followUps).toHaveLength(0);
    expect(d.xp).toHaveLength(0);
    expect(validateData(d)).toEqual(d);
  });
});
describe("Import, export och svensk tid", () => {
  it("imports 500 companies with leading zeroes and Swedish characters", () => {
    const sheet: Sheet = {
      name: "Test",
      headers: ["Företagsnamn", "Telefon", "Hemsida"],
      warnings: [],
      rows: Array.from({ length: 500 }, (_, i) => [
        `ÅÄÖ Företag ${i}`,
        `070${String(i).padStart(7, "0")}`,
        `firma${i}.se`,
      ]),
    };
    const rows = prepareImport(sheet, autoMapping(sheet.headers), []);
    const r = applyImport(emptyData(), rows, "skip", "500.csv");
    expect(r.summary.imported).toBe(500);
    expect(r.data.leads[0].phone).toBe("0700000000");
    expect(r.data.leads[499].companyName).toBe("ÅÄÖ Företag 499");
    expect(validateData(r.data).leads).toHaveLength(500);
    const repeated = applyImport(
      r.data,
      prepareImport(sheet, autoMapping(sheet.headers), r.data.leads),
      "skip",
      "again.csv",
    );
    expect(repeated.summary.skipped).toBe(500);
    expect(repeated.data.leads).toHaveLength(500);
  });
  it("matches normalized phones and domains but never overwrites name-only or conflicting matches", () => {
    const d = fixture();
    d.leads[0].website = "https://www.angstrom.se";
    const sheet: Sheet = {
      name: "test",
      headers: ["Company", "Phone", "Website", "Notes"],
      warnings: [],
      rows: [
        ["Nytt namn", "+46 31 1234567", "", "Uppdaterad"],
        ["Björk AB", "", "", "Tvetydigt"],
        ["Nytt bolag", "0702222222", "angstrom.se", "Konflikt"],
        ["Ångstrom liknande", "", "", "Eget bolag"],
        ["", "", "", "Ogiltig"],
      ],
    };
    const p = prepareImport(sheet, autoMapping(sheet.headers), d.leads);
    expect(p[0].ambiguous).toBe(false);
    expect(p[1].ambiguous).toBe(true);
    expect(p[2].ambiguous).toBe(true);
    expect(p[3].duplicateId).toBeUndefined();
    const r = applyImport(d, p, "update", "test.csv");
    expect(r.summary).toMatchObject({
      updated: 1,
      skipped: 2,
      imported: 1,
      rejected: 1,
    });
    expect(r.data.leads[0].notes).toBe("Uppdaterad");
    expect(r.data.leads[1].notes).toBe("");
  });
  it("skips intra-file duplicates and supports separate import", () => {
    const s: Sheet = {
      name: "test",
      headers: ["Name", "Telefon"],
      warnings: [],
      rows: [
        ["Test", "0701234567"],
        ["Test AB", "+46701234567"],
      ],
    };
    const p = prepareImport(s, autoMapping(s.headers), []);
    expect(applyImport(emptyData(), p, "skip", "f.csv").summary.imported).toBe(
      1,
    );
    expect(
      applyImport(emptyData(), p, "separate", "f.csv").summary.imported,
    ).toBe(2);
  });
  it("exports BOM, semicolon, quotes and protects against formula injection", () => {
    const d = fixture();
    d.leads[0].notes = '=HYPERLINK("https://bad.test")';
    const csv = exportCSV(d);
    expect(csv.startsWith("\ufeff")).toBe(true);
    expect(csv).toContain('"Företagsnamn";"Telefon"');
    expect(csv).toContain("'=HYPERLINK");
    expect(csv).toContain("031-123 45 67");
    expect(normalizePhone("0046 (0)31 123")).not.toBe("");
    expect(normalizePhone("0311234567")).toBe(normalizePhone("+46 31 1234567"));
    expect(safeWebsite("javascript:alert(1)")).toBe("");
  });
  it("reports dates in Stockholm across midnight and daylight saving", () => {
    expect(dateKey("2026-10-12T22:30:00Z")).toBe("2026-10-13");
    expect(fromStockholm("2026-10-12T09:00")).toBe("2026-10-12T07:00:00.000Z");
    expect(fromStockholm("2026-12-12T09:00")).toBe("2026-12-12T08:00:00.000Z");
    expect(() => fromStockholm("2026-03-29T02:30")).toThrow();
  });
  it("distinguishes unique companies from attempts, and rest days do not break streaks", () => {
    let d = fixture();
    const lid = d.leads[0].id;
    d.settings.dailyCallTarget = 1;
    d = logCall(d, { leadId: lid, outcome: "Inget svar", eventId: "one" }).data;
    d = logCall(d, {
      leadId: lid,
      outcome: "Intresserad",
      eventId: "two",
    }).data;
    d.calls.push({
      ...d.calls[0],
      id: "friday",
      createdAt: "2026-10-09T10:00:00.000Z",
    });
    const m = metrics(d, "2026-10-12", "2026-10-12");
    expect(m).toMatchObject({
      attempts: 2,
      unique: 1,
      answered: 1,
      answerRate: 50,
    });
    expect(streak(d, "2026-10-12")).toBe(2);
  });
});
describe("Lagring", () => {
  it("never replaces corrupted data and surfaces quota failures", () => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
    });
    const repo = new LocalStorageRepository();
    repo.save(fixture());
    expect(repo.load()?.leads).toHaveLength(3);
    storage.set(STORAGE_KEY, "corrupt");
    expect(() => repo.load()).toThrow("Originalet är kvar");
    expect(repo.raw()).toBe("corrupt");
    vi.stubGlobal("localStorage", {
      getItem: () => "old",
      setItem: () => {
        throw new Error("quota");
      },
    });
    expect(() => repo.save(fixture())).toThrow("lagring är full");
    expect(repo.raw()).toBe("old");
    vi.unstubAllGlobals();
  });
});
