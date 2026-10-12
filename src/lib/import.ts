import Papa from "papaparse";
import {
  Data,
  Lead,
  LeadInput,
  id,
  leadInput,
  makeLead,
  normalizeDomain,
  normalizeName,
  normalizePhone,
} from "./model";
export const importFields = {
  companyName: "Företagsnamn",
  phone: "Telefon",
  website: "Hemsida",
  industry: "Bransch",
  city: "Ort",
  contactName: "Kontaktperson",
  notes: "Anteckningar",
} as const;
export type ImportField = keyof typeof importFields;
export type Mapping = Record<ImportField, number>;
export interface Sheet {
  name: string;
  headers: string[];
  rows: string[][];
  warnings: string[];
}
const aliases: Record<ImportField, string[]> = {
  companyName: [
    "företagsnamn",
    "företag",
    "company",
    "companyname",
    "businessname",
    "namn",
    "name",
    "bolag",
  ],
  phone: [
    "telefonnummer",
    "telefon",
    "phone",
    "phonenumber",
    "tel",
    "mobil",
    "mobile",
  ],
  website: ["website", "hemsida", "url", "webbplats", "web"],
  industry: ["bransch", "industry", "kategori"],
  city: ["ort", "city", "stad"],
  contactName: ["kontaktperson", "contact", "contactname", "kontakt"],
  notes: ["notes", "anteckningar", "notering", "kommentar"],
};
export function autoMapping(headers: string[]): Mapping {
  return Object.fromEntries(
    Object.keys(importFields).map((f) => [
      f,
      headers.findIndex((h) =>
        aliases[f as ImportField].includes(
          h
            .toLowerCase()
            .trim()
            .replace(/[\s_-]/g, ""),
        ),
      ),
    ]),
  ) as Mapping;
}
export type DuplicateMode = "skip" | "update" | "separate";
export interface PreparedRow {
  row: number;
  input?: LeadInput;
  reason?: string;
  duplicateId?: string;
  ambiguous?: boolean;
}
export function prepareImport(
  sheet: Sheet,
  mapping: Mapping,
  leads: Lead[],
): PreparedRow[] {
  const phones = new Map<string, Set<string>>(),
    domains = new Map<string, Set<string>>(),
    names = new Map<string, Set<string>>();
  function index(lead: {
    id: string;
    phone: string;
    website: string;
    companyName: string;
  }) {
    for (const [map, key] of [
      [phones, normalizePhone(lead.phone)],
      [domains, normalizeDomain(lead.website)],
      [names, normalizeName(lead.companyName)],
    ] as const)
      if (key) {
        const values = map.get(key) ?? new Set<string>();
        values.add(lead.id);
        map.set(key, values);
      }
  }
  leads.forEach(index);
  return sheet.rows.map((row, i) => {
    const input = {
      ...Object.fromEntries(
        Object.keys(importFields).map((f) => [
          f,
          mapping[f as ImportField] >= 0
            ? (row[mapping[f as ImportField]] ?? "").trim()
            : "",
        ]),
      ),
      status: "Ej kontaktad",
    } as LeadInput;
    if (/^'\+[\d\s()-]+$/.test(input.phone)) input.phone = input.phone.slice(1);
    const parsed = leadInput.safeParse(input);
    if (!parsed.success)
      return {
        row: i + 2,
        reason: parsed.error.issues.map((e) => e.message).join(", "),
      };
    const p = phones.get(normalizePhone(input.phone)),
      d = domains.get(normalizeDomain(input.website)),
      n = names.get(normalizeName(input.companyName));
    const strong = new Set([...(p ?? []), ...(d ?? [])]);
    const matches = strong.size ? strong : (n ?? new Set());
    const duplicateId = [...matches][0];
    const ambiguous = matches.size > 1 || (!strong.size && matches.size > 0);
    const result = { row: i + 2, input: parsed.data, duplicateId, ambiguous };
    index({ ...input, id: `row:${i + 2}` });
    return result;
  });
}
export interface ImportSummary {
  imported: number;
  updated: number;
  skipped: number;
  rejected: number;
  reasons: string[];
  batchId: string;
}
function* importRows(
  data: Data,
  rows: PreparedRow[],
  mode: DuplicateMode,
  filename: string,
): Generator<number, { data: Data; summary: ImportSummary }> {
  const batchId = id(),
    importedAt = new Date().toISOString();
  const leads = [...data.leads];
  const positions = new Map(leads.map((l, i) => [l.id, i]));
  const importedRowIds = new Map<string, string>();
  const summary: ImportSummary = {
    imported: 0,
    updated: 0,
    skipped: 0,
    rejected: 0,
    reasons: [],
    batchId,
  };
  for (const [index, row] of rows.entries()) {
    if (index % 250 === 0) yield index;
    if (!row.input) {
      summary.rejected++;
      summary.reasons.push(`Rad ${row.row}: ${row.reason}`);
      continue;
    }
    if (row.duplicateId && mode !== "separate") {
      const targetId = importedRowIds.get(row.duplicateId) ?? row.duplicateId;
      const pos = positions.get(targetId);
      if (mode === "skip" || row.ambiguous || pos === undefined) {
        summary.skipped++;
        summary.reasons.push(
          `Rad ${row.row}: ${row.ambiguous ? "tvetydig träff på namn eller flera företag – ej uppdaterad" : "dubblett"}`,
        );
        continue;
      }
      const old = leads[pos];
      const merged = { ...old };
      for (const field of Object.keys(importFields) as ImportField[])
        if (row.input[field]) merged[field] = row.input[field];
      leads[pos] = makeLead(merged, {
        ...merged,
        updatedAt: importedAt,
        importBatchId: batchId,
        demo: false,
      });
      summary.updated++;
      importedRowIds.set(`row:${row.row}`, old.id);
      continue;
    }
    const lead = makeLead(row.input, { importBatchId: batchId });
    positions.set(lead.id, leads.length);
    importedRowIds.set(`row:${row.row}`, lead.id);
    leads.push(lead);
    summary.imported++;
  }
  return {
    data: {
      ...data,
      leads,
      batches: [
        ...data.batches,
        {
          id: batchId,
          filename,
          importedAt,
          importedCount: summary.imported,
          duplicateCount: summary.skipped,
          rejectedCount: summary.rejected,
        },
      ],
    },
    summary,
  };
}
export function applyImport(
  data: Data,
  rows: PreparedRow[],
  mode: DuplicateMode,
  filename: string,
) {
  const iterator = importRows(data, rows, mode, filename);
  let step = iterator.next();
  while (!step.done) step = iterator.next();
  return step.value;
}
export async function applyImportAsync(
  data: Data,
  rows: PreparedRow[],
  mode: DuplicateMode,
  filename: string,
  onProgress: (processed: number, total: number) => void,
) {
  const iterator = importRows(data, rows, mode, filename);
  let step = iterator.next();
  while (!step.done) {
    onProgress(step.value, rows.length);
    await new Promise<void>((resolve) => setTimeout(resolve, 0));
    step = iterator.next();
  }
  onProgress(rows.length, rows.length);
  return step.value;
}
export function exportCSV(data: Data) {
  const attempts = new Map<string, number>();
  data.calls.forEach((c) =>
    attempts.set(c.leadId, (attempts.get(c.leadId) ?? 0) + 1),
  );
  const rows = data.leads.map((l) => ({
    Företagsnamn: l.companyName,
    Telefon: l.phone,
    Hemsida: l.website,
    Bransch: l.industry,
    Ort: l.city,
    Kontaktperson: l.contactName,
    Anteckningar: l.notes,
    Status: l.status,
    "Senaste kontakt": l.lastContactedAt ?? "",
    "Nästa uppföljning": l.nextFollowUpAt ?? "",
    "Antal försök": attempts.get(l.id) ?? 0,
    Källa:
      data.batches.find((b) => b.id === l.importBatchId)?.filename ??
      "Manuellt",
  }));
  return (
    "\ufeff" +
    Papa.unparse(rows, {
      delimiter: ";",
      newline: "\r\n",
      quotes: true,
      escapeFormulae: true,
    })
  );
}
export function download(
  content: string,
  filename: string,
  type = "text/csv;charset=utf-8",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
