import {
  CallLog,
  CallingSession,
  Data,
  FollowUp,
  Lead,
  LeadInput,
  Status,
  XPEvent,
  dateKey,
  id,
  makeLead,
  outcomes,
  rankedLeads,
  sessionSeconds,
} from "./model";

export function updateLead(data: Data, leadId: string, input: LeadInput) {
  const old = data.leads.find((l) => l.id === leadId);
  if (!old) throw new Error("Företaget finns inte längre.");
  const changed = makeLead(input, {
    ...old,
    ...input,
    updatedAt: new Date().toISOString(),
  });
  return {
    ...data,
    leads: data.leads.map((l) => (l.id === leadId ? changed : l)),
  };
}
export function deleteLeads(data: Data, ids: string[]): Data {
  const callIds = data.calls
    .filter((c) => ids.includes(c.leadId))
    .map((c) => c.id);
  const followIds = data.followUps
    .filter((f) => ids.includes(f.leadId))
    .map((f) => f.id);
  return {
    ...data,
    leads: data.leads.filter((l) => !ids.includes(l.id)),
    calls: data.calls.filter((c) => !ids.includes(c.leadId)),
    followUps: data.followUps.filter((f) => !ids.includes(f.leadId)),
    xp: data.xp.filter(
      (e) => ![...callIds, ...followIds].includes(e.sourceEventId),
    ),
    sessions: data.sessions.map((s) => ({
      ...s,
      currentLeadId: ids.includes(s.currentLeadId || "")
        ? undefined
        : s.currentLeadId,
      visited: s.visited.filter((v) => !ids.includes(v)),
    })),
  };
}
export function startSession(
  data: Data,
  batch: string,
  included: Status[],
  leadId?: string,
): Data {
  const active = data.sessions.find((s) => s.status !== "ended");
  if (active) return changeSession(data, active.id, "active", leadId);
  const now = new Date().toISOString();
  const s: CallingSession = {
    id: id(),
    startedAt: now,
    activeDuration: 0,
    activeSince: now,
    status: "active",
    selectedBatch: batch,
    includedStatuses: included,
    visited: [],
    currentLeadId: leadId,
  };
  if (!s.currentLeadId) s.currentLeadId = rankedLeads(data, s)[0]?.id;
  return { ...data, sessions: [...data.sessions, s] };
}
export function changeSession(
  data: Data,
  sessionId: string,
  status: CallingSession["status"],
  leadId?: string,
): Data {
  return {
    ...data,
    sessions: data.sessions.map((s) =>
      s.id === sessionId
        ? {
            ...s,
            status,
            activeDuration: sessionSeconds(s),
            activeSince:
              status === "active" ? new Date().toISOString() : undefined,
            endedAt: status === "ended" ? new Date().toISOString() : undefined,
            currentLeadId:
              leadId ||
              s.currentLeadId ||
              (status === "active" ? rankedLeads(data, s)[0]?.id : undefined),
          }
        : s,
    ),
  };
}
export function nextLead(
  data: Data,
  sessionId: string,
  previous = false,
): Data {
  return {
    ...data,
    sessions: data.sessions.map((s) => {
      if (s.id !== sessionId) return s;
      if (previous) {
        const visited = [...s.visited];
        const currentLeadId = visited.pop();
        return currentLeadId ? { ...s, visited, currentLeadId } : s;
      }
      const visited = [
        ...new Set([
          ...s.visited,
          ...(s.currentLeadId ? [s.currentLeadId] : []),
        ]),
      ];
      return {
        ...s,
        visited,
        currentLeadId: rankedLeads(data, { ...s, visited })[0]?.id,
      };
    }),
  };
}
export interface UndoCall {
  callId: string;
  previousLead: Lead;
  previousFollowUps: FollowUp[];
  session?: CallingSession;
}
export function logCall(
  data: Data,
  args: {
    leadId: string;
    sessionId?: string;
    outcome: Status;
    eventId: string;
    followUpAt?: string;
    meetingAt?: string;
    notes?: string;
  },
): { data: Data; undo?: UndoCall } {
  if (data.calls.some((c) => c.id === args.eventId)) return { data };
  if (!outcomes.includes(args.outcome))
    throw new Error("Välj ett giltigt samtalsresultat.");
  const lead = data.leads.find((l) => l.id === args.leadId);
  if (!lead) throw new Error("Företaget finns inte längre.");
  const session = data.sessions.find((s) => s.id === args.sessionId);
  if (
    args.sessionId &&
    (!session ||
      session.status !== "active" ||
      session.currentLeadId !== lead.id)
  )
    return { data };
  if (
    args.outcome === "Återkom senare" &&
    (!args.followUpAt ||
      !Number.isFinite(new Date(args.followUpAt).getTime()) ||
      new Date(args.followUpAt).getTime() <= Date.now())
  )
    throw new Error("Välj en tid i framtiden.");
  const now = new Date().toISOString();
  const call: CallLog = {
    id: args.eventId,
    leadId: lead.id,
    sessionId: args.sessionId,
    outcome: args.outcome,
    notes: args.notes ?? lead.notes,
    createdAt: now,
    meetingAt: args.meetingAt,
  };
  const due = data.followUps.filter(
    (f) =>
      f.leadId === lead.id &&
      f.status === "pending" &&
      new Date(f.dueAt).getTime() <= Date.now(),
  );
  const pending = data.followUps.filter(
    (f) => f.leadId === lead.id && f.status === "pending",
  );
  let followUps = data.followUps.map((f) =>
    due.some((d) => d.id === f.id) ||
    (args.followUpAt && pending.some((d) => d.id === f.id))
      ? { ...f, status: "completed" as const, completedAt: now }
      : f,
  );
  if (args.followUpAt)
    followUps = [
      ...followUps,
      {
        id: id(),
        leadId: lead.id,
        dueAt: args.followUpAt,
        status: "pending",
        notes: args.notes ?? lead.notes,
        sourceCallId: call.id,
      },
    ];
  const xp: XPEvent[] = [
    {
      id: id(),
      sourceEventId: call.id,
      type: "call",
      points: 5,
      createdAt: now,
    },
  ];
  for (const f of due)
    if (!data.xp.some((e) => e.sourceEventId === f.id && e.type === "followup"))
      xp.push({
        id: id(),
        sourceEventId: f.id,
        type: "followup",
        points: 10,
        createdAt: now,
      });
  for (const [outcome, type, points] of [
    ["Möte bokat", "meeting", 30],
    ["Kund", "customer", 100],
  ] as const)
    if (
      args.outcome === outcome &&
      !data.calls.some((c) => c.leadId === lead.id && c.outcome === outcome)
    )
      xp.push({
        id: id(),
        sourceEventId: call.id,
        type,
        points,
        createdAt: now,
      });
  const nextFollowUpAt = followUps
    .filter((f) => f.leadId === lead.id && f.status === "pending")
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0]?.dueAt;
  let result: Data = {
    ...data,
    calls: [...data.calls, call],
    followUps,
    xp: [...data.xp, ...xp],
    leads: data.leads.map((l) =>
      l.id === lead.id
        ? {
            ...l,
            status: args.outcome,
            lastContactedAt: now,
            nextFollowUpAt,
            updatedAt: now,
          }
        : l,
    ),
  };
  if (session) result = nextLead(result, session.id);
  return {
    data: result,
    undo: {
      callId: call.id,
      previousLead: lead,
      previousFollowUps: pending,
      session,
    },
  };
}
export function undoCall(data: Data, undo: UndoCall): Data {
  const call = data.calls.find((c) => c.id === undo.callId);
  if (!call) return data;
  const later = data.calls.some(
    (c) => c.leadId === call.leadId && c.createdAt > call.createdAt,
  );
  if (later)
    throw new Error(
      "Ett senare samtal finns för företaget. Ångra det senaste först.",
    );
  const restoredIds = undo.previousFollowUps
    .filter((f) =>
      data.followUps.some(
        (x) => x.id === f.id && x.completedAt === call.createdAt,
      ),
    )
    .map((f) => f.id);
  return {
    ...data,
    calls: data.calls.filter((c) => c.id !== call.id),
    leads: data.leads.map((l) =>
      l.id === call.leadId
        ? {
            ...l,
            status: undo.previousLead.status,
            lastContactedAt: undo.previousLead.lastContactedAt,
            nextFollowUpAt: undo.previousLead.nextFollowUpAt,
          }
        : l,
    ),
    followUps: data.followUps
      .filter((f) => f.sourceCallId !== call.id)
      .map((f) =>
        restoredIds.includes(f.id)
          ? undo.previousFollowUps.find((x) => x.id === f.id)!
          : f,
      ),
    xp: data.xp.filter(
      (e) =>
        e.sourceEventId !== call.id && !restoredIds.includes(e.sourceEventId),
    ),
    sessions: data.sessions.map((s) =>
      s.id === undo.session?.id && s.status !== "ended"
        ? {
            ...s,
            currentLeadId: call.leadId,
            visited: s.visited.filter((v) => v !== call.leadId),
          }
        : s,
    ),
  };
}
export function completeFollowUp(data: Data, followId: string): Data {
  const f = data.followUps.find((f) => f.id === followId);
  if (!f || f.status === "completed") return data;
  const now = new Date().toISOString();
  const followUps = data.followUps.map((x) =>
    x.id === f.id
      ? { ...x, status: "completed" as const, completedAt: now }
      : x,
  );
  const next = followUps
    .filter((x) => x.leadId === f.leadId && x.status === "pending")
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0]?.dueAt;
  return {
    ...data,
    followUps,
    leads: data.leads.map((l) =>
      l.id === f.leadId ? { ...l, nextFollowUpAt: next } : l,
    ),
    xp: data.xp.some((e) => e.sourceEventId === f.id)
      ? data.xp
      : [
          ...data.xp,
          {
            id: id(),
            sourceEventId: f.id,
            type: "followup",
            points: 10,
            createdAt: now,
          },
        ],
  };
}
export function reschedule(data: Data, followId: string, dueAt: string): Data {
  const f = data.followUps.find((f) => f.id === followId);
  if (!f) throw new Error("Uppföljningen finns inte längre.");
  if (
    !Number.isFinite(new Date(dueAt).getTime()) ||
    new Date(dueAt).getTime() <= Date.now()
  )
    throw new Error("Välj en tid i framtiden.");
  const followUps = data.followUps.map((x) =>
    x.id === followId ? { ...x, dueAt } : x,
  );
  return {
    ...data,
    followUps,
    leads: data.leads.map((l) =>
      l.id === f.leadId
        ? {
            ...l,
            nextFollowUpAt: followUps
              .filter((x) => x.leadId === l.id && x.status === "pending")
              .sort((a, b) => a.dueAt.localeCompare(b.dueAt))[0]?.dueAt,
          }
        : l,
    ),
  };
}
export function completedThisWeek(data: Data, start: string) {
  return data.followUps.filter(
    (f) => f.completedAt && dateKey(f.completedAt) >= start,
  ).length;
}
