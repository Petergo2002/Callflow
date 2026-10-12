import {
  Data,
  LeadInput,
  dateKey,
  emptyData,
  fromStockholm,
  id,
  makeLead,
  shiftDate,
} from "./model";
export function demoData(): Data {
  const d = emptyData();
  const today = dateKey();
  const batchId = id();
  d.batches.push({
    id: batchId,
    filename: "Göteborg & västkusten · demodata",
    importedAt: new Date().toISOString(),
    importedCount: 24,
    duplicateCount: 0,
    rejectedCount: 0,
    demo: true,
  });
  const companies = [
    "Lind & Lund Bygg",
    "Studio Äng",
    "Nordhamn Elektriska",
    "Kvarteret Kaffe",
    "Bergström VVS",
    "Västkustens Måleri",
    "Forma Arkitekter",
    "Grönska Trädgård",
    "Strandberg Bilservice",
    "Mölndals Tandklinik",
    "Söder & Co",
    "Haga Blomster",
    "Alva Redovisning",
    "Fjord Digital",
    "Kungsbacka Sten",
    "Lilla Bageriet",
    "Öster Massage",
    "Lundqvist Plåt",
    "Smedjan Design",
    "Björk Fastighet",
    "Göta Flytt",
    "Vinga Optik",
    "Falken Rör",
    "Eken Interiör",
  ];
  const industries = [
    "Bygg & hantverk",
    "Design & kreativa",
    "Bygg & hantverk",
    "Mat & café",
    "Bygg & hantverk",
    "Bygg & hantverk",
  ];
  companies.forEach((name, i) => {
    const input: LeadInput = {
      companyName: name,
      phone: `031-${String(7201000 + i * 117).replace(/(\d{3})(\d{2})(\d{2})/, "$1 $2 $3")}`,
      website: `https://${name.toLowerCase().replace(/[^a-z]/g, "")}.example`,
      city: ["Göteborg", "Mölndal", "Kungsbacka"][i % 3],
      industry: industries[i % 6],
      contactName: [
        "Erik Lind",
        "Emma Andersson",
        "Johan Berg",
        "Sofia Nilsson",
      ][i % 4],
      notes:
        i === 0
          ? "Lokal byggfirma med fokus på renovering. Deras nuvarande hemsida är äldre. Fråga hur de får nya förfrågningar idag."
          : "",
      status:
        i < 9
          ? "Ej kontaktad"
          : i < 14
            ? "Inget svar"
            : i < 18
              ? "Återkom senare"
              : i < 21
                ? "Intresserad"
                : i < 23
                  ? "Möte bokat"
                  : "Kund",
    };
    const lead = makeLead(input, {
      importBatchId: batchId,
      demo: true,
      createdAt: fromStockholm(shiftDate(today, -12) + "T09:00"),
    });
    d.leads.push(lead);
    if (i >= 9) {
      const createdAt = fromStockholm(shiftDate(today, -(i % 7)) + "T09:30");
      const cid = id();
      d.calls.push({
        id: cid,
        leadId: lead.id,
        outcome: lead.status,
        notes: i % 2 ? "Bra samtal. Återkom med ett konkret förslag." : "",
        createdAt,
        demo: true,
      });
      lead.lastContactedAt = createdAt;
      d.xp.push({
        id: id(),
        sourceEventId: cid,
        type: "call",
        points: 5,
        createdAt,
      });
      if (lead.status === "Möte bokat" || lead.status === "Kund")
        d.xp.push({
          id: id(),
          sourceEventId: cid,
          type: lead.status === "Kund" ? "customer" : "meeting",
          points: lead.status === "Kund" ? 100 : 30,
          createdAt,
        });
      if (i >= 14 && i < 18) {
        const dueAt = fromStockholm(
          shiftDate(today, i === 14 ? -1 : i === 15 ? 0 : 2) + "T09:00",
        );
        lead.nextFollowUpAt = dueAt;
        d.followUps.push({
          id: id(),
          leadId: lead.id,
          dueAt,
          status: "pending",
          notes: "Prata med ansvarig om en ny hemsida.",
          sourceCallId: cid,
        });
      }
    }
  });
  return d;
}
