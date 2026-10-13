"use client";
import { useMemo, useState } from "react";
import { useStore } from "@/lib/store";
import { duplicateGroups, mergeLeads } from "@/lib/duplicates";
import { Data, formatDate } from "@/lib/model";
import { nextStepText } from "@/lib/lead-intelligence";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { StatusBadge } from "./shared";

export function DuplicateReview({ onClose }: { onClose: () => void }) {
  const { data, mutate, error: storageError } = useStore();
  const groups = useMemo(
    () => (data ? duplicateGroups(data.leads) : []),
    [data],
  );
  const [groupKey, setGroupKey] = useState("");
  const [primary, setPrimary] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [undo, setUndo] = useState<{ before: Data; after: Data }>();
  const leadMap = useMemo(
    () => new Map(data?.leads.map((l) => [l.id, l])),
    [data],
  );
  if (!data) return null;
  const group = groups.find((g) => g.key === groupKey);
  const leads = group
    ? data.leads.filter((l) => group.leadIds.includes(l.id))
    : [];
  const main = leads.find((l) => l.id === primary);
  const visible = groups.filter((g) =>
    g.leadIds.some((leadId) =>
      leadMap
        .get(leadId)
        ?.companyName.toLocaleLowerCase("sv")
        .includes(query.toLocaleLowerCase("sv")),
    ),
  );
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title="Granska dubbletter"
      description="Jämför först. Välj huvudposten vars namn, status och grupp ska behållas. Samtal, uppföljningar, anteckningar och alternativa nummer samlas på den posten."
      wide
    >
      {message && (
        <p className="text-green text-xs mb-4" role="status">
          {message}
        </p>
      )}
      {undo && (
        <Button
          size="sm"
          variant="secondary"
          className="mb-4"
          onClick={() => {
            let restored = false;
            if (
              mutate((d) => {
                if (d !== undo.after)
                  throw new Error(
                    "Arbetsrummet har ändrats efter sammanslagningen. Automatisk ångring skulle skriva över senare ändringar.",
                  );
                restored = true;
                return undo.before;
              }) &&
              restored
            ) {
              setUndo(undefined);
              setMessage(
                "Sammanslagningen ångrad. Båda företagen är tillbaka.",
              );
            } else
              setError(
                "Arbetsrummet har ändrats eller kunde inte sparas. Sammanslagningen har inte ångrats.",
              );
          }}
        >
          Ångra sammanslagning
        </Button>
      )}
      {!group ? (
        <>
          <label className="form-field mb-4">
            Sök bland möjliga dubbletter
            <input
              className="input"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <p className="footnote">
            {groups.length} möjliga dubblettgrupper. En gemensam webbplats eller
            ett företagsnamn kan också tillhöra olika företag.
          </p>
          <div className="max-h-96 overflow-auto">
            {visible.slice(0, 50).map((g) => (
              <button
                key={g.key}
                className="priority-row w-full"
                onClick={() => {
                  setGroupKey(g.key);
                  setSelected(g.leadIds);
                  setPrimary(g.leadIds[0]);
                  setError("");
                  setMessage("");
                }}
              >
                <div className="priority-text">
                  <strong>
                    {g.leadIds
                      .map((leadId) => leadMap.get(leadId)?.companyName)
                      .join(" · ")}
                  </strong>
                  <p>
                    {g.reason} · {g.leadIds.length} poster
                  </p>
                </div>
                <span className="table-link">Jämför</span>
              </button>
            ))}
            {!visible.length && (
              <p className="muted text-xs p-4">
                Inga möjliga dubbletter hittades.
              </p>
            )}
            {visible.length > 50 && (
              <p className="footnote">
                Visar de första 50 grupperna. Sök på företagsnamn för att
                begränsa listan.
              </p>
            )}
          </div>
        </>
      ) : (
        <>
          <Button size="sm" variant="ghost" onClick={() => setGroupKey("")}>
            Tillbaka till alla dubbletter
          </Button>
          <p className="footnote">
            {group.reason}. Välj vilka poster som ska slås ihop och vilken som
            ska vara huvudpost.
          </p>
          <div className="duplicate-cards">
            {leads.map((l) => (
              <article className="inline-panel" key={l.id}>
                <label className="flex text-xs">
                  <input
                    type="checkbox"
                    aria-label={`Ta med ${l.companyName}`}
                    checked={selected.includes(l.id)}
                    disabled={primary === l.id}
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, l.id]
                          : selected.filter((leadId) => leadId !== l.id),
                      )
                    }
                  />{" "}
                  Ta med i sammanslagningen
                </label>
                <label className="flex mt-3">
                  <input
                    type="radio"
                    name="primary-lead"
                    aria-label={`Behåll ${l.companyName} som huvudpost`}
                    checked={primary === l.id}
                    onChange={() => {
                      setPrimary(l.id);
                      setSelected([...new Set([...selected, l.id])]);
                    }}
                  />
                  <strong>{l.companyName}</strong>
                </label>
                <div className="mt-3">
                  <StatusBadge status={l.status} />
                </div>
                <p className="footnote">
                  {l.phone || "Telefon saknas"} ·{" "}
                  {l.website || "Hemsida saknas"}
                </p>
                <p className="footnote">
                  {l.contactName} · {l.city} ·{" "}
                  {data.groups.find((g) => g.id === l.groupId)?.name ||
                    "Utan grupp"}
                </p>
                <p className="footnote">
                  {data.calls.filter((c) => c.leadId === l.id).length} samtal ·{" "}
                  {
                    data.followUps.filter(
                      (f) => f.leadId === l.id && f.status === "pending",
                    ).length
                  }{" "}
                  väntande uppföljningar
                </p>
                <p className="footnote">
                  Senaste kontakt: {formatDate(l.lastContactedAt, true)} ·{" "}
                  {nextStepText(l)}
                </p>
                <p className="text-xs whitespace-pre-wrap">
                  {l.notes || "Inga anteckningar"}
                </p>
              </article>
            ))}
          </div>
          {main && (
            <p className="footnote">
              Efter sammanslagning: <strong>{main.companyName}</strong> ·{" "}
              {main.status}. {selected.length} poster blir en. Alla samtal och
              uppföljningar behålls; övriga kontaktuppgifter och anteckningar
              samlas på huvudposten.
            </p>
          )}
          <Button
            disabled={selected.length < 2 || !selected.includes(primary)}
            onClick={() => {
              setError("");
              try {
                const secondaries = selected.filter(
                  (leadId) => leadId !== primary,
                );
                let previous: Data | undefined;
                let merged: Data | undefined;
                if (
                  mutate((d) => {
                    previous = d;
                    merged = mergeLeads(d, primary, secondaries);
                    return merged;
                  })
                ) {
                  if (previous && merged)
                    setUndo({ before: previous, after: merged });
                  setMessage(
                    `Sammanslaget till ${main?.companyName}. Historiken är kvar.`,
                  );
                  setGroupKey("");
                } else
                  setError(
                    storageError || "Sammanslagningen kunde inte sparas.",
                  );
              } catch (e) {
                setError((e as Error).message);
              }
            }}
          >
            Slå ihop valda företag
          </Button>
        </>
      )}
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      <div className="dialog-footer">
        <Button variant="secondary" onClick={onClose}>
          Stäng
        </Button>
      </div>
    </Dialog>
  );
}
