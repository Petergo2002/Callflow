import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  emptyData,
  makeLead,
  rankedLeads,
  sessionScopeValid,
  sessionSeconds,
} from "../src/lib/model";
import {
  changeSession,
  configureSession,
  logCall,
  nextLead,
  refreshSessionLead,
  startSession,
  undoCall,
} from "../src/lib/engine";
import { removeGroup, removeImport } from "../src/lib/organization";
import { validateData } from "../src/lib/repository";
import { queueInfo } from "../src/lib/focus-queue";
function fixture() {
  const d = emptyData();
  d.groups = [
    {
      id: "maps",
      name: "Google Maps",
      color: "#16724c",
      createdAt: new Date().toISOString(),
    },
    {
      id: "insta",
      name: "Instagram",
      color: "#3568b0",
      createdAt: new Date().toISOString(),
    },
  ];
  d.batches = [
    {
      id: "import",
      filename: "lista.csv",
      importedAt: new Date().toISOString(),
      importedCount: 2,
      duplicateCount: 0,
      rejectedCount: 0,
    },
  ];
  d.leads = ["Kartbolag A", "Kartbolag B", "Bildbolaget", "Utan grupp"].map(
    (companyName, i) =>
      makeLead(
        {
          companyName,
          phone: `070123456${i}`,
          website: "",
          industry: "",
          city: "",
          contactName: "",
          notes: "",
          status: "Ej kontaktad",
          groupId: i < 2 ? "maps" : i === 2 ? "insta" : "",
          source: i < 2 ? "Google Maps" : "Instagram",
        },
        { importBatchId: i < 2 ? "import" : undefined },
      ),
  );
  return d;
}
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-12T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());
it("keeps group, batch and source boundaries on advance, previous, undo and reload", () => {
  let d = startSession(fixture(), "import", ["Ej kontaktad"], undefined, {
    groupId: "maps",
    source: "Google Maps",
  });
  const s = d.sessions[0],
    first = s.currentLeadId!;
  const logged = logCall(d, {
    leadId: first,
    sessionId: s.id,
    outcome: "Inget svar",
    eventId: "call",
  });
  d = logged.data;
  expect(d.sessions[0].currentLeadId).toBe(d.leads[1].id);
  d = undoCall(d, logged.undo!);
  expect(d.sessions[0].currentLeadId).toBe(first);
  d = nextLead(d, s.id);
  d = nextLead(d, s.id);
  expect(d.sessions[0].currentLeadId).toBeUndefined();
  d = nextLead(d, s.id, true);
  expect(d.sessions[0].currentLeadId).toBe(d.leads[1].id);
  d = validateData(JSON.parse(JSON.stringify(d)));
  expect(d.sessions[0]).toMatchObject({
    selectedGroup: "maps",
    selectedBatch: "import",
    selectedSource: "Google Maps",
    requirePhone: true,
  });
  expect(rankedLeads(d, d.sessions[0]).every((l) => l.groupId === "maps")).toBe(
    true,
  );
});
it("changes group without losing history, rewards or progress and previous cannot cross groups", () => {
  let d = startSession(fixture(), "", ["Ej kontaktad"], undefined, {
    groupId: "maps",
  });
  const sid = d.sessions[0].id;
  d = logCall(d, {
    leadId: d.leads[0].id,
    sessionId: sid,
    outcome: "Inget svar",
    eventId: "one",
  }).data;
  vi.advanceTimersByTime(10000);
  d = changeSession(d, sid, "paused");
  vi.advanceTimersByTime(30000);
  const calls = d.calls,
    xp = d.xp;
  d = configureSession(d, sid, "", ["Ej kontaktad"], { groupId: "insta" });
  expect(d.sessions[0].currentLeadId).toBe(d.leads[2].id);
  expect(sessionSeconds(d.sessions[0])).toBe(10);
  expect(d.calls).toEqual(calls);
  expect(d.xp).toEqual(xp);
  expect(d.sessions[0].visited).toContain(d.leads[0].id);
  expect(nextLead(d, sid, true).sessions[0].currentLeadId).toBe(d.leads[2].id);
  d = configureSession(d, sid, "", ["Ej kontaktad", "Inget svar"], {
    groupId: "maps",
  });
  expect(d.sessions[0].currentLeadId).toBe(d.leads[1].id);
});
it("excludes missing phones and future callbacks, then fills an empty queue when time arrives", () => {
  const input = fixture();
  input.leads[0].phone = "";
  input.leads[1].nextFollowUpAt = "2026-10-12T10:05:00Z";
  let d = startSession(input, "", ["Ej kontaktad"], undefined, {
    groupId: "maps",
  });
  expect(d.sessions[0].currentLeadId).toBeUndefined();
  const info = queueInfo(d, d.sessions[0]);
  expect(info.ready).toHaveLength(0);
  expect(info.future).toHaveLength(1);
  expect(info.missingPhone).toBe(1);
  expect(refreshSessionLead(d, d.sessions[0].id)).toBe(d);
  vi.advanceTimersByTime(5 * 60000);
  d = refreshSessionLead(d, d.sessions[0].id);
  expect(d.sessions[0].currentLeadId).toBe(d.leads[1].id);
  expect(refreshSessionLead(d, d.sessions[0].id)).toBe(d);
});
it("pauses deleted group or import selections and never expands into all leads", () => {
  for (const type of ["group", "batch"]) {
    let d = startSession(
      fixture(),
      type === "batch" ? "import" : "",
      ["Ej kontaktad"],
      undefined,
      { groupId: type === "group" ? "maps" : undefined },
    );
    vi.advanceTimersByTime(10000);
    d = type === "group" ? removeGroup(d, "maps") : removeImport(d, "import");
    expect(d.sessions[0].status).toBe("paused");
    expect(sessionScopeValid(d, d.sessions[0])).toBe(false);
    expect(() => changeSession(d, d.sessions[0].id, "active")).toThrow(
      "tagits bort",
    );
    expect(d.sessions[0].currentLeadId).toBeUndefined();
    expect(d.leads.some((l) => l.companyName === "Bildbolaget")).toBe(true);
  }
});
it("direct calling outside the group starts a new pass, while edits within the group retain it", () => {
  let d = startSession(fixture(), "", ["Ej kontaktad"], undefined, {
    groupId: "maps",
  });
  const original = d.sessions[0].id;
  d = startSession(d, "", ["Ej kontaktad"], d.leads[1].id, { groupId: "maps" });
  expect(d.sessions).toHaveLength(1);
  expect(d.sessions[0].id).toBe(original);
  d = startSession(d, "", ["Ej kontaktad"], d.leads[2].id, {
    groupId: "insta",
  });
  expect(d.sessions).toHaveLength(2);
  expect(d.sessions[0].status).toBe("ended");
  expect(d.sessions[1].selectedGroup).toBe("insta");
});
it("refresh replaces a lead moved out of the group and legacy session backups still validate", () => {
  let d = startSession(fixture(), "", ["Ej kontaktad"], undefined, {
    groupId: "maps",
  });
  d.leads[0].groupId = "insta";
  d = refreshSessionLead(d, d.sessions[0].id);
  expect(d.sessions[0].currentLeadId).toBe(d.leads[1].id);
  const legacy = d.sessions[0];
  delete legacy.selectedGroup;
  delete legacy.selectedSource;
  delete legacy.requirePhone;
  expect(validateData(d).sessions[0].id).toBe(legacy.id);
});
