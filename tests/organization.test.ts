import { expect, it } from "vitest";
import { emptyData, importDate, makeLead } from "../src/lib/model";
import {
  applyImport,
  autoMapping,
  exportCSV,
  prepareImport,
} from "../src/lib/import";
import {
  organizeLeads,
  removeGroup,
  removeImport,
  saveGroup,
} from "../src/lib/organization";
import { validateData } from "../src/lib/repository";
const sheet = {
  name: "Leads",
  headers: ["Företag", "Telefon", "Källa"],
  rows: [
    ["Kartbolaget", "0701234567", "Google Maps"],
    ["Bildbolaget", "0707654321", ""],
  ],
  warnings: [],
};
it("imports date, row source override and a new group atomically, including backup/export", () => {
  const result = applyImport(
    emptyData(),
    prepareImport(sheet, autoMapping(sheet.headers), []),
    "skip",
    "lista.csv",
    { source: "Instagram", groupName: "Göteborg" },
  );
  const d = validateData(JSON.parse(JSON.stringify(result.data)));
  expect(d.groups).toHaveLength(1);
  expect(d.leads.map((l) => l.source)).toEqual(["Google Maps", "Instagram"]);
  expect(
    d.leads.every(
      (l) =>
        l.groupId === d.groups[0].id &&
        l.importedAt === d.batches[0].importedAt,
    ),
  ).toBe(true);
  expect(exportCSV(d)).toContain('"Grupp"');
  expect(exportCSV(d)).toContain('"Importdatum"');
});
it("updates duplicate metadata while preserving identity, original creation date and status", () => {
  const first = applyImport(
    emptyData(),
    prepareImport(sheet, autoMapping(sheet.headers), []),
    "skip",
    "första.csv",
    { source: "Instagram" },
  );
  first.data.leads[0].status = "Kund";
  const next = applyImport(
    first.data,
    prepareImport(sheet, autoMapping(sheet.headers), first.data.leads),
    "update",
    "nästa.csv",
    { groupName: "Prioriterade" },
  );
  expect(next.data.leads[0].id).toBe(first.data.leads[0].id);
  expect(next.data.leads[0].createdAt).toBe(first.data.leads[0].createdAt);
  expect(next.data.leads[0].status).toBe("Kund");
  expect(next.data.leads[0].groupId).toBe(next.data.groups[0].id);
  expect(next.data.leads[0].importedAt).toBe(next.data.batches[1].importedAt);
});
it("removing a group preserves its leads and renaming or bulk organization survives validation", () => {
  let d = saveGroup(emptyData(), "Google Maps · Göteborg", "#16724c");
  const group = d.groups[0];
  d.leads.push(
    makeLead({
      companyName: "Riktigt företag",
      phone: "",
      website: "",
      industry: "",
      city: "",
      contactName: "",
      notes: "Behåll",
      status: "Intresserad",
    }),
  );
  d = organizeLeads(d, [d.leads[0].id], {
    source: "Google Maps",
    groupId: group.id,
  });
  d = saveGroup(d, "Västkusten", "#3568b0", group.id);
  expect(() => saveGroup(d, "västkusten", "#16724c")).toThrow("redan");
  const cleaned = validateData(removeGroup(d, group.id));
  expect(cleaned.groups).toEqual([]);
  expect(cleaned.leads).toHaveLength(1);
  expect(cleaned.leads[0].notes).toBe("Behåll");
  expect(cleaned.leads[0].groupId).toBe("");
  expect(cleaned.leads[0].source).toBe("Google Maps");
});
it("deletes one complete import and its related history without affecting another import", () => {
  const a = applyImport(
    emptyData(),
    prepareImport(sheet, autoMapping(sheet.headers), []),
    "separate",
    "a.csv",
  );
  const b = applyImport(
    a.data,
    prepareImport(sheet, autoMapping(sheet.headers), []),
    "separate",
    "b.csv",
  );
  const leadId = b.data.leads[0].id,
    createdAt = new Date().toISOString();
  b.data.calls.push({
    id: "call",
    leadId,
    outcome: "Kund",
    notes: "",
    createdAt,
  });
  b.data.followUps.push({
    id: "follow",
    leadId,
    status: "pending",
    notes: "",
    dueAt: createdAt,
  });
  b.data.xp.push({
    id: "xp",
    sourceEventId: "call",
    type: "customer",
    points: 100,
    createdAt,
  });
  const cleaned = validateData(removeImport(b.data, a.summary.batchId));
  expect(cleaned.leads).toHaveLength(2);
  expect(
    cleaned.leads.every((l) => l.importBatchId === b.summary.batchId),
  ).toBe(true);
  expect(cleaned.calls).toEqual([]);
  expect(cleaned.followUps).toEqual([]);
  expect(cleaned.xp).toEqual([]);
});
it("old backups receive empty groups and legacy leads use the batch import date", () => {
  const d = emptyData();
  d.batches.push({
    id: "old",
    filename: "old.csv",
    importedAt: "2026-10-01T09:00:00Z",
    importedCount: 1,
    duplicateCount: 0,
    rejectedCount: 0,
  });
  const l = makeLead(
    {
      companyName: "Gamla listan",
      phone: "",
      website: "",
      industry: "",
      city: "",
      contactName: "",
      notes: "",
      status: "Ej kontaktad",
    },
    { importBatchId: "old" },
  );
  d.leads.push(l);
  const legacy: Record<string, unknown> = { ...d };
  delete legacy.groups;
  expect(validateData(legacy).groups).toEqual([]);
  expect(importDate(d, l)).toBe(d.batches[0].importedAt);
});
