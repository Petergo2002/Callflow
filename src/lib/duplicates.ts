import {
  Data,
  Lead,
  makeLead,
  normalizeDomain,
  normalizeName,
  leadPhones,
  nextStepLabels,
  formatDate,
} from "./model";

export interface DuplicateGroup {
  key: string;
  reason: string;
  leadIds: string[];
}
export function duplicateGroups(leads: Lead[]): DuplicateGroup[] {
  const indexes = new Map<string, Set<string>>();
  for (const lead of leads) {
    const keys = [
      ...leadPhones(lead).map((p) => "phone:" + p),
      ...[lead.website, ...(lead.alternateWebsites || [])]
        .map(normalizeDomain)
        .filter(Boolean)
        .map((d) => "domain:" + d),
      ...[lead.companyName, ...(lead.alternateNames || [])].map(
        (name) => "name:" + normalizeName(name),
      ),
    ];
    for (const key of new Set(keys)) {
      const ids = indexes.get(key) || new Set<string>();
      ids.add(lead.id);
      indexes.set(key, ids);
    }
  }
  const seen = new Set<string>();
  return [...indexes].flatMap(([key, ids]) => {
    if (ids.size < 2) return [];
    const leadIds = [...ids].sort();
    const identity = leadIds.join("|");
    if (seen.has(identity)) return [];
    seen.add(identity);
    return [
      {
        key,
        reason: key.startsWith("phone:")
          ? "Samma telefonnummer"
          : key.startsWith("domain:")
            ? "Samma webbdomän"
            : "Samma företagsnamn",
        leadIds,
      },
    ];
  });
}
export function mergeLeads(
  data: Data,
  primaryId: string,
  secondaryIds: string[],
): Data {
  const ids = new Set([primaryId, ...secondaryIds]);
  const selected = data.leads.filter((l) => ids.has(l.id));
  if (ids.size < 2 || selected.length !== ids.size)
    throw new Error("Välj minst två befintliga företag att slå ihop.");
  const primary = selected.find((l) => l.id === primaryId)!;
  const others = selected.filter((l) => l.id !== primaryId);
  const notes = [
    primary.notes,
    ...others.map((l) =>
      [
        `Sammanslaget från ${l.companyName} (${l.status})`,
        [l.phone, l.website, l.contactName, l.city, l.industry]
          .filter(Boolean)
          .join(" · "),
        `Källa: ${l.source || "Ej angiven"} · Grupp: ${data.groups.find((g) => g.id === l.groupId)?.name || "Utan grupp"}`,
        l.nextStep
          ? `Tidigare nästa steg: ${nextStepLabels[l.nextStep.kind]} ${formatDate(l.nextStep.dueAt, true, true)} ${l.nextStep.note}`
          : "",
        l.notes,
      ]
        .filter(Boolean)
        .join("\n"),
    ),
  ]
    .filter(Boolean)
    .join("\n\n");
  if (notes.length > 20000)
    throw new Error(
      "De samlade anteckningarna är för långa. Exportera en säkerhetskopia och korta anteckningarna innan du slår ihop; ingen data har ändrats.",
    );
  const fields = { ...primary };
  for (const field of [
    "phone",
    "website",
    "industry",
    "city",
    "contactName",
    "source",
    "groupId",
  ] as const)
    if (!fields[field])
      fields[field] = others.find((l) => l[field])?.[field] || "";
  const calls = data.calls.map((c) =>
    ids.has(c.leadId) ? { ...c, leadId: primaryId } : c,
  );
  const followUps = data.followUps.map((f) =>
    ids.has(f.leadId) ? { ...f, leadId: primaryId } : f,
  );
  const pending = followUps
    .filter((f) => f.leadId === primaryId && f.status === "pending")
    .sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const merged = makeLead(
    { ...fields, notes },
    {
      ...fields,
      createdAt: selected.map((l) => l.createdAt).sort()[0],
      updatedAt: new Date().toISOString(),
      lastContactedAt: [
        ...selected.map((l) => l.lastContactedAt),
        ...calls.filter((c) => c.leadId === primaryId).map((c) => c.createdAt),
      ]
        .filter((x): x is string => !!x)
        .sort()
        .at(-1),
      nextFollowUpAt: pending[0]?.dueAt,
      nextStep: primary.nextStep || others.find((l) => l.nextStep)?.nextStep,
      nextRetryAt: selected
        .map((l) => l.nextRetryAt)
        .filter((x): x is string => !!x)
        .sort()
        .at(-1),
      alternatePhones: [
        ...new Set(
          selected
            .flatMap((l) => [l.phone, ...(l.alternatePhones || [])])
            .filter(Boolean),
        ),
      ].filter((p) => p !== fields.phone),
      alternateWebsites: [
        ...new Set(
          selected
            .flatMap((l) => [l.website, ...(l.alternateWebsites || [])])
            .filter(Boolean),
        ),
      ].filter((w) => w !== fields.website),
      mergedFrom: [
        ...new Set(selected.flatMap((l) => [l.id, ...(l.mergedFrom || [])])),
      ].filter((leadId) => leadId !== primaryId),
      alternateNames: [
        ...new Set(
          selected.flatMap((l) => [l.companyName, ...(l.alternateNames || [])]),
        ),
      ].filter((name) => name !== primary.companyName),
    },
  );
  return {
    ...data,
    leads: data.leads.flatMap((l) =>
      l.id === primaryId ? [merged] : ids.has(l.id) ? [] : [l],
    ),
    calls,
    followUps,
    sessions: data.sessions.map((s) => ({
      ...s,
      currentLeadId:
        s.currentLeadId && ids.has(s.currentLeadId)
          ? primaryId
          : s.currentLeadId,
      visited: [
        ...new Set(
          s.visited.map((leadId) => (ids.has(leadId) ? primaryId : leadId)),
        ),
      ],
    })),
  };
}
