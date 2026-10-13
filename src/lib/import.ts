import Papa from "papaparse";
import { nextStepText } from "./lead-intelligence";
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
  groupColors,
} from "./model";
export const importFields = {
  companyName: "Företagsnamn",
  phone: "Telefon",
  website: "Hemsida",
  industry: "Bransch",
  city: "Ort",
  contactName: "Kontaktperson",
  notes: "Anteckningar",
  source: "Källa",
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
  source: ["källa", "kalla", "source", "leadsource"],
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
    alternatePhones?: string[];
    alternateWebsites?: string[];
    alternateNames?: string[];
  }) {
    for (const [map, key] of [
      ...[lead.phone, ...(lead.alternatePhones || [])].map(
        (p) => [phones, normalizePhone(p)] as const,
      ),
      ...[lead.website, ...(lead.alternateWebsites || [])].map(
        (w) => [domains, normalizeDomain(w)] as const,
      ),
      ...[lead.companyName, ...(lead.alternateNames || [])].map(
        (name) => [names, normalizeName(name)] as const,
      ),
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
    // Keep later rows pointing to the canonical company, including skipped rows.
    if (!ambiguous) index({ ...input, id: duplicateId || `row:${i + 2}` });
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
export interface ImportOptions {
  source?: string;
  groupId?: string;
  groupName?: string;
  groupColor?: string;
}
function* importRows(
  data: Data,
  rows: PreparedRow[],
  mode: DuplicateMode,
  filename: string,
  options: ImportOptions = {},
): Generator<number, { data: Data; summary: ImportSummary }> {
  const batchId = id(),
    importedAt = new Date().toISOString();
  if (options.source && options.source.trim().length > 100)
    throw new Error("Källnamnet får vara högst 100 tecken.");
  if (
    options.groupColor &&
    !(groupColors as readonly string[]).includes(options.groupColor)
  )
    throw new Error("Välj en giltig gruppfärg.");
  let groups = data.groups;
  let groupId = options.groupId;
  if (options.groupName?.trim()) {
    const existing = groups.find(
      (g) =>
        g.name.toLocaleLowerCase("sv") ===
        options.groupName!.trim().toLocaleLowerCase("sv"),
    );
    groupId = existing?.id ?? id();
    if (!existing)
      groups = [
        ...groups,
        {
          id: groupId,
          name: options.groupName.trim(),
          color: options.groupColor || "#16724c",
          createdAt: importedAt,
        },
      ];
  }
  if (groupId && !groups.some((g) => g.id === groupId))
    throw new Error("Välj en befintlig grupp.");
  if (options.groupName && options.groupName.trim().length > 80)
    throw new Error("Gruppnamnet får vara högst 80 tecken.");
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
        if (field !== "notes" && row.input[field])
          merged[field] = row.input[field];
      const incomingNotes = row.input.notes.trim();
      if (
        incomingNotes &&
        !`\n\n${old.notes.trim()}\n\n`.includes(`\n\n${incomingNotes}\n\n`)
      ) {
        const notes = [old.notes, incomingNotes].filter(Boolean).join("\n\n");
        if (notes.length > 20000) {
          summary.skipped++;
          summary.reasons.push(
            `Rad ${row.row}: anteckningarna blir för långa – befintligt företag bevarat`,
          );
          continue;
        }
        merged.notes = notes;
      }
      if (options.source && !row.input.source)
        merged.source = options.source.trim();
      if (groupId) merged.groupId = groupId;
      leads[pos] = makeLead(merged, {
        ...merged,
        updatedAt: importedAt,
        importBatchId: batchId,
        importedAt,
        ...(options.source && !row.input.source
          ? { source: options.source.trim() }
          : {}),
        ...(groupId ? { groupId } : {}),
        demo: false,
      });
      summary.updated++;
      importedRowIds.set(`row:${row.row}`, old.id);
      continue;
    }
    const lead = makeLead(
      {
        ...row.input,
        source: row.input.source || options.source?.trim(),
        groupId,
      },
      { importBatchId: batchId, importedAt },
    );
    positions.set(lead.id, leads.length);
    importedRowIds.set(`row:${row.row}`, lead.id);
    leads.push(lead);
    summary.imported++;
  }
  return {
    data: {
      ...data,
      leads,
      groups,
      batches: [
        ...data.batches,
        {
          id: batchId,
          filename,
          source: options.source?.trim(),
          groupId,
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
  options: ImportOptions = {},
) {
  const iterator = importRows(data, rows, mode, filename, options);
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
  options: ImportOptions = {},
) {
  const iterator = importRows(data, rows, mode, filename, options);
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
    "Nästa försök": l.nextRetryAt ?? "",
    "Nästa steg": nextStepText(l),
    "Alternativa telefonnummer": (l.alternatePhones || []).join(" | "),
    "Alternativa hemsidor": (l.alternateWebsites || []).join(" | "),
    Källa:
      l.source ||
      data.batches.find((b) => b.id === l.importBatchId)?.source ||
      (l.importBatchId ? "Ej angiven" : "Manuellt"),
    Grupp: data.groups.find((g) => g.id === l.groupId)?.name || "",
    Importfil:
      data.batches.find((b) => b.id === l.importBatchId)?.filename || "",
    Importdatum:
      l.importedAt ||
      data.batches.find((b) => b.id === l.importBatchId)?.importedAt ||
      "",
    Skapad: l.createdAt,
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
