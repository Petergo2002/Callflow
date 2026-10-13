import {
  Data,
  Lead,
  dateKey,
  fromStockholm,
  shiftDate,
  stockholmInput,
  formatDate,
  nextStepLabels,
  contactMemory,
  contactedToday,
} from "./model";

export function attemptSummaries(data: Data) {
  const map = new Map<
    string,
    {
      attempts: number;
      missed: number;
      consecutiveMissed: number;
      neverAnswered: boolean;
      answeredSeen: boolean;
    }
  >();
  for (const call of [...data.calls]
    .reverse()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const summary = map.get(call.leadId) || {
      attempts: 0,
      missed: 0,
      consecutiveMissed: 0,
      neverAnswered: true,
      answeredSeen: false,
    };
    summary.attempts++;
    if (call.outcome === "Inget svar") {
      summary.missed++;
      if (!summary.answeredSeen) summary.consecutiveMissed++;
    } else {
      summary.neverAnswered = false;
      summary.answeredSeen = true;
    }
    map.set(call.leadId, summary);
  }
  return map;
}
export function attemptSummary(data: Data, leadId: string) {
  return (
    attemptSummaries(data).get(leadId) || {
      attempts: 0,
      missed: 0,
      consecutiveMissed: 0,
      neverAnswered: false,
    }
  );
}
export function attemptLabel(data: Data, leadId: string) {
  const s = attemptSummary(data, leadId);
  return `${s.attempts} försök${s.neverAnswered ? ", aldrig svarat" : s.consecutiveMissed ? `, ${s.consecutiveMissed} utan svar i rad` : ""}`;
}
// A different working day and time. Three unanswered attempts introduce a week's breathing room.
export function suggestRetry(data: Data, leadId: string, now = new Date()) {
  const summary = attemptSummary(data, leadId);
  const hour = Number(stockholmInput(now.toISOString()).slice(11, 13));
  const time = hour < 12 ? "14:00" : "09:30";
  const working = data.settings.preferredWorkingDays.length
    ? data.settings.preferredWorkingDays
    : [1, 2, 3, 4, 5];
  let day = shiftDate(dateKey(now), summary.consecutiveMissed >= 3 ? 7 : 1);
  for (let i = 0; i < 7; i++) {
    if (working.includes(new Date(day + "T12:00:00Z").getUTCDay())) break;
    day = shiftDate(day, 1);
  }
  return fromStockholm(`${day}T${time}`);
}
export function nextStepText(lead: Lead) {
  if (lead.nextRetryAt)
    return `Nästa försök · ${formatDate(lead.nextRetryAt, true)}${lead.nextFollowUpAt ? " · Obesvarad uppföljning kvar" : ""}`;
  if (lead.nextStep)
    return `${nextStepLabels[lead.nextStep.kind]} · ${formatDate(lead.nextStep.dueAt, true)}${lead.nextStep.note ? ` · ${lead.nextStep.note}` : ""}`;
  if (lead.nextFollowUpAt)
    return `Ring · ${formatDate(lead.nextFollowUpAt, true)}`;
  return "Nästa steg saknas";
}
export interface WorkItem {
  lead: Lead;
  reason: string;
  rank: number;
  at: string;
  action: "call" | "plan" | "offer" | "wait";
}
export function workNow(data: Data, now = new Date()): WorkItem[] {
  const latest = contactMemory(data);
  const today = dateKey(now);
  const summaries = attemptSummaries(data);
  return data.leads
    .flatMap((lead): WorkItem[] => {
      if (["Kund", "Inte intresserad"].includes(lead.status)) return [];
      const step = lead.nextStep;
      const item = (
        reason: string,
        rank: number,
        at: string,
        action: WorkItem["action"],
      ) => [{ lead, reason, rank, at, action }];
      const blockedCall =
        !lead.phone.trim() ||
        contactedToday(lead, latest(lead), now) ||
        (!!lead.nextRetryAt && new Date(lead.nextRetryAt) > now);
      if (step && step.kind !== "call") {
        if (new Date(step.dueAt) > now) return [];
        return item(
          `${dateKey(step.dueAt) < today ? "Försenat: " : ""}${nextStepLabels[step.kind]}`,
          dateKey(step.dueAt) < today ? 0 : 1,
          step.dueAt,
          step.kind,
        );
      }
      const due =
        lead.nextFollowUpAt || (step?.kind === "call" ? step.dueAt : undefined);
      if (due) {
        if (new Date(due) > now || blockedCall) return [];
        return item(
          dateKey(due) < today ? "Försenad återringning" : "Återringning nu",
          dateKey(due) < today ? 0 : 1,
          due,
          "call",
        );
      }
      if (
        ["Intresserad", "Möte bokat", "Återkom senare"].includes(lead.status) &&
        !step
      )
        return item(
          "Bestäm nästa steg",
          2,
          lead.lastContactedAt || lead.createdAt,
          "plan",
        );
      if (blockedCall) return [];
      if (lead.status === "Inget svar") {
        const summary = summaries.get(lead.id);
        if ((summary?.consecutiveMissed || 0) >= 3 && !lead.nextRetryAt)
          return item(
            "Flera försök utan svar – granska innan nästa samtal",
            4,
            lead.lastContactedAt || lead.createdAt,
            "plan",
          );
        return item(
          "Dags för ett nytt försök",
          4,
          lead.nextRetryAt || lead.lastContactedAt || lead.createdAt,
          "call",
        );
      }
      if (lead.status === "Ej kontaktad")
        return item("Nytt företag att kontakta", 3, lead.createdAt, "call");
      return [];
    })
    .sort((a, b) => a.rank - b.rank || a.at.localeCompare(b.at));
}
