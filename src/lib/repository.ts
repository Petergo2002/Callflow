import { z } from "zod";
import {
  Data,
  leadInput,
  statuses,
  groupColors,
  nextStepSchema,
} from "./model";

const iso = z.string().datetime();
const dataSchema = z.object({
  version: z.literal(1),
  leads: z.array(
    leadInput.extend({
      id: z.string(),
      normalizedPhone: z.string(),
      normalizedDomain: z.string(),
      createdAt: iso,
      updatedAt: iso,
      lastContactedAt: iso.optional(),
      nextFollowUpAt: iso.optional(),
      nextRetryAt: iso.optional(),
      nextStep: nextStepSchema.optional(),
      alternatePhones: z.array(z.string().max(100)).optional(),
      alternateWebsites: z.array(z.string().max(1000)).optional(),
      alternateNames: z.array(z.string().max(300)).optional(),
      mergedFrom: z.array(z.string()).optional(),
      importBatchId: z.string().optional(),
      importedAt: iso.optional(),
      demo: z.boolean().optional(),
    }),
  ),
  calls: z.array(
    z.object({
      id: z.string(),
      leadId: z.string(),
      sessionId: z.string().optional(),
      outcome: z.enum(statuses),
      notes: z.string(),
      createdAt: iso,
      meetingAt: iso.optional(),
      direction: z.enum(["incoming", "outgoing"]).optional(),
      demo: z.boolean().optional(),
    }),
  ),
  followUps: z.array(
    z.object({
      id: z.string(),
      leadId: z.string(),
      dueAt: iso,
      status: z.enum(["pending", "completed"]),
      completedAt: iso.optional(),
      notes: z.string(),
      sourceCallId: z.string().optional(),
      resolution: z.enum(["done", "replaced", "closed"]).optional(),
    }),
  ),
  sessions: z.array(
    z.object({
      id: z.string(),
      startedAt: iso,
      endedAt: iso.optional(),
      activeDuration: z.number().nonnegative(),
      activeSince: iso.optional(),
      status: z.enum(["active", "paused", "ended"]),
      selectedBatch: z.string(),
      selectedGroup: z.string().optional(),
      selectedSource: z.string().max(100).optional(),
      requirePhone: z.boolean().optional(),
      includedStatuses: z.array(z.enum(statuses)),
      currentLeadId: z.string().optional(),
      visited: z.array(z.string()),
    }),
  ),
  batches: z.array(
    z.object({
      id: z.string(),
      filename: z.string(),
      importedAt: iso,
      importedCount: z.number(),
      duplicateCount: z.number(),
      rejectedCount: z.number(),
      source: z.string().max(100).optional(),
      groupId: z.string().optional(),
      demo: z.boolean().optional(),
    }),
  ),
  xp: z.array(
    z.object({
      id: z.string(),
      sourceEventId: z.string(),
      type: z.enum(["call", "followup", "meeting", "customer"]),
      points: z.number(),
      createdAt: iso,
    }),
  ),
  settings: z.object({
    dailyCallTarget: z.number().int().positive(),
    weeklyCallTarget: z.number().int().positive(),
    weeklyMeetingTarget: z.number().int().positive(),
    weeklyFollowUpTarget: z.number().int().positive(),
    weeklyCustomerTarget: z.number().int().positive(),
    preferredWorkingDays: z.array(z.number().int().min(0).max(6)),
    theme: z.enum(["light", "dark", "system"]),
    defaultStatuses: z.array(z.enum(statuses)),
  }),
  groups: z
    .array(
      z.object({
        id: z.string().min(1),
        name: z.string().trim().min(1).max(80),
        color: z.enum(groupColors),
        createdAt: iso,
      }),
    )
    .default([]),
});
export const STORAGE_KEY = "callflow.data.v1";
export interface Repository {
  load(): Data | null;
  save(data: Data): void;
  raw(): string | null;
}
export class LocalStorageRepository implements Repository {
  load() {
    const raw = this.raw();
    if (raw === null) return null;
    try {
      return validateData(JSON.parse(raw));
    } catch {
      throw new Error(
        "Din sparade data kunde inte läsas. Originalet är kvar. Hämta en säkerhetskopia innan du återställer.",
      );
    }
  }
  save(data: Data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      throw new Error(
        "Ändringen kunde inte sparas. Webbläsarens lagring är full eller blockerad. Exportera en säkerhetskopia och frigör utrymme. Din tidigare data är kvar.",
      );
    }
  }
  raw() {
    return localStorage.getItem(STORAGE_KEY);
  }
}
export function validateData(value: unknown): Data {
  const d = dataSchema.parse(value);
  const leads = new Set(d.leads.map((l) => l.id));
  const groups = new Set(d.groups.map((g) => g.id));
  if (
    groups.size !== d.groups.length ||
    d.leads.some((l) => l.groupId && !groups.has(l.groupId))
  )
    throw new Error(
      "Grupperna innehåller dubbla ID:n eller saknade gruppreferenser.",
    );
  if (
    leads.size !== d.leads.length ||
    new Set(d.calls.map((c) => c.id)).size !== d.calls.length ||
    new Set(d.followUps.map((f) => f.id)).size !== d.followUps.length ||
    d.calls.some((c) => !leads.has(c.leadId)) ||
    d.followUps.some((f) => !leads.has(f.leadId))
  )
    throw new Error(
      "Säkerhetskopian innehåller dubbla ID:n eller saknade företagsreferenser.",
    );
  return d;
}
