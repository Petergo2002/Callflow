"use client";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react";
import {
  ArrowDown,
  ArrowUpDown,
  ArrowLeft,
  ArrowRight,
  Download,
  ExternalLink,
  Phone,
  Plus,
  Search,
  Trash2,
  Upload,
  SlidersHorizontal,
  Columns3,
  MoreHorizontal,
  X,
  Check,
  Folder,
  CalendarDays,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import {
  Lead,
  formatDate,
  formatImportDate,
  safeWebsite,
  statuses,
  importDate,
  sourceName,
  dateKey,
} from "@/lib/model";
import { removeImport } from "@/lib/organization";
import { LeadGroups } from "./lead-groups";
import { LeadBulkAction, BulkAction } from "./lead-bulk-action";
import { deleteLeads } from "@/lib/engine";
import { download, exportCSV } from "@/lib/import";
import { Button } from "./ui/button";
import { Empty, StatusBadge } from "./shared";
function subscribeMobile(listener: () => void) {
  const media = window.matchMedia("(max-width: 760px)");
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}
export function Leads({
  onOpen,
  onAdd,
  onImport,
  onCall,
}: {
  onOpen: (l: Lead) => void;
  onAdd: (groupId?: string) => void;
  onImport: (groupId?: string) => void;
  onCall: (id: string) => void;
}) {
  const { data, mutate } = useStore();
  const params = useSearchParams();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);
  const [query, setQuery] = useState(params.get("q") || "");
  const deferred = useDeferredValue(query);
  const [status, setStatus] = useState(params.get("status") || "");
  const [industry, setIndustry] = useState("");
  const [batch, setBatch] = useState("");
  const [source, setSource] = useState("");
  const [groupValue, setGroup] = useState("");
  const group =
    groupValue === "__none__" || data?.groups.some((g) => g.id === groupValue)
      ? groupValue
      : "";
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [managingGroups, setManagingGroups] = useState(false);
  const [creatingGroup, setCreatingGroup] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [extraColumns, setExtraColumns] = useState(false);
  const [bulkAction, setBulkAction] = useState<BulkAction | null>(null);
  const [selection, setSelected] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const mobile = useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia("(max-width: 760px)").matches,
    () => false,
  );
  const [sort, setSort] = useState<keyof Lead>("createdAt");
  const [ascending, setAscending] = useState(false);
  const [page, setPage] = useState(0);

  const attempts = useMemo(() => {
    const map = new Map<string, number>();
    data?.calls.forEach((c) => map.set(c.leadId, (map.get(c.leadId) || 0) + 1));
    return map;
  }, [data?.calls]);
  const filtered = useMemo(
    () =>
      data?.leads
        .filter(
          (l) =>
            (!status || l.status === status) &&
            (!industry || l.industry === industry) &&
            (!batch || l.importBatchId === batch) &&
            (!source || sourceName(data!, l) === source) &&
            (!group ||
              (group === "__none__" ? !l.groupId : l.groupId === group)) &&
            (!fromDate ||
              (importDate(data!, l) &&
                dateKey(importDate(data!, l)) >= fromDate)) &&
            (!toDate ||
              (importDate(data!, l) &&
                dateKey(importDate(data!, l)) <= toDate)) &&
            [l.companyName, l.phone, l.city, l.contactName, l.industry].some(
              (v) => v.toLowerCase().includes(deferred.toLowerCase()),
            ),
        )
        .sort((a, b) =>
          sort === "importedAt" &&
          (!importDate(data!, a) || !importDate(data!, b))
            ? importDate(data!, a)
              ? -1
              : importDate(data!, b)
                ? 1
                : 0
            : String(
                sort === "importedAt"
                  ? importDate(data!, a)
                  : sort === "source"
                    ? sourceName(data!, a)
                    : (a[sort] ?? ""),
              ).localeCompare(
                String(
                  sort === "importedAt"
                    ? importDate(data!, b)
                    : sort === "source"
                      ? sourceName(data!, b)
                      : (b[sort] ?? ""),
                ),
                "sv",
                {
                  numeric: true,
                },
              ) * (ascending ? 1 : -1),
        ) || [],
    [
      data,
      status,
      industry,
      batch,
      source,
      group,
      fromDate,
      toDate,
      deferred,
      sort,
      ascending,
    ],
  );
  const selected = useMemo(() => {
    const matching = new Set(filtered.map((l) => l.id));
    return selection.filter((id) => matching.has(id));
  }, [selection, filtered]);
  const groupCounts = useMemo(() => {
    const counts = new Map<string, number>();
    data?.leads.forEach((l) => {
      const key = l.groupId || "__none__";
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [data?.leads]);
  if (!data) return null;
  const pageCount = Math.max(1, Math.ceil(filtered.length / 50));
  const currentPage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(currentPage * 50, currentPage * 50 + 50);
  const allChecked =
    visible.length > 0 && visible.every((l) => selected.includes(l.id));
  function changeSort(key: keyof Lead) {
    setAscending(key === sort ? !ascending : true);
    setSort(key);
  }
  function changeScope(update: () => void) {
    update();
    setPage(0);
    setSelected([]);
    setMessage("");
  }
  function clearFilters() {
    changeScope(() => {
      setQuery("");
      setStatus("");
      setIndustry("");
      setBatch("");
      setSource("");
      setGroup("");
      setFromDate("");
      setToDate("");
    });
  }
  function toggleLead(id: string) {
    setSelected(
      selected.includes(id)
        ? selected.filter((s) => s !== id)
        : [...selected, id],
    );
  }
  function togglePage() {
    setSelected(
      allChecked
        ? selected.filter((id) => !visible.some((l) => l.id === id))
        : [...new Set([...selected, ...visible.map((l) => l.id)])],
    );
  }
  const advancedCount = [industry, batch, source, fromDate || toDate].filter(
    Boolean,
  ).length;
  const nonGroupFilter = [
    query,
    status,
    industry,
    batch,
    source,
    fromDate,
    toDate,
  ].some(Boolean);
  const filterChips: { key: string; label: string; remove: () => void }[] = [];
  if (status)
    filterChips.push({
      key: "status",
      label: status,
      remove: () => setStatus(""),
    });
  if (source)
    filterChips.push({
      key: "source",
      label: `Källa: ${source}`,
      remove: () => setSource(""),
    });
  if (industry)
    filterChips.push({
      key: "industry",
      label: industry,
      remove: () => setIndustry(""),
    });
  if (batch)
    filterChips.push({
      key: "batch",
      label:
        data.batches.find((b) => b.id === batch)?.filename || "Importlista",
      remove: () => setBatch(""),
    });
  if (group)
    filterChips.push({
      key: "group",
      label:
        group === "__none__"
          ? "Utan grupp"
          : data.groups.find((g) => g.id === group)?.name || "Grupp",
      remove: () => setGroup(""),
    });
  if (fromDate || toDate)
    filterChips.push({
      key: "date",
      label: `Import: ${fromDate || "tidigast"} – ${toDate || "senast"}`,
      remove: () => {
        setFromDate("");
        setToDate("");
      },
    });
  if (query)
    filterChips.push({
      key: "query",
      label: `Sök: ${query}`,
      remove: () => setQuery(""),
    });
  return (
    <>
      <div className="page-heading leads-heading">
        <div>
          <h1>Dina leads</h1>
          <p>
            {data.leads.length.toLocaleString("sv-SE")} företag i ditt
            arbetsrum.
          </p>
        </div>
        <div className="flex">
          <Button
            variant="secondary"
            onClick={() =>
              onImport(group && group !== "__none__" ? group : undefined)
            }
          >
            <Upload size={14} />
            Importera
          </Button>
          <Button
            onClick={() =>
              onAdd(group && group !== "__none__" ? group : undefined)
            }
          >
            <Plus size={14} />
            Lägg till företag
          </Button>
        </div>
      </div>
      <div className="leads-group-navigation">
        <Folder size={15} />
        <label className="sr-only" htmlFor="lead-group-view">
          Filtrera grupp
        </label>
        <select
          id="lead-group-view"
          value={group}
          onChange={(e) => {
            if (e.target.value === "__new__") {
              setCreatingGroup(true);
              setManagingGroups(true);
            } else changeScope(() => setGroup(e.target.value));
          }}
        >
          <option value="">Alla leads · {data.leads.length}</option>
          <option value="__none__">
            Utan grupp · {groupCounts.get("__none__") || 0}
          </option>
          {[...data.groups]
            .sort((a, b) => a.name.localeCompare(b.name, "sv"))
            .map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} · {groupCounts.get(g.id) || 0}
              </option>
            ))}
          <option value="__new__">＋ Skapa en ny grupp</option>
        </select>
        {group && group !== "__none__" && (
          <i
            className="group-selected-dot"
            style={{
              backgroundColor: data.groups.find((g) => g.id === group)?.color,
            }}
          />
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setCreatingGroup(false);
            setManagingGroups(true);
          }}
        >
          Hantera grupper
        </Button>
      </div>
      <div className="leads-controls">
        <div className="search-field">
          <Search size={15} />
          <input
            className="input"
            aria-label="Sök företag"
            placeholder="Sök företag, telefon eller ort…"
            value={query}
            onChange={(e) => changeScope(() => setQuery(e.target.value))}
          />
        </div>
        <select
          aria-label="Filtrera status"
          value={status}
          onChange={(e) => changeScope(() => setStatus(e.target.value))}
        >
          <option value="">Alla statusar</option>
          {statuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <Button
          variant="secondary"
          aria-expanded={filtersOpen}
          aria-controls="lead-filter-panel"
          onClick={() => setFiltersOpen(!filtersOpen)}
        >
          <SlidersHorizontal size={14} />
          Filter
          {advancedCount > 0 && (
            <span className="control-count">{advancedCount}</span>
          )}
        </Button>
        <div className="leads-view-controls">
          <select
            aria-label="Sortera leads"
            value={`${sort}:${ascending ? "asc" : "desc"}`}
            onChange={(e) => {
              const [key, direction] = e.target.value.split(":");
              setSort(key as keyof Lead);
              setAscending(direction === "asc");
              setPage(0);
            }}
          >
            <option value="createdAt:desc">Senast tillagda</option>
            <option value="createdAt:asc">Äldst tillagda</option>
            <option value="importedAt:desc">Senast importerade</option>
            <option value="importedAt:asc">Äldst importerade</option>
            <option value="companyName:asc">Företag A–Ö</option>
            <option value="companyName:desc">Företag Ö–A</option>
            <option value="source:asc">Källa A–Ö</option>
            <option value="source:desc">Källa Ö–A</option>
            <option value="lastContactedAt:desc">Senaste kontakt</option>
            <option value="lastContactedAt:asc">Äldst kontakt</option>
            <option value="nextFollowUpAt:asc">Nästa uppföljning</option>
            <option value="nextFollowUpAt:desc">
              Senast planerad uppföljning
            </option>
            {![
              "createdAt",
              "importedAt",
              "companyName",
              "source",
              "lastContactedAt",
              "nextFollowUpAt",
            ].includes(sort) && (
              <option value={`${sort}:${ascending ? "asc" : "desc"}`}>
                Vald tabellkolumn
              </option>
            )}
          </select>
          <Button
            size="icon"
            variant={extraColumns ? "secondary" : "ghost"}
            aria-label="Visa fler detaljer"
            aria-pressed={extraColumns}
            title="Visa hemsida, senaste kontakt och antal försök"
            onClick={() => setExtraColumns(!extraColumns)}
          >
            <Columns3 size={16} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Exportera CSV"
            title={`Exportera ${filtered.length} leads`}
            onClick={() =>
              download(
                exportCSV({ ...data, leads: filtered }),
                "callflow-leads.csv",
              )
            }
          >
            <Download size={16} />
          </Button>
        </div>
      </div>
      {filtersOpen && (
        <section
          id="lead-filter-panel"
          className="lead-filter-panel"
          aria-label="Fler filter"
        >
          <div className="lead-filter-fields">
            <label className="form-field">
              Källa
              <select
                aria-label="Filtrera källa"
                value={source}
                onChange={(e) => changeScope(() => setSource(e.target.value))}
              >
                <option value="">Alla källor</option>
                {[...new Set(data.leads.map((l) => sourceName(data, l)))]
                  .sort((a, b) => a.localeCompare(b, "sv"))
                  .map((s) => (
                    <option key={s}>{s}</option>
                  ))}
              </select>
            </label>
            <label className="form-field">
              Bransch
              <select
                aria-label="Filtrera bransch"
                value={industry}
                onChange={(e) => changeScope(() => setIndustry(e.target.value))}
              >
                <option value="">Alla branscher</option>
                {[...new Set(data.leads.map((l) => l.industry).filter(Boolean))]
                  .sort((a, b) => a.localeCompare(b, "sv"))
                  .map((s) => (
                    <option key={s}>{s}</option>
                  ))}
              </select>
            </label>
            <label className="form-field">
              Importlista
              <select
                aria-label="Filtrera import"
                value={batch}
                onChange={(e) => changeScope(() => setBatch(e.target.value))}
              >
                <option value="">Alla importer</option>
                {data.batches.map((b) => (
                  <option value={b.id} key={b.id}>
                    {b.filename} · {formatImportDate(b.importedAt)}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              Importerad från
              <input
                className="input"
                aria-label="Importerad från datum"
                type="date"
                value={fromDate}
                max={toDate || undefined}
                onChange={(e) => changeScope(() => setFromDate(e.target.value))}
              />
            </label>
            <label className="form-field">
              Importerad till
              <input
                className="input"
                aria-label="Importerad till datum"
                type="date"
                value={toDate}
                min={fromDate || undefined}
                onChange={(e) => changeScope(() => setToDate(e.target.value))}
              />
            </label>
          </div>
          <div className="filter-panel-footer">
            <span>
              {filtered.length.toLocaleString("sv-SE")} leads matchar filtren
            </span>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setFiltersOpen(false)}
            >
              Stäng filter
            </Button>
          </div>
        </section>
      )}
      {filterChips.length > 0 && (
        <div className="applied-lead-filters" aria-label="Aktiva filter">
          {filterChips.map((f) => (
            <button
              key={f.key}
              onClick={() => changeScope(f.remove)}
              aria-label={`Ta bort filter ${f.label}`}
            >
              {f.label}
              <X size={12} />
            </button>
          ))}
          <Button size="sm" variant="ghost" onClick={clearFilters}>
            Rensa filter
          </Button>
        </div>
      )}
      {message && (
        <div className="lead-success" role="status">
          <Check size={14} />
          {message}
          <Button
            size="icon"
            variant="ghost"
            aria-label="Stäng bekräftelse"
            onClick={() => setMessage("")}
          >
            <X size={13} />
          </Button>
        </div>
      )}
      {batch && (
        <div className="import-list-summary">
          <div>
            <strong>
              {data.batches.find((b) => b.id === batch)?.filename}
            </strong>
            <span>
              {formatImportDate(
                data.batches.find((b) => b.id === batch)?.importedAt,
                true,
              )}{" "}
              · {data.leads.filter((l) => l.importBatchId === batch).length}{" "}
              leads i importen
            </span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="danger-text"
            onClick={() => {
              const count = data.leads.filter(
                (l) => l.importBatchId === batch,
              ).length;
              if (
                window.confirm(
                  `Ta bort hela importen och dess ${count} leads, samtal, uppföljningar och XP? Detta omfattar även leads som döljs av andra filter. Det går inte att ångra utan säkerhetskopia.`,
                ) &&
                mutate((d) => removeImport(d, batch))
              ) {
                setBatch("");
                setSelected([]);
                setMessage("Importen och dess leads är borttagna.");
              }
            }}
          >
            <Trash2 size={14} />
            Ta bort import
          </Button>
        </div>
      )}
      {selected.length > 0 && (
        <div
          className="lead-selection-bar"
          aria-label="Åtgärder för markerade leads"
        >
          <strong>{selected.length} valda</strong>
          {selected.length < filtered.length && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSelected(filtered.map((l) => l.id))}
            >
              Välj alla {filtered.length} träffar
            </Button>
          )}
          <div className="lead-selection-actions">
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setBulkAction("status")}
            >
              Ändra status
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setBulkAction("group")}
            >
              Flytta till grupp
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setBulkAction("source")}
            >
              Ändra källa
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="danger-text"
              onClick={() => {
                if (
                  window.confirm(
                    `Ta bort ${selected.length} markerade företag och deras samtal, uppföljningar och XP? Det går inte att ångra.`,
                  ) &&
                  mutate((d) => deleteLeads(d, selected))
                ) {
                  setMessage(`${selected.length} leads är borttagna.`);
                  setSelected([]);
                }
              }}
            >
              <Trash2 size={13} />
              Ta bort
            </Button>
          </div>
          <Button
            size="icon"
            variant="ghost"
            aria-label="Avmarkera alla"
            onClick={() => setSelected([])}
          >
            <X size={15} />
          </Button>
        </div>
      )}
      {data.leads.length === 0 ? (
        <div className="panel">
          <Empty
            onAdd={() =>
              onAdd(group && group !== "__none__" ? group : undefined)
            }
            onImport={() =>
              onImport(group && group !== "__none__" ? group : undefined)
            }
          />
        </div>
      ) : filtered.length === 0 ? (
        <div className="panel">
          <Empty
            title={
              group && !nonGroupFilter
                ? "Gruppen väntar på sina första leads."
                : "Ingen träff just nu."
            }
            description={
              group && !nonGroupFilter
                ? "Importera en lista hit eller lägg till ett företag. Du kan också flytta befintliga leads via markeringarna."
                : "Prova en annan sökning eller ta bort ett aktivt filter."
            }
          />
          <div className="flex justify-center pb-6">
            {group && !nonGroupFilter ? (
              <>
                <Button
                  onClick={() =>
                    onImport(group !== "__none__" ? group : undefined)
                  }
                >
                  <Upload size={14} />
                  Importera till gruppen
                </Button>
                <Button
                  variant="secondary"
                  onClick={() =>
                    onAdd(group !== "__none__" ? group : undefined)
                  }
                >
                  Lägg till i gruppen
                </Button>
              </>
            ) : (
              <Button variant="secondary" onClick={clearFilters}>
                Visa alla leads
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="lead-result-summary">
            <span>
              {filtered.length.toLocaleString("sv-SE")}{" "}
              {filtered.length === 1 ? "lead" : "leads"}
              {filterChips.length ? ` av ${data.leads.length}` : ""}
            </span>
            {mobile && (
              <label className="flex">
                <input
                  type="checkbox"
                  aria-label="Välj alla på sidan"
                  checked={allChecked}
                  onChange={togglePage}
                />
                Välj sidan
              </label>
            )}
          </div>
          {mobile ? (
            <div className="lead-cards">
              {visible.map((l) => (
                <article
                  className={`lead-card ${selected.includes(l.id) ? "is-selected" : ""}`}
                  key={l.id}
                >
                  <div className="lead-card-heading">
                    <input
                      type="checkbox"
                      aria-label={`Välj ${l.companyName}`}
                      checked={selected.includes(l.id)}
                      onChange={() => toggleLead(l.id)}
                    />
                    <button
                      className="lead-card-company"
                      onClick={() => onOpen(l)}
                    >
                      <strong>{l.companyName}</strong>
                      {(l.city || l.industry) && (
                        <small>
                          {[l.industry, l.city].filter(Boolean).join(" · ")}
                        </small>
                      )}
                    </button>
                    <Button
                      size="icon"
                      variant="ghost"
                      aria-label={`Visa detaljer för ${l.companyName}`}
                      onClick={() => onOpen(l)}
                    >
                      <MoreHorizontal size={16} />
                    </Button>
                  </div>
                  <div className="lead-card-tags">
                    <StatusBadge status={l.status} />
                    <span
                      className="lead-source-tag"
                      title={sourceName(data, l)}
                    >
                      {sourceName(data, l)}
                    </span>
                    {l.groupId && (
                      <span className="lead-card-group">
                        <i
                          style={{
                            backgroundColor: data.groups.find(
                              (g) => g.id === l.groupId,
                            )?.color,
                          }}
                        />
                        {data.groups.find((g) => g.id === l.groupId)?.name}
                      </span>
                    )}
                  </div>
                  <div className="lead-card-meta">
                    {importDate(data, l) && (
                      <span>
                        <CalendarDays size={12} />
                        {formatImportDate(importDate(data, l))}
                      </span>
                    )}
                    {l.nextFollowUpAt && (
                      <span
                        className={
                          new Date(l.nextFollowUpAt).getTime() < now
                            ? "overdue"
                            : ""
                        }
                      >
                        Återkom {formatDate(l.nextFollowUpAt, true)}
                      </span>
                    )}
                  </div>
                  {extraColumns && (
                    <div className="lead-card-meta">
                      <span>{attempts.get(l.id) || 0} samtalsförsök</span>
                      <span>
                        Senaste kontakt {formatDate(l.lastContactedAt)}
                      </span>
                      {safeWebsite(l.website) && (
                        <a
                          href={safeWebsite(l.website)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Hemsida ↗
                        </a>
                      )}
                    </div>
                  )}
                  <div className="lead-card-actions">
                    {l.phone ? (
                      <a href={`tel:${l.phone}`}>{l.phone}</a>
                    ) : (
                      <span className="muted">Telefon saknas</span>
                    )}
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onCall(l.id)}
                      aria-label={`Starta samtal med ${l.companyName}`}
                    >
                      <Phone size={13} />
                      Ringpass
                    </Button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <>
              <div className="table-shell">
                <table>
                  <thead>
                    <tr>
                      <th>
                        <input
                          type="checkbox"
                          aria-label="Välj alla på sidan"
                          checked={allChecked}
                          onChange={() =>
                            setSelected(
                              allChecked
                                ? selected.filter(
                                    (i) => !visible.some((l) => l.id === i),
                                  )
                                : [
                                    ...new Set([
                                      ...selected,
                                      ...visible.map((l) => l.id),
                                    ]),
                                  ],
                            )
                          }
                        />
                      </th>
                      {(
                        [
                          ["companyName", "Företag"],
                          ["phone", "Telefon"],

                          ["status", "Status"],
                          ["source", "Källa"],
                          ["importedAt", "Importerad"],

                          ["nextFollowUpAt", "Uppföljning"],
                        ] as const
                      ).map(([key, label]) => (
                        <th key={key}>
                          <button onClick={() => changeSort(key)}>
                            {label}
                            {sort === key ? (
                              <ArrowDown
                                size={11}
                                style={{
                                  transform: ascending
                                    ? "rotate(180deg)"
                                    : undefined,
                                }}
                              />
                            ) : (
                              <ArrowUpDown size={10} />
                            )}
                          </button>
                        </th>
                      ))}
                      {extraColumns && (
                        <>
                          <th>Hemsida</th>
                          <th>Senaste kontakt</th>
                          <th>Försök</th>
                        </>
                      )}
                      <th>
                        <span className="sr-only">Åtgärder</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((l) => (
                      <tr key={l.id}>
                        <td>
                          <input
                            type="checkbox"
                            aria-label={`Välj ${l.companyName}`}
                            checked={selected.includes(l.id)}
                            onChange={() =>
                              setSelected(
                                selected.includes(l.id)
                                  ? selected.filter((s) => s !== l.id)
                                  : [...selected, l.id],
                              )
                            }
                          />
                        </td>
                        <td>
                          <button
                            className="company-cell"
                            title={l.companyName}
                            onClick={() => onOpen(l)}
                          >
                            <span className="company-avatar" aria-hidden="true">
                              {l.companyName
                                .split(" ")
                                .slice(0, 2)
                                .map((s) => s[0])
                                .join("")}
                            </span>
                            <span>
                              {l.companyName}
                              <small>
                                {[l.industry, l.city]
                                  .filter(Boolean)
                                  .join(" · ")}
                                {l.groupId && (
                                  <span className="lead-group-label">
                                    <i
                                      style={{
                                        backgroundColor: data.groups.find(
                                          (g) => g.id === l.groupId,
                                        )?.color,
                                      }}
                                    />
                                    {
                                      data.groups.find(
                                        (g) => g.id === l.groupId,
                                      )?.name
                                    }
                                  </span>
                                )}
                              </small>
                            </span>
                          </button>
                        </td>
                        <td>
                          {l.phone ? (
                            <a className="table-link" href={`tel:${l.phone}`}>
                              {l.phone}
                            </a>
                          ) : (
                            <span className="muted">Saknas</span>
                          )}
                        </td>
                        <td>
                          <StatusBadge status={l.status} />
                        </td>
                        <td>
                          <span
                            className="lead-source-tag"
                            title={sourceName(data, l)}
                          >
                            {sourceName(data, l)}
                          </span>
                        </td>
                        <td className="lead-import-date">
                          {importDate(data, l) ? (
                            <>
                              <span>
                                {formatImportDate(importDate(data, l))}
                              </span>
                              <small
                                title={
                                  data.batches.find(
                                    (b) => b.id === l.importBatchId,
                                  )?.filename
                                }
                              >
                                {
                                  data.batches.find(
                                    (b) => b.id === l.importBatchId,
                                  )?.filename
                                }
                              </small>
                            </>
                          ) : (
                            <span className="muted">Manuellt tillagd</span>
                          )}
                        </td>

                        <td
                          className={
                            l.nextFollowUpAt &&
                            new Date(l.nextFollowUpAt).getTime() < now
                              ? "overdue"
                              : "muted"
                          }
                        >
                          {formatDate(l.nextFollowUpAt, true)}
                        </td>
                        {extraColumns && (
                          <>
                            <td>
                              {safeWebsite(l.website) ? (
                                <a
                                  className="table-link flex"
                                  href={safeWebsite(l.website)}
                                  target="_blank"
                                  rel="noreferrer"
                                >
                                  Hemsida
                                  <ExternalLink size={10} />
                                </a>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td className="muted">
                              {formatDate(l.lastContactedAt)}
                            </td>
                            <td className="muted">{attempts.get(l.id) || 0}</td>
                          </>
                        )}
                        <td>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Starta samtal med ${l.companyName}`}
                            onClick={() => onCall(l.id)}
                          >
                            <Phone size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Visa detaljer för ${l.companyName}`}
                            onClick={() => onOpen(l)}
                          >
                            <MoreHorizontal size={16} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <div className="table-footer">
            <span>
              Visar {currentPage * 50 + 1}–
              {Math.min(filtered.length, currentPage * 50 + 50)} av{" "}
              {filtered.length.toLocaleString("sv-SE")} företag
            </span>
            <div className="flex">
              <Button
                variant="secondary"
                size="icon"
                aria-label="Föregående sida"
                disabled={currentPage === 0}
                onClick={() => setPage(currentPage - 1)}
              >
                <ArrowLeft size={13} />
              </Button>
              <span>
                {currentPage + 1} / {pageCount}
              </span>
              <Button
                variant="secondary"
                size="icon"
                aria-label="Nästa sida"
                disabled={currentPage >= pageCount - 1}
                onClick={() => setPage(currentPage + 1)}
              >
                <ArrowRight size={13} />
              </Button>
            </div>
          </div>
        </>
      )}
      {bulkAction && (
        <LeadBulkAction
          action={bulkAction}
          ids={selected}
          onClose={() => setBulkAction(null)}
          onDone={(text) => {
            setMessage(text);
            setBulkAction(null);
            setSelected([]);
          }}
        />
      )}
      {managingGroups && (
        <LeadGroups
          startCreating={creatingGroup}
          onSelect={(id) => changeScope(() => setGroup(id))}
          onRemoved={(id) => {
            if (group === id) changeScope(() => setGroup(""));
          }}
          onClose={() => setManagingGroups(false)}
        />
      )}
    </>
  );
}
