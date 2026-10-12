import { Data, groupColors, id } from "./model";
import { deleteLeads } from "./engine";
export function saveGroup(
  data: Data,
  name: string,
  color: string,
  groupId?: string,
): Data {
  name = name.trim();
  if (!name || name.length > 80)
    throw new Error("Ange ett gruppnamn med högst 80 tecken.");
  if (!(groupColors as readonly string[]).includes(color))
    throw new Error("Välj en av gruppfärgerna.");
  if (
    data.groups.some(
      (g) =>
        g.id !== groupId &&
        g.name.toLocaleLowerCase("sv") === name.toLocaleLowerCase("sv"),
    )
  )
    throw new Error("Det finns redan en grupp med det namnet.");
  if (groupId && !data.groups.some((g) => g.id === groupId))
    throw new Error("Gruppen finns inte längre.");
  return {
    ...data,
    groups: groupId
      ? data.groups.map((g) => (g.id === groupId ? { ...g, name, color } : g))
      : [
          ...data.groups,
          { id: id(), name, color, createdAt: new Date().toISOString() },
        ],
  };
}
export function removeGroup(data: Data, groupId: string): Data {
  return {
    ...data,
    groups: data.groups.filter((g) => g.id !== groupId),
    leads: data.leads.map((l) =>
      l.groupId === groupId
        ? { ...l, groupId: "", updatedAt: new Date().toISOString() }
        : l,
    ),
    batches: data.batches.map((b) =>
      b.groupId === groupId ? { ...b, groupId: "" } : b,
    ),
  };
}
export function organizeLeads(
  data: Data,
  ids: string[],
  changes: { source?: string; groupId?: string },
): Data {
  if (changes.groupId && !data.groups.some((g) => g.id === changes.groupId))
    throw new Error("Gruppen finns inte längre.");
  if (changes.source && changes.source.trim().length > 100)
    throw new Error("Källnamnet är för långt.");
  const selected = new Set(ids);
  return {
    ...data,
    leads: data.leads.map((l) =>
      selected.has(l.id)
        ? { ...l, ...changes, updatedAt: new Date().toISOString() }
        : l,
    ),
  };
}
export function removeImport(data: Data, batchId: string): Data {
  const cleaned = deleteLeads(
    data,
    data.leads.filter((l) => l.importBatchId === batchId).map((l) => l.id),
  );
  return {
    ...cleaned,
    batches: cleaned.batches.filter((b) => b.id !== batchId),
    sessions: cleaned.sessions.map((s) =>
      s.selectedBatch === batchId ? { ...s, selectedBatch: "all" } : s,
    ),
  };
}
