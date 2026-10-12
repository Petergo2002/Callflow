"use client";
import { useDeferredValue, useEffect, useMemo, useState } from "react";
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
  FolderPlus,
  Folder,
  CalendarDays,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import {
  Lead,
  Status,
  formatDate,
  formatImportDate,
  safeWebsite,
  statuses,
  importDate,
  sourceName,
  dateKey,
  leadSources,
} from "@/lib/model";
import { organizeLeads, removeImport } from "@/lib/organization";
import { LeadGroups } from "./lead-groups";
import { deleteLeads } from "@/lib/engine";
import { download, exportCSV } from "@/lib/import";
import { Button } from "./ui/button";
import { Empty, StatusBadge } from "./shared";
export function Leads({
  onOpen,
  onAdd,
  onImport,
  onCall,
}: {
  onOpen: (l: Lead) => void;
  onAdd: () => void;
  onImport: () => void;
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
  const [group, setGroup] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [managingGroups, setManagingGroups] = useState(false);
  const [bulkGroup, setBulkGroup] = useState("");
  const [bulkSource, setBulkSource] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [sort, setSort] = useState<keyof Lead>("createdAt");
  const [ascending, setAscending] = useState(false);
  const [page, setPage] = useState(0);
  const [bulkStatus, setBulkStatus] = useState<Status>("Intresserad");
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
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Dina leads</h1>
          <p>
            {data.leads.length.toLocaleString("sv-SE")} företag. Nästa affär
            finns någonstans här.
          </p>
        </div>
        <div className="flex">
          <Button variant="secondary" onClick={() => setManagingGroups(true)}>
            <FolderPlus size={14} />
            Hantera grupper
          </Button>
          <Button variant="secondary" onClick={onImport}>
            <Upload size={14} />
            Importera
          </Button>
          <Button onClick={onAdd}>
            <Plus size={14} />
            Lägg till företag
          </Button>
        </div>
      </div>
      <div className="lead-group-strip" aria-label="Filtrera grupper">
        <button
          className={`lead-group-chip ${!group ? "active" : ""}`}
          onClick={() => {
            setGroup("");
            setPage(0);
          }}
        >
          <Folder size={14} />
          Alla leads<span>{data.leads.length}</span>
        </button>
        {data.groups.map((g) => (
          <button
            key={g.id}
            className={`lead-group-chip ${group === g.id ? "active" : ""}`}
            onClick={() => {
              setGroup(g.id);
              setPage(0);
            }}
          >
            <i style={{ backgroundColor: g.color }} />
            {g.name}
            <span>{data.leads.filter((l) => l.groupId === g.id).length}</span>
          </button>
        ))}
        <button
          className={`lead-group-chip ${group === "__none__" ? "active" : ""}`}
          onClick={() => {
            setGroup("__none__");
            setPage(0);
          }}
        >
          Utan grupp<span>{data.leads.filter((l) => !l.groupId).length}</span>
        </button>
        <button
          className="lead-group-chip new-group"
          onClick={() => setManagingGroups(true)}
        >
          <Plus size={14} />
          Ny grupp
        </button>
      </div>
      <div className="toolbar">
        <div className="search-field">
          <Search size={15} />
          <input
            className="input"
            aria-label="Sök företag"
            placeholder="Sök företag, telefon eller ort…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(0);
            }}
          />
        </div>
        <select
          aria-label="Filtrera status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
        >
          <option value="">Alla statusar</option>
          {statuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select
          aria-label="Filtrera bransch"
          value={industry}
          onChange={(e) => {
            setIndustry(e.target.value);
            setPage(0);
          }}
        >
          <option value="">Alla branscher</option>
          {[...new Set(data.leads.map((l) => l.industry).filter(Boolean))]
            .sort()
            .map((s) => (
              <option key={s}>{s}</option>
            ))}
        </select>
        <select
          aria-label="Filtrera import"
          value={batch}
          onChange={(e) => {
            setBatch(e.target.value);
            setPage(0);
          }}
        >
          <option value="">Alla importer</option>
          {data.batches.map((b) => (
            <option value={b.id} key={b.id}>
              {b.filename} · {formatImportDate(b.importedAt)}
            </option>
          ))}
        </select>
        <select
          aria-label="Filtrera källa"
          value={source}
          onChange={(e) => {
            setSource(e.target.value);
            setPage(0);
          }}
        >
          <option value="">Alla källor</option>
          {[...new Set(data.leads.map((l) => sourceName(data, l)))]
            .sort((a, b) => a.localeCompare(b, "sv"))
            .map((s) => (
              <option key={s}>{s}</option>
            ))}
        </select>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Exportera CSV"
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
      <div className="lead-date-toolbar">
        <div className="flex">
          <CalendarDays size={14} />
          <span>Importdatum</span>
        </div>
        <label>
          Från
          <input
            className="input"
            aria-label="Importerad från datum"
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => {
              setFromDate(e.target.value);
              setPage(0);
            }}
          />
        </label>
        <label>
          Till
          <input
            className="input"
            aria-label="Importerad till datum"
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => {
              setToDate(e.target.value);
              setPage(0);
            }}
          />
        </label>
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
          {!["createdAt", "importedAt", "companyName", "source"].includes(
            sort,
          ) && (
            <option value={`${sort}:${ascending ? "asc" : "desc"}`}>
              Vald tabellkolumn
            </option>
          )}
        </select>
        {(query ||
          status ||
          industry ||
          batch ||
          source ||
          group ||
          fromDate ||
          toDate) && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setQuery("");
              setStatus("");
              setIndustry("");
              setBatch("");
              setSource("");
              setGroup("");
              setFromDate("");
              setToDate("");
              setPage(0);
            }}
          >
            Rensa filter
          </Button>
        )}
      </div>
      {batch && (
        <div className="import-list-summary">
          <div>
            <strong>
              {data.batches.find((b) => b.id === batch)?.filename}
            </strong>
            <span>
              Importerad{" "}
              {formatImportDate(
                data.batches.find((b) => b.id === batch)?.importedAt,
                true,
              )}{" "}
              · {data.leads.filter((l) => l.importBatchId === batch).length}{" "}
              leads i importen
            </span>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="danger-text"
            onClick={() => {
              const count = data.leads.filter(
                (l) => l.importBatchId === batch,
              ).length;
              if (
                window.confirm(
                  `Ta bort hela importen och dess ${count} leads, samtal, uppföljningar och XP? Detta omfattar alla leads i importen, även de som döljs av andra filter. Det går inte att ångra utan en säkerhetskopia.`,
                ) &&
                mutate((d) => removeImport(d, batch))
              ) {
                setBatch("");
                setSelected([]);
              }
            }}
          >
            <Trash2 size={14} />
            Ta bort import
          </Button>
        </div>
      )}
      {selected.length > 0 && (
        <div className="bulk-bar">
          <strong className="text-xs">{selected.length} valda</strong>
          <select
            aria-label="Ny status för valda leads"
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as Status)}
          >
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              if (
                mutate((d) => ({
                  ...d,
                  leads: d.leads.map((l) =>
                    selected.includes(l.id)
                      ? {
                          ...l,
                          status: bulkStatus,
                          updatedAt: new Date().toISOString(),
                        }
                      : l,
                  ),
                }))
              )
                setSelected([]);
            }}
          >
            Ändra status
          </Button>
          <select
            aria-label="Grupp för valda leads"
            value={bulkGroup}
            onChange={(e) => setBulkGroup(e.target.value)}
          >
            <option value="">Behåll grupp</option>
            <option value="__none__">Utan grupp</option>
            {data.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <input
            className="input bulk-source"
            aria-label="Källa för valda leads"
            list="bulk-source-options"
            maxLength={100}
            value={bulkSource}
            onChange={(e) => setBulkSource(e.target.value)}
            placeholder="Ny källa…"
          />
          <datalist id="bulk-source-options">
            {[
              ...new Set([
                ...leadSources,
                ...data.leads.map((l) => sourceName(data, l)),
              ]),
            ].map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <Button
            size="sm"
            variant="secondary"
            disabled={!bulkGroup && !bulkSource.trim()}
            onClick={() => {
              if (
                mutate((d) =>
                  organizeLeads(d, selected, {
                    ...(bulkGroup
                      ? { groupId: bulkGroup === "__none__" ? "" : bulkGroup }
                      : {}),
                    ...(bulkSource.trim() ? { source: bulkSource.trim() } : {}),
                  }),
                )
              ) {
                setSelected([]);
                setBulkGroup("");
                setBulkSource("");
              }
            }}
          >
            Spara gruppering
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setSelected([
                ...new Set([...selected, ...filtered.map((l) => l.id)]),
              ])
            }
          >
            Välj alla {filtered.length} träffar
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (
                window.confirm(
                  `Ta bort ${selected.length} företag och deras historik? Det går inte att ångra.`,
                )
              ) {
                if (mutate((d) => deleteLeads(d, selected))) setSelected([]);
              }
            }}
          >
            <Trash2 size={13} />
            Ta bort
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setSelected([])}>
            Avmarkera
          </Button>
        </div>
      )}
      {data.leads.length === 0 ? (
        <div className="panel">
          <Empty onAdd={onAdd} onImport={onImport} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="panel">
          <Empty
            title="Ingen träff just nu."
            description="Prova en annan sökning eller rensa filtren."
          />
          <div className="flex justify-center pb-6">
            <Button
              variant="secondary"
              onClick={() => {
                setQuery("");
                setStatus("");
                setIndustry("");
                setBatch("");
                setSource("");
                setGroup("");
                setFromDate("");
                setToDate("");
              }}
            >
              Rensa filter
            </Button>
          </div>
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
                      ["website", "Hemsida"],
                      ["status", "Status"],
                      ["source", "Källa"],
                      ["importedAt", "Importerad"],
                      ["lastContactedAt", "Senaste kontakt"],
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
                  <th>Försök</th>
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
                            {l.industry || "Ingen bransch"} ·{" "}
                            {l.city || "Ingen ort"}
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
                                  data.groups.find((g) => g.id === l.groupId)
                                    ?.name
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
                    <td>
                      <StatusBadge status={l.status} />
                    </td>
                    <td>
                      <span className="lead-source-tag">
                        {sourceName(data, l)}
                      </span>
                    </td>
                    <td className="lead-import-date">
                      {importDate(data, l) ? (
                        <>
                          <span>{formatImportDate(importDate(data, l))}</span>
                          <small
                            title={
                              data.batches.find((b) => b.id === l.importBatchId)
                                ?.filename
                            }
                          >
                            {
                              data.batches.find((b) => b.id === l.importBatchId)
                                ?.filename
                            }
                          </small>
                        </>
                      ) : (
                        <span className="muted">Manuellt tillagd</span>
                      )}
                    </td>
                    <td className="muted">{formatDate(l.lastContactedAt)}</td>
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
                    <td className="muted">{attempts.get(l.id) || 0}</td>
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
                        aria-label={`Ta bort ${l.companyName}`}
                        onClick={() => {
                          if (
                            window.confirm(
                              `Ta bort ”${l.companyName}” och dess samtal, uppföljningar och XP? Det går inte att ångra.`,
                            ) &&
                            mutate((d) => deleteLeads(d, [l.id]))
                          )
                            setSelected(selected.filter((id) => id !== l.id));
                        }}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
      {managingGroups && (
        <LeadGroups onClose={() => setManagingGroups(false)} />
      )}
    </>
  );
}
