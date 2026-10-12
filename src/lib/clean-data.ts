import { Data } from "./model";
import { deleteLeads } from "./engine";

// Remove only explicitly marked examples; imported or manually entered data stays.
export function withoutDemo(data: Data): Data {
  if (
    !data.leads.some((l) => l.demo) &&
    !data.calls.some((c) => c.demo) &&
    !data.batches.some((b) => b.demo)
  )
    return data;
  const cleaned = deleteLeads(
    data,
    data.leads.filter((l) => l.demo).map((l) => l.id),
  );
  const exampleCalls = new Set(
    cleaned.calls.filter((c) => c.demo).map((c) => c.id),
  );
  return {
    ...cleaned,
    calls: cleaned.calls.filter((c) => !c.demo),
    xp: cleaned.xp.filter((e) => !exampleCalls.has(e.sourceEventId)),
    batches: cleaned.batches.filter((b) => !b.demo),
  };
}
