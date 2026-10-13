import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { emptyData, makeLead, rankedLeads } from "../src/lib/model";
import {
  logCall,
  scheduleFollowUp,
  startSession,
  undoCall,
  updateLead,
} from "../src/lib/engine";
import {
  applyImport,
  autoMapping,
  prepareImport,
  Sheet,
} from "../src/lib/import";
const input = (name: string, phone = "0701234567") => ({
  companyName: name,
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
  vi.setSystemTime(new Date("2026-10-13T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());
it("updates repeated matching rows without losing identity, notes or contact history", () => {
  let data = emptyData();
  data.leads = [makeLead({ ...input("Bolag"), notes: "Lovade offert" })];
  data = logCall(data, {
    leadId: data.leads[0].id,
    outcome: "Återkom senare",
    followUpAt: "2026-10-14T08:00:00Z",
    eventId: "call",
  }).data;
  const old = data.leads[0];
  const sheet: Sheet = {
    name: "CSV",
    headers: ["Company", "Phone", "Notes"],
    warnings: [],
    rows: [
      ["Bolag", "+46701234567", "Ny uppgift"],
      ["Bolag", "0701234567", "Ny uppgift"],
      ["Bolag", "0701234567", "Tredje uppgift"],
    ],
  };
  const rows = prepareImport(sheet, autoMapping(sheet.headers), data.leads);
  expect(rows.every((r) => r.duplicateId === old.id && !r.ambiguous)).toBe(
    true,
  );
  const result = applyImport(data, rows, "update", "leads.csv");
  expect(result.summary).toMatchObject({ updated: 3, imported: 0, skipped: 0 });
  expect(result.data.leads).toHaveLength(1);
  expect(result.data.leads[0]).toMatchObject({
    id: old.id,
    status: old.status,
    lastContactedAt: old.lastContactedAt,
    nextFollowUpAt: old.nextFollowUpAt,
    notes: "Lovade offert\n\nNy uppgift\n\nTredje uppgift",
  });
  expect(result.data.calls).toEqual(data.calls);
  expect(result.data.followUps).toEqual(data.followUps);
  const repeated = applyImport(
    result.data,
    prepareImport(sheet, autoMapping(sheet.headers), result.data.leads),
    "update",
    "again.csv",
  );
  expect(repeated.data.leads[0].notes).toBe(result.data.leads[0].notes);
});
it("resolves three duplicates within a new file to one company in update mode", () => {
  const sheet: Sheet = {
    name: "CSV",
    headers: ["Company", "Phone"],
    warnings: [],
    rows: [
      ["A", "0701234567"],
      ["A", "+46701234567"],
      ["A", "0701234567"],
    ],
  };
  const result = applyImport(
    emptyData(),
    prepareImport(sheet, autoMapping(sheet.headers), []),
    "update",
    "same.csv",
  );
  expect(result.summary).toMatchObject({ imported: 1, updated: 2, skipped: 0 });
  expect(result.data.leads).toHaveLength(1);
});
it("remembers numbers across groups and new sessions, but allows a promised later callback", () => {
  let data = emptyData();
  data.leads = [
    makeLead(input("A")),
    makeLead(input("Duplicate", "+46 70 123 45 67")),
    makeLead(input("B", "0702222222")),
  ];
  data = logCall(data, {
    leadId: data.leads[0].id,
    outcome: "Inget svar",
    eventId: "attempt",
  }).data;
  data = startSession(data, "", data.settings.defaultStatuses);
  expect(rankedLeads(data, data.sessions[0]).map((l) => l.companyName)).toEqual(
    ["B"],
  );
  data = scheduleFollowUp(data, data.leads[0].id, "2026-10-13T12:00:00Z");
  vi.setSystemTime(new Date("2026-10-13T12:01:00Z"));
  expect(rankedLeads(data, data.sessions[0])[0].companyName).toBe("A");
  vi.setSystemTime(new Date("2026-10-14T08:00:00Z"));
  expect(
    rankedLeads(data, data.sessions[0]).filter((l) => l.phone.includes("123")),
  ).toHaveLength(1);
});
it("keeps unanswered followups pending and closes future promises on terminal outcomes; undo restores them", () => {
  let data = emptyData();
  data.leads = [makeLead(input("A"))];
  data = scheduleFollowUp(
    data,
    data.leads[0].id,
    "2026-10-13T11:00:00Z",
    "Offert",
  );
  vi.setSystemTime(new Date("2026-10-13T11:01:00Z"));
  data = logCall(data, {
    leadId: data.leads[0].id,
    outcome: "Inget svar",
    eventId: "missed",
  }).data;
  expect(data.followUps[0].status).toBe("pending");
  expect(data.xp.every((x) => x.type !== "followup")).toBe(true);
  data = scheduleFollowUp(data, data.leads[0].id, "2026-10-14T08:00:00Z");
  const result = logCall(data, {
    leadId: data.leads[0].id,
    outcome: "Inte intresserad",
    eventId: "closed",
  });
  expect(result.data.followUps.every((f) => f.status === "completed")).toBe(
    true,
  );
  expect(result.data.leads[0].nextFollowUpAt).toBeUndefined();
  expect(undoCall(result.data, result.undo!).followUps).toEqual(data.followUps);
});

it("manual closing cancels pending promises without creating calls or rewards", () => {
  let data = emptyData();
  data.leads = [makeLead(input("A"))];
  data = scheduleFollowUp(data, data.leads[0].id, "2026-10-14T08:00:00Z");
  const closed = updateLead(data, data.leads[0].id, {
    ...data.leads[0],
    status: "Kund",
  });
  expect(closed.followUps[0].status).toBe("completed");
  expect(closed.leads[0].nextFollowUpAt).toBeUndefined();
  expect(closed.calls).toHaveLength(0);
  expect(closed.xp).toHaveLength(0);
});
