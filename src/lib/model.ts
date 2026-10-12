import { z } from "zod";

export const statuses = [
  "Ej kontaktad",
  "Inget svar",
  "Återkom senare",
  "Intresserad",
  "Möte bokat",
  "Inte intresserad",
  "Kund",
] as const;
export type Status = (typeof statuses)[number];
export const outcomes: Status[] = [
  "Inget svar",
  "Inte intresserad",
  "Återkom senare",
  "Intresserad",
  "Möte bokat",
  "Kund",
];
export const leadInput = z.object({
  companyName: z.string().trim().min(1, "Ange företagsnamn").max(300),
  phone: z
    .string()
    .trim()
    .max(100)
    .refine(
      (v) =>
        !v ||
        (/^[+\d\s()./-]+$/.test(v) &&
          v.replace(/\D/g, "").length >= 5 &&
          v.replace(/\D/g, "").length <= 15),
      "Kontrollera telefonnumret. Använd siffror, mellanslag och eventuellt +46.",
    ),
  website: z
    .string()
    .trim()
    .max(1000)
    .refine(
      (v) => !v || safeWebsite(v) !== "",
      "Ange en giltig http- eller https-adress",
    ),
  industry: z.string().trim().max(300),
  city: z.string().trim().max(300),
  contactName: z.string().trim().max(300),
  notes: z.string().max(20000),
  status: z.enum(statuses),
});
export type LeadInput = z.infer<typeof leadInput>;
export interface Lead extends LeadInput {
  id: string;
  normalizedPhone: string;
  normalizedDomain: string;
  createdAt: string;
  updatedAt: string;
  lastContactedAt?: string;
  nextFollowUpAt?: string;
  importBatchId?: string;
  demo?: boolean;
}
export interface CallLog {
  id: string;
  leadId: string;
  sessionId?: string;
  outcome: Status;
  notes: string;
  createdAt: string;
  meetingAt?: string;
  demo?: boolean;
}
export interface FollowUp {
  id: string;
  leadId: string;
  dueAt: string;
  status: "pending" | "completed";
  completedAt?: string;
  notes: string;
  sourceCallId?: string;
}
export interface CallingSession {
  id: string;
  startedAt: string;
  endedAt?: string;
  activeDuration: number;
  activeSince?: string;
  status: "active" | "paused" | "ended";
  selectedBatch: string;
  includedStatuses: Status[];
  currentLeadId?: string;
  visited: string[];
}
export interface GoalSettings {
  dailyCallTarget: number;
  weeklyCallTarget: number;
  weeklyMeetingTarget: number;
  weeklyFollowUpTarget: number;
  weeklyCustomerTarget: number;
  preferredWorkingDays: number[];
  theme: "light" | "dark" | "system";
  defaultStatuses: Status[];
}
export interface ImportBatch {
  id: string;
  filename: string;
  importedAt: string;
  importedCount: number;
  duplicateCount: number;
  rejectedCount: number;
  demo?: boolean;
}
export interface XPEvent {
  id: string;
  sourceEventId: string;
  type: "call" | "followup" | "meeting" | "customer";
  points: number;
  createdAt: string;
}
export interface Data {
  version: 1;
  leads: Lead[];
  calls: CallLog[];
  followUps: FollowUp[];
  sessions: CallingSession[];
  batches: ImportBatch[];
  xp: XPEvent[];
  settings: GoalSettings;
}
export const defaults: GoalSettings = {
  dailyCallTarget: 50,
  weeklyCallTarget: 250,
  weeklyMeetingTarget: 5,
  weeklyFollowUpTarget: 20,
  weeklyCustomerTarget: 2,
  preferredWorkingDays: [1, 2, 3, 4, 5],
  theme: "light",
  defaultStatuses: [
    "Ej kontaktad",
    "Inget svar",
    "Återkom senare",
    "Intresserad",
  ],
};
export const emptyData = (): Data => ({
  version: 1,
  leads: [],
  calls: [],
  followUps: [],
  sessions: [],
  batches: [],
  xp: [],
  settings: { ...defaults },
});
export const id = () => crypto.randomUUID();
export function normalizePhone(v: string) {
  const n = v
    .replace(/[^\d+]/g, "")
    .replace(/^00/, "+")
    .replace(/^\+460/, "+46");
  return n.startsWith("0")
    ? "+46" + n.slice(1)
    : n.startsWith("46")
      ? "+" + n
      : n;
}
export function safeWebsite(v: string) {
  try {
    const u = new URL(v.includes("://") ? v : "https://" + v);
    return ["http:", "https:"].includes(u.protocol) && u.hostname.includes(".")
      ? u.href
      : "";
  } catch {
    return "";
  }
}
export function normalizeDomain(v: string) {
  try {
    return new URL(safeWebsite(v)).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}
export function normalizeName(v: string) {
  return v
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}
export function makeLead(input: LeadInput, extra: Partial<Lead> = {}): Lead {
  const parsed = leadInput.parse(input);
  const now = new Date().toISOString();
  return {
    id: id(),
    createdAt: now,
    updatedAt: now,
    ...extra,
    ...parsed,
    normalizedPhone: normalizePhone(parsed.phone),
    normalizedDomain: normalizeDomain(parsed.website),
  };
}
const dateFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Stockholm",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
export function dateKey(value: string | Date = new Date()): string {
  return dateFormatter.format(new Date(value));
}
export function shiftDate(day: string, amount: number) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + amount);
  return d.toISOString().slice(0, 10);
}
export function weekStart(day = dateKey()) {
  const n = new Date(day + "T12:00:00Z").getUTCDay();
  return shiftDate(day, -(n || 7) + 1);
}
const inputFormatter = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Europe/Stockholm",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
export function stockholmInput(value: string) {
  return inputFormatter.format(new Date(value)).replace(" ", "T");
}
export function fromStockholm(value: string) {
  const naive = new Date(value + "Z");
  if (!Number.isFinite(naive.getTime()))
    throw new Error("Välj ett giltigt datum och klockslag.");
  const offset =
    new Date(stockholmInput(naive.toISOString()) + "Z").getTime() -
    naive.getTime();
  const adjusted = new Date(naive.getTime() - offset);
  const correction =
    new Date(stockholmInput(adjusted.toISOString()) + "Z").getTime() -
    naive.getTime();
  const result = new Date(adjusted.getTime() - correction).toISOString();
  if (stockholmInput(result) !== value)
    throw new Error(
      "Klockslaget finns inte vid övergången till sommartid. Välj en annan tid.",
    );
  return result;
}
export function formatDate(v?: string, withTime = false) {
  return v
    ? new Intl.DateTimeFormat("sv-SE", {
        timeZone: "Europe/Stockholm",
        day: "numeric",
        month: "short",
        ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
      }).format(new Date(v))
    : "—";
}
export function sessionSeconds(s: CallingSession, now = Date.now()) {
  return (
    s.activeDuration +
    (s.status === "active" && s.activeSince
      ? Math.max(
          0,
          Math.floor((now - new Date(s.activeSince).getTime()) / 1000),
        )
      : 0)
  );
}
export function rankedLeads(
  data: Data,
  session: CallingSession,
  now = new Date(),
) {
  const today = dateKey(now);
  const visited = new Set(session.visited);
  return data.leads
    .filter(
      (l) =>
        session.includedStatuses.includes(l.status) &&
        (!session.selectedBatch || l.importBatchId === session.selectedBatch) &&
        !visited.has(l.id) &&
        (!l.nextFollowUpAt || new Date(l.nextFollowUpAt) <= now),
    )
    .sort((a, b) => {
      const rank = (l: Lead) =>
        l.nextFollowUpAt
          ? dateKey(l.nextFollowUpAt) < today
            ? 0
            : 1
          : l.status === "Ej kontaktad"
            ? 2
            : l.status === "Inget svar"
              ? 3
              : 4;
      return (
        rank(a) - rank(b) ||
        (a.nextFollowUpAt || a.lastContactedAt || a.createdAt).localeCompare(
          b.nextFollowUpAt || b.lastContactedAt || b.createdAt,
        )
      );
    });
}
export function streak(data: Data, today = dateKey()) {
  let total = 0;
  const counts = new Map<string, number>();
  for (const call of data.calls) {
    const day = dateKey(call.createdAt);
    counts.set(day, (counts.get(day) ?? 0) + 1);
  }
  for (let i = 0; i < 3660; i++) {
    const day = shiftDate(today, -i);
    const weekday = new Date(day + "T12:00:00Z").getUTCDay();
    if (!data.settings.preferredWorkingDays.includes(weekday)) continue;
    const count = counts.get(day) ?? 0;
    if (count >= data.settings.dailyCallTarget) total++;
    else if (i !== 0) break;
  }
  return total;
}
export function metrics(data: Data, start: string, end: string) {
  const calls = data.calls.filter((c) => {
    const day = dateKey(c.createdAt);
    return day >= start && day <= end;
  });
  // First acquisition / booking per company is the conversion event; retries remain attempts.
  const first = new Map<string, string>();
  for (const c of [...data.calls].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  ))
    if (c.outcome === "Kund" || c.outcome === "Möte bokat") {
      const key = c.leadId + ":" + c.outcome;
      if (!first.has(key)) first.set(key, c.id);
    }
  const meetings = calls.filter(
    (c) =>
      c.outcome === "Möte bokat" &&
      first.get(c.leadId + ":" + c.outcome) === c.id,
  ).length;
  const answered = calls.filter((c) => c.outcome !== "Inget svar").length;
  const customers = calls.filter(
    (c) =>
      c.outcome === "Kund" && first.get(c.leadId + ":" + c.outcome) === c.id,
  ).length;
  return {
    calls,
    attempts: calls.length,
    unique: new Set(calls.map((c) => c.leadId)).size,
    meetings,
    answered,
    customers,
    answerRate: calls.length ? (answered / calls.length) * 100 : 0,
    conversion: calls.length ? (meetings / calls.length) * 100 : 0,
  };
}
