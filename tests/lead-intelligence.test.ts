import { beforeEach, afterEach, expect, it, vi } from "vitest";
import {
  emptyData,
  makeLead,
  rankedLeads,
  stockholmInput,
} from "../src/lib/model";
import {
  logCall,
  startSession,
  setNextStep,
  completeNextStep,
  scheduleFollowUp,
  undoCall,
  completedThisWeek,
} from "../src/lib/engine";
import {
  attemptSummary,
  suggestRetry,
  workNow,
} from "../src/lib/lead-intelligence";
import { duplicateGroups, mergeLeads } from "../src/lib/duplicates";
import { searchLeads } from "../src/lib/lead-search";
import {
  prepareImport,
  autoMapping,
  applyImport,
  Sheet,
} from "../src/lib/import";
import { validateData } from "../src/lib/repository";
const input = (companyName: string, phone = "0701234567") => ({
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
  vi.setSystemTime(new Date("2026-10-13T08:00:00Z"));
});
afterEach(() => vi.useRealTimers());
it("spaces no-answer retries across working days at a different time, escalates after three and undo restores retry memory", () => {
  let d = emptyData();
  d.leads = [makeLead(input("A"))];
  const leadId = d.leads[0].id;
  for (let n = 0; n < 3; n++) {
    const result = logCall(d, {
      leadId,
      outcome: "Inget svar",
      eventId: `call${n}`,
    });
    expect(undoCall(result.data, result.undo!).leads[0].nextRetryAt).toBe(
      d.leads[0].nextRetryAt,
    );
    d = result.data;
    const next = d.leads[0].nextRetryAt!;
    expect(new Date(next).getTime()).toBeGreaterThan(Date.now());
    expect(stockholmInput(next).slice(11)).toBe(
      n % 2 === 0 ? "14:00" : "09:30",
    );
    const session = startSession(d, "", d.settings.defaultStatuses);
    expect(rankedLeads(session, session.sessions[0])).toHaveLength(0);
    if (n < 2) vi.setSystemTime(new Date(next));
  }
  expect(attemptSummary(d, leadId)).toMatchObject({
    attempts: 3,
    consecutiveMissed: 3,
    neverAnswered: true,
  });
  expect(
    new Date(d.leads[0].nextRetryAt!).getTime() - Date.now(),
  ).toBeGreaterThanOrEqual(7 * 86400000);
  const restored = validateData(JSON.parse(JSON.stringify(d)));
  expect(restored.leads[0].nextRetryAt).toBe(d.leads[0].nextRetryAt);
});
it("skips weekends and respects configured working days", () => {
  const d = emptyData();
  d.leads = [makeLead(input("A"))];
  vi.setSystemTime(new Date("2026-10-16T08:00:00Z"));
  expect(stockholmInput(suggestRetry(d, d.leads[0].id))).toBe(
    "2026-10-19T14:00",
  );
  d.settings.preferredWorkingDays = [3];
  expect(stockholmInput(suggestRetry(d, d.leads[0].id))).toBe(
    "2026-10-21T14:00",
  );
});
it("logs an incoming call outside the focus group without touching session scope or progress", () => {
  let d = emptyData();
  d.groups = [
    {
      id: "queue",
      name: "Ringlista",
      color: "#16724c",
      createdAt: new Date().toISOString(),
    },
  ];
  d.leads = [
    makeLead({ ...input("Kön"), groupId: "queue" }),
    makeLead(input("Inkommande", "0702222222")),
  ];
  d = startSession(d, "", d.settings.defaultStatuses, undefined, {
    groupId: "queue",
  });
  const sessions = d.sessions;
  const result = logCall(d, {
    leadId: d.leads[1].id,
    outcome: "Återkom senare",
    direction: "incoming",
    eventId: "incoming",
    followUpAt: "2026-10-14T08:00:00Z",
    notes: "Skicka offert",
  });
  expect(result.data.sessions).toEqual(sessions);
  expect(result.data.calls[0]).toMatchObject({
    direction: "incoming",
    notes: "Skicka offert",
    leadId: d.leads[1].id,
  });
  expect(result.data.leads[1].nextStep?.kind).toBe("call");
  expect(
    logCall(result.data, {
      leadId: d.leads[1].id,
      outcome: "Intresserad",
      eventId: "incoming",
    }).data,
  ).toEqual(result.data);
  expect(undoCall(result.data, result.undo!).sessions).toEqual(sessions);
  expect(undoCall(result.data, result.undo!).calls).toHaveLength(0);
});
it("offers, waiting and calls are clear next steps, excluded from calling when appropriate and persisted", () => {
  let d = emptyData();
  d.leads = [makeLead({ ...input("A"), status: "Intresserad" })];
  const leadId = d.leads[0].id;
  expect(workNow(d)[0].action).toBe("plan");
  d = setNextStep(d, leadId, {
    kind: "offer",
    dueAt: "2026-10-14T08:00:00Z",
    note: "Prisförslag till Anna",
  });
  expect(workNow(d)).toHaveLength(0);
  const withSession = startSession(d, "", d.settings.defaultStatuses);
  expect(rankedLeads(withSession, withSession.sessions[0])).toHaveLength(0);
  vi.setSystemTime(new Date("2026-10-14T08:01:00Z"));
  expect(workNow(d)[0]).toMatchObject({
    action: "offer",
    reason: "Skicka offert",
  });
  d = completeNextStep(d, leadId);
  expect(workNow(d)[0].action).toBe("plan");
  d = setNextStep(d, leadId, {
    kind: "wait",
    dueAt: "2026-10-15T08:00:00Z",
    note: "Kontrollera e-post",
  });
  expect(validateData(JSON.parse(JSON.stringify(d))).leads[0].nextStep).toEqual(
    d.leads[0].nextStep,
  );
  vi.setSystemTime(new Date("2026-10-15T08:01:00Z"));
  expect(workNow(d)[0].action).toBe("wait");
  d = setNextStep(d, leadId, {
    kind: "call",
    dueAt: "2026-10-16T08:00:00Z",
    note: "Ring om offert",
  });
  expect(d.followUps.filter((f) => f.status === "pending")).toHaveLength(1);
  expect(d.leads[0].nextRetryAt).toBeUndefined();
});
it("work-now ranks overdue promises before missing plans and fresh leads, hides closed and future contacts", () => {
  const d = emptyData();
  d.leads = [
    makeLead(input("Ny")),
    makeLead({ ...input("Planera", "0701111111"), status: "Intresserad" }),
    makeLead(
      { ...input("Försenad", "0702222222"), status: "Återkom senare" },
      { nextFollowUpAt: "2026-10-12T08:00:00Z" },
    ),
    makeLead({ ...input("Avslutad", "0703333333"), status: "Kund" }),
    makeLead(input("Framtida", "0704444444"), {
      nextRetryAt: "2026-10-14T08:00:00Z",
    }),
  ];
  expect(workNow(d).map((i) => i.lead.companyName)).toEqual([
    "Försenad",
    "Planera",
    "Ny",
  ]);
});
it("replacing or closing promises does not inflate completed-followup statistics", () => {
  let d = emptyData();
  d.leads = [makeLead(input("A"))];
  d = scheduleFollowUp(d, d.leads[0].id, "2026-10-14T08:00:00Z");
  d = setNextStep(d, d.leads[0].id, {
    kind: "offer",
    dueAt: "2026-10-15T08:00:00Z",
    note: "Offert",
  });
  expect(d.followUps[0].resolution).toBe("replaced");
  expect(completedThisWeek(d, "2026-10-12")).toBe(0);
});
it("merges duplicates preserving all activity, notes, aliases, rewards and session references", () => {
  let d = emptyData();
  d.leads = [
    makeLead({
      ...input("Huvud"),
      website: "bolag.se",
      notes: "Huvudanteckning",
      status: "Intresserad",
    }),
    makeLead({
      ...input("Annat namn", "0702222222"),
      website: "www.bolag.se",
      notes: "Andra anteckningen",
    }),
  ];
  const [main, second] = d.leads;
  d = logCall(d, {
    leadId: second.id,
    outcome: "Inget svar",
    eventId: "missed",
  }).data;
  d = scheduleFollowUp(d, main.id, "2026-10-14T08:00:00Z", "Första löftet");
  d = scheduleFollowUp(d, second.id, "2026-10-15T08:00:00Z", "Andra löftet");
  d = startSession(d, "", d.settings.defaultStatuses, second.id);
  const xp = d.xp;
  expect(duplicateGroups(d.leads)).toHaveLength(1);
  const merged = mergeLeads(d, main.id, [second.id]);
  expect(merged.leads).toHaveLength(1);
  expect(merged.leads[0]).toMatchObject({
    id: main.id,
    status: "Intresserad",
    nextFollowUpAt: "2026-10-14T08:00:00Z",
    alternatePhones: ["0702222222"],
    alternateNames: ["Annat namn"],
  });
  expect(merged.leads[0].notes).toContain("Huvudanteckning");
  expect(merged.leads[0].notes).toContain("Andra anteckningen");
  expect(merged.calls.every((c) => c.leadId === main.id)).toBe(true);
  expect(merged.followUps.filter((f) => f.status === "pending")).toHaveLength(
    2,
  );
  expect(merged.followUps.every((f) => f.leadId === main.id)).toBe(true);
  expect(merged.xp).toEqual(xp);
  expect(merged.sessions[0].currentLeadId).toBe(main.id);
  expect(searchLeads(merged.leads, "+46702222222")[0].id).toBe(main.id);
  expect(searchLeads(merged.leads, "Annat namn")[0].id).toBe(main.id);
  const sheet: Sheet = {
    name: "CSV",
    headers: ["Company", "Phone"],
    rows: [["Annat namn", "0702222222"]],
    warnings: [],
  };
  const prepared = prepareImport(
    sheet,
    autoMapping(sheet.headers),
    merged.leads,
  );
  expect(prepared[0].duplicateId).toBe(main.id);
  expect(
    applyImport(merged, prepared, "skip", "again.csv").data.leads,
  ).toHaveLength(1);
  expect(
    validateData(JSON.parse(JSON.stringify(merged))).leads[0].alternatePhones,
  ).toEqual(["0702222222"]);
});
it("refuses oversized merges without modifying existing records", () => {
  const d = emptyData();
  d.leads = [
    makeLead({ ...input("A"), notes: "A".repeat(12000) }),
    makeLead({ ...input("B"), notes: "B".repeat(12000) }),
  ];
  const before = JSON.stringify(d);
  expect(() => mergeLeads(d, d.leads[0].id, [d.leads[1].id])).toThrow(
    "för långa",
  );
  expect(JSON.stringify(d)).toBe(before);
});

it("undo refuses to overwrite a next step planned after a call", () => {
  let d = emptyData();
  d.leads = [makeLead(input("A"))];
  const result = logCall(d, {
    leadId: d.leads[0].id,
    outcome: "Intresserad",
    eventId: "call",
  });
  d = setNextStep(result.data, d.leads[0].id, {
    kind: "offer",
    dueAt: "2026-10-14T08:00:00Z",
    note: "Nytt löfte efter samtalet",
  });
  expect(() => undoCall(d, result.undo!)).toThrow("senare ändringarna");
  expect(d.leads[0].nextStep?.note).toBe("Nytt löfte efter samtalet");
});
