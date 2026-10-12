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
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useStore } from "@/lib/store";
import { Lead, Status, formatDate, safeWebsite, statuses } from "@/lib/model";
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
            [l.companyName, l.phone, l.city, l.contactName, l.industry].some(
              (v) => v.toLowerCase().includes(deferred.toLowerCase()),
            ),
        )
        .sort(
          (a, b) =>
            String(a[sort] ?? "").localeCompare(String(b[sort] ?? ""), "sv", {
              numeric: true,
            }) * (ascending ? 1 : -1),
        ) || [],
    [data?.leads, status, industry, batch, deferred, sort, ascending],
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
          <option value="">Alla listor</option>
          {data.batches.map((b) => (
            <option value={b.id} key={b.id}>
              {b.filename}
            </option>
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
                            {l.demo ? " · Demo" : ""}
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
    </>
  );
}
