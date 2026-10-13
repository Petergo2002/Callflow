"use client";
import { useState } from "react";
import {
  Lead,
  NextStep,
  fromStockholm,
  stockholmInput,
  nextStepLabels,
  formatDate,
} from "@/lib/model";
import { nextStepText, suggestRetry } from "@/lib/lead-intelligence";
import { completeNextStep, setNextStep } from "@/lib/engine";
import { useStore } from "@/lib/store";
import { Button } from "./ui/button";

export function NextStepPanel({ lead }: { lead: Lead }) {
  const { data, mutate, error: storageError } = useStore();
  const [kind, setKind] = useState<NextStep["kind"]>(
    lead.nextStep?.kind || "call",
  );
  const [time, setTime] = useState(() => {
    const current =
      lead.nextStep?.dueAt || lead.nextFollowUpAt || lead.nextRetryAt;
    return current && new Date(current).getTime() > Date.now()
      ? stockholmInput(current)
      : "";
  });
  const [note, setNote] = useState(
    lead.nextStep?.note || lead.notes.slice(0, 2000),
  );
  const [error, setError] = useState("");
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  if (!data) return null;
  const closed = ["Kund", "Inte intresserad"].includes(lead.status);
  return (
    <section className="inline-panel mt-4">
      <h3>Nästa steg</h3>
      <p className="footnote" role="status">
        {lead.nextFollowUpAt
          ? `Planerad: ${formatDate(lead.nextFollowUpAt, true)}`
          : nextStepText(lead)}
      </p>
      {lead.nextStep?.note && (
        <p className="text-xs whitespace-pre-wrap">{lead.nextStep.note}</p>
      )}
      {closed ? (
        <p className="footnote">
          Leadet är avslutat. Ändra status för att planera en ny kontakt.
        </p>
      ) : (
        <>
          <div className="form-grid">
            <label className="form-field">
              Vad ska hända?
              <select
                value={kind}
                onChange={(e) => {
                  setKind(e.target.value as NextStep["kind"]);
                  setSaved(false);
                }}
              >
                {Object.entries(nextStepLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="form-field">
              {kind === "call"
                ? "Uppföljningstid · svensk tid"
                : kind === "wait"
                  ? "Kontrollera svar · svensk tid"
                  : "Offert klar senast · svensk tid"}
              <input
                className="input"
                type="datetime-local"
                value={time}
                min={stockholmInput(new Date().toISOString())}
                onChange={(e) => {
                  setTime(e.target.value);
                  setSaved(false);
                }}
              />
            </label>
            <label className="form-field full">
              Kort beskrivning av nästa steg
              <input
                className="input"
                value={note}
                maxLength={2000}
                placeholder="Till exempel skicka prisförslag till Anna"
                onChange={(e) => {
                  setNote(e.target.value);
                  setSaved(false);
                }}
              />
            </label>
          </div>
          <div className="flex mt-3 flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                setTime(stockholmInput(suggestRetry(data, lead.id)))
              }
            >
              Föreslå tid
            </Button>
            <Button
              size="sm"
              disabled={!time}
              onClick={() => {
                setError("");
                setFailed(false);
                try {
                  if (
                    mutate((d) =>
                      setNextStep(d, lead.id, {
                        kind,
                        dueAt: fromStockholm(time),
                        note,
                      }),
                    )
                  ) {
                    setSaved(true);
                    setTime("");
                  } else setFailed(true);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              {kind === "call"
                ? lead.nextFollowUpAt
                  ? "Boka om uppföljning"
                  : "Boka uppföljning"
                : "Spara nästa steg"}
            </Button>
            {lead.nextStep && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFailed(!mutate((d) => completeNextStep(d, lead.id)));
                  setSaved(false);
                }}
              >
                Markera nästa steg klart
              </Button>
            )}
          </div>
          {lead.nextFollowUpAt && kind !== "call" && (
            <p className="footnote">
              Det nya steget ersätter den bokade återringningen. Historiken
              behålls.
            </p>
          )}
        </>
      )}
      {saved && (
        <p className="footnote text-green" role="status">
          Nästa steg sparat.
        </p>
      )}
      {(error || failed) && (
        <div className="error-box" role="alert">
          {error || storageError || "Ändringen kunde inte sparas."}
        </div>
      )}
    </section>
  );
}
