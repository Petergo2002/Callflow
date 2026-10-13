import {
  CallingSession,
  Data,
  rankedLeads,
  sessionIncludesLead,
  Status,
  contactMemory,
  contactedToday,
} from "./model";

export interface FocusSelectionValue {
  group: string;
  batch: string;
  source: string;
  included: Status[];
}
export function selectionSession(
  value: FocusSelectionValue,
  session?: CallingSession,
): CallingSession {
  return {
    id: "preview",
    startedAt: "",
    activeDuration: 0,
    status: "paused",
    visited: [],
    ...session,
    selectedGroup: value.group,
    selectedBatch: value.batch,
    selectedSource: value.source,
    includedStatuses: value.included,
    requirePhone: true,
  };
}
export function scopeLabel(data: Data, session: CallingSession) {
  return session.selectedGroup === "__none__"
    ? "Utan grupp"
    : session.selectedGroup
      ? data.groups.find((g) => g.id === session.selectedGroup)?.name ||
        "Gruppen har tagits bort"
      : "Alla grupper";
}
export function queueInfo(
  data: Data,
  session: CallingSession,
  now = new Date(),
) {
  const matching = data.leads.filter(
    (l) =>
      sessionIncludesLead(data, l, session) &&
      session.includedStatuses.includes(l.status),
  );
  const visited = new Set(session.visited);
  const unvisited = matching.filter((l) => !visited.has(l.id));
  const lastContact = contactMemory(data);
  const future = unvisited.filter(
    (l) =>
      !!l.phone.trim() &&
      ((l.nextFollowUpAt && new Date(l.nextFollowUpAt) > now) ||
        (l.nextRetryAt && new Date(l.nextRetryAt) > now)),
  );
  return {
    matching,
    ready: rankedLeads(data, session, now),
    missingPhone: unvisited.filter((l) => !l.phone.trim()).length,
    future,
    contactedToday: unvisited.filter(
      (l) => !!l.phone.trim() && contactedToday(l, lastContact(l), now),
    ).length,
    nextAt: future
      .map((l) =>
        [l.nextFollowUpAt, l.nextRetryAt]
          .filter((at): at is string => !!at && new Date(at) > now)
          .sort()
          .at(-1)!,
      )
      .sort()[0],
  };
}
