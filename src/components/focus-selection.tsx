"use client";
import {
  CallingSession,
  Data,
  sessionScopeValid,
  sourceName,
  statuses,
} from "@/lib/model";
import { Layers3, SlidersHorizontal } from "lucide-react";
import {
  FocusSelectionValue,
  queueInfo,
  selectionSession,
} from "@/lib/focus-queue";
import { Button } from "./ui/button";

export function FocusSelection({
  data,
  value,
  onChange,
  session,
  now,
}: {
  data: Data;
  value: FocusSelectionValue;
  onChange: (value: FocusSelectionValue) => void;
  session?: CallingSession;
  now: number;
}) {
  const preview = selectionSession(value, session);
  const { ready, future, missingPhone } = queueInfo(
    data,
    preview,
    new Date(now),
  );
  const valid = sessionScopeValid(data, preview);
  const groups = [...data.groups].sort((a, b) =>
    a.name.localeCompare(b.name, "sv"),
  );
  const sources = [...new Set(data.leads.map((l) => sourceName(data, l)))].sort(
    (a, b) => a.localeCompare(b, "sv"),
  );
  const batchMissing =
    !!value.batch &&
    value.batch !== "all" &&
    !data.batches.some((b) => b.id === value.batch);
  const groupMissing =
    !!value.group &&
    value.group !== "__none__" &&
    !data.groups.some((g) => g.id === value.group);
  const adjustments =
    (value.batch && value.batch !== "all" ? 1 : 0) +
    (value.source ? 1 : 0) +
    (JSON.stringify([...value.included].sort()) !==
    JSON.stringify([...data.settings.defaultStatuses].sort())
      ? 1
      : 0);
  return (
    <div className="focus-selection">
      <label className="form-field">
        <span className="flex">
          <Layers3 size={15} />
          Vilken grupp vill du ringa?
        </span>
        <select
          aria-label="Välj grupp för ringpass"
          value={value.group}
          onChange={(e) =>
            onChange({ ...value, group: e.target.value, batch: "", source: "" })
          }
        >
          <option value="">Alla grupper · {data.leads.length} leads</option>
          <option value="__none__">
            Utan grupp · {data.leads.filter((l) => !l.groupId).length} leads
          </option>
          {groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} · {data.leads.filter((l) => l.groupId === g.id).length}{" "}
              leads
            </option>
          ))}
          {groupMissing && (
            <option value={value.group} disabled>
              Gruppen har tagits bort
            </option>
          )}
        </select>
      </label>
      <details className="focus-refine">
        <summary>
          <span className="flex">
            <SlidersHorizontal size={14} />
            Anpassa urval
            {adjustments > 0 && (
              <span className="focus-count">{adjustments}</span>
            )}
          </span>
        </summary>
        <div className="focus-refine-fields">
          <label className="form-field">
            Importlista
            <select
              aria-label="Välj ringlista"
              value={value.batch}
              onChange={(e) => onChange({ ...value, batch: e.target.value })}
            >
              <option value="">Alla importlistor och manuella leads</option>
              {data.batches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.filename}
                </option>
              ))}
              {batchMissing && (
                <option value={value.batch} disabled>
                  Importlistan har tagits bort
                </option>
              )}
            </select>
          </label>
          <label className="form-field">
            Källa
            <select
              aria-label="Välj källa för ringpass"
              value={value.source}
              onChange={(e) => onChange({ ...value, source: e.target.value })}
            >
              <option value="">Alla källor</option>
              {sources.map((s) => (
                <option key={s}>{s}</option>
              ))}
              {value.source && !sources.includes(value.source) && (
                <option>{value.source}</option>
              )}
            </select>
          </label>
        </div>
        <fieldset>
          <legend>Inkludera statusar</legend>
          <div className="checkboxes">
            {statuses.map((s) => (
              <label key={s}>
                <input
                  type="checkbox"
                  checked={value.included.includes(s)}
                  onChange={() =>
                    onChange({
                      ...value,
                      included: value.included.includes(s)
                        ? value.included.filter((v) => v !== s)
                        : [...value.included, s],
                    })
                  }
                />
                {s}
              </label>
            ))}
          </div>
        </fieldset>
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            onChange({
              ...value,
              batch: "",
              source: "",
              included: data.settings.defaultStatuses,
            })
          }
        >
          Återställ till standardurval
        </Button>
      </details>
      <div className="focus-queue-preview" role="status">
        <strong>
          {ready.length} {ready.length === 1 ? "lead" : "leads"} redo att ringa
        </strong>
        <span>
          {ready.length
            ? `Först: ${ready[0].companyName}`
            : "Inga ringbara leads i det här urvalet."}
        </span>
        {(future.length > 0 || missingPhone > 0) && (
          <small>
            {[
              future.length
                ? `${future.length} väntar på sin återringningstid`
                : "",
              missingPhone ? `${missingPhone} saknar telefonnummer` : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </small>
        )}
      </div>
      {!valid && (
        <div className="error-box">
          Det sparade urvalet har tagits bort. Välj en grupp eller importlista
          som finns kvar.
        </div>
      )}
      {!value.included.length && (
        <p className="error-box">Välj minst en status under Anpassa urval.</p>
      )}
      <p className="focus-selection-note">
        Försenade uppföljningar går först, sedan dagens återringningar och nya
        leads. Framtida återringningar väntar till sin tid. Leads utan
        telefonnummer hoppas över.
      </p>
    </div>
  );
}
