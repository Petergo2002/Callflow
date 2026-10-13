"use client";
import { useEffect, useRef, useState } from "react";
import {
  Lead,
  Status,
  outcomes,
  id,
  fromStockholm,
  stockholmInput,
  formatDate,
} from "@/lib/model";
import { logCall, undoCall, UndoCall } from "@/lib/engine";
import { useStore } from "@/lib/store";
import { Button } from "./ui/button";

export function IncomingCall({
  lead,
  onRecorded,
}: {
  lead: Lead;
  onRecorded: (status: Status) => void;
}) {
  const { mutate, error: storageError } = useStore();
  const [open, setOpen] = useState(false);
  const [outcome, setOutcome] = useState<Status>("Intresserad");
  const [notes, setNotes] = useState("");
  const [time, setTime] = useState("");
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");
  const [undo, setUndo] = useState<UndoCall>();
  const locked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <section className="inline-panel mt-4">
      <div className="flex between flex-wrap">
        <h3>Ringer företaget tillbaka?</h3>
        <Button size="sm" variant="secondary" onClick={() => setOpen(!open)}>
          Registrera inkommande samtal
        </Button>
      </div>
      {open && (
        <div className="mt-4">
          <p className="footnote">
            Resultatet sparas på det här företaget. Ditt ursprungliga ringpass
            och din plats i kön behålls.
          </p>
          <label className="form-field">
            Resultat av inkommande samtal
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as Status)}
            >
              {outcomes.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="form-field mt-3">
            Anteckning från inkommande samtal
            <textarea
              value={notes}
              maxLength={20000}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Vad pratade ni om?"
            />
          </label>
          {(outcome === "Återkom senare" || outcome === "Möte bokat") && (
            <label className="form-field mt-3">
              {outcome === "Återkom senare"
                ? "Återringning efter inkommande samtal"
                : "Mötestid efter inkommande samtal (valfri)"}
              <input
                className="input"
                type="datetime-local"
                value={time}
                min={stockholmInput(new Date().toISOString())}
                onChange={(e) => setTime(e.target.value)}
              />
            </label>
          )}
          <Button
            className="mt-3"
            disabled={!!undo}
            onClick={() => {
              if (locked.current) return;
              setError("");
              try {
                const at =
                  time &&
                  (outcome === "Återkom senare" || outcome === "Möte bokat")
                    ? fromStockholm(time)
                    : undefined;
                if (outcome === "Återkom senare" && !at)
                  throw new Error("Välj en återringningstid.");
                if (at && new Date(at).getTime() <= Date.now())
                  throw new Error("Välj en tid i framtiden.");
                locked.current = true;
                const eventId = id();
                let inverse: UndoCall | undefined;
                const ok = mutate((d) => {
                  const r = logCall(d, {
                    leadId: lead.id,
                    eventId,
                    outcome,
                    notes: notes || undefined,
                    direction: "incoming",
                    followUpAt: outcome === "Återkom senare" ? at : undefined,
                    meetingAt: outcome === "Möte bokat" ? at : undefined,
                  });
                  inverse = r.undo;
                  return r.data;
                });
                if (ok && inverse) {
                  setUndo(inverse);
                  onRecorded(outcome);
                  setOpen(false);
                  setNotes("");
                  setTime("");
                  setSaved(
                    `Inkommande samtal sparat · ${formatDate(new Date().toISOString(), true)}`,
                  );
                  clearTimeout(timer.current);
                  timer.current = setTimeout(() => {
                    setUndo(undefined);
                    locked.current = false;
                  }, 10000);
                } else {
                  locked.current = false;
                  setError(storageError || "Samtalet kunde inte sparas.");
                }
              } catch (e) {
                locked.current = false;
                setError((e as Error).message);
              }
            }}
          >
            Spara inkommande samtal
          </Button>
        </div>
      )}
      {saved && (
        <p className="footnote text-green" role="status">
          {saved}{" "}
          {undo && (
            <button
              className="table-link"
              onClick={() => {
                if (mutate((d) => undoCall(d, undo))) {
                  onRecorded(undo.previousLead.status);
                  setUndo(undefined);
                  setSaved("Samtalet ångrat.");
                  locked.current = false;
                  clearTimeout(timer.current);
                }
              }}
            >
              Ångra
            </button>
          )}
        </p>
      )}
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
    </section>
  );
}
