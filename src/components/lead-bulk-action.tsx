"use client";
import { useState } from "react";
import {
  Data,
  groupColors,
  leadSources,
  sourceName,
  Status,
  statuses,
} from "@/lib/model";
import { organizeLeads, saveGroup } from "@/lib/organization";
import { useStore } from "@/lib/store";
import { Dialog } from "./ui/dialog";
import { Button } from "./ui/button";
import { GroupColorPicker } from "./group-color-picker";
export type BulkAction = "status" | "group" | "source";
export function LeadBulkAction({
  action,
  ids,
  onClose,
  onDone,
}: {
  action: BulkAction;
  ids: string[];
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const { data, mutate, error } = useStore();
  const [value, setValue] = useState("");
  const [newName, setNewName] = useState("");
  const [color, setColor] = useState<string>(groupColors[0]);
  const [validation, setValidation] = useState("");
  const [failed, setFailed] = useState(false);
  const [sourceTouched, setSourceTouched] = useState(false);
  if (!data) return null;
  const count = data.leads.filter((l) => ids.includes(l.id)).length;
  const title =
    action === "status"
      ? "Ändra status"
      : action === "group"
        ? "Flytta till grupp"
        : "Ändra källa";
  function transform(d: Data) {
    if (action === "status")
      return {
        ...d,
        leads: d.leads.map((l) =>
          ids.includes(l.id)
            ? {
                ...l,
                status: value as Status,
                updatedAt: new Date().toISOString(),
              }
            : l,
        ),
      };
    if (action === "group") {
      if (value === "__new__") {
        const next = saveGroup(d, newName, color);
        return organizeLeads(next, ids, {
          groupId: next.groups[next.groups.length - 1].id,
        });
      }
      return organizeLeads(d, ids, {
        groupId: value === "__none__" ? "" : value,
      });
    }
    return organizeLeads(d, ids, { source: value.trim() });
  }
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={title}
      description={`Ändringen gäller ${count} markerade leads. Övriga uppgifter och historiken behålls.`}
    >
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          setValidation("");
          setFailed(false);
          try {
            transform(data);
          } catch (e) {
            setValidation((e as Error).message);
            return;
          }
          if (mutate(transform)) {
            onDone(
              action === "group"
                ? `${count} leads ${value === "__none__" ? "är nu utan grupp" : "har flyttats till gruppen"}.`
                : `${count} leads har fått ${action === "status" ? "ny status" : "uppdaterad källa"}.`,
            );
          } else setFailed(true);
        }}
      >
        {action === "status" && (
          <label className="form-field">
            Ny status för valda leads
            <select value={value} onChange={(e) => setValue(e.target.value)}>
              <option value="" disabled>
                Välj status…
              </option>
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        )}
        {action === "source" && (
          <>
            <label className="form-field">
              Källa för valda leads
              <input
                autoFocus
                className="input"
                list="bulk-source-options"
                maxLength={100}
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setSourceTouched(true);
                }}
                placeholder="Google Maps, Instagram eller egen källa…"
              />
            </label>
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
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setValue("");
                setSourceTouched(true);
              }}
            >
              Återgå till importens källa
            </Button>
            <p className="footnote">
              Lämna tomt för att ta bort den valda källan och använda importens
              ursprungliga källa.
            </p>
          </>
        )}
        {action === "group" && (
          <>
            <label className="form-field">
              Grupp för valda leads
              <select
                autoFocus
                value={value}
                onChange={(e) => {
                  setValue(e.target.value);
                  setValidation("");
                }}
              >
                <option value="" disabled>
                  Välj en grupp…
                </option>
                <option value="__none__">Utan grupp</option>
                {data.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
                <option value="__new__">＋ Skapa en ny grupp</option>
              </select>
            </label>
            {value === "__new__" && (
              <>
                <label className="form-field">
                  Namn på ny grupp
                  <input
                    className="input"
                    required
                    maxLength={80}
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Till exempel Nästa veckas ringlista"
                  />
                </label>
                <GroupColorPicker value={color} onChange={setColor} />
                <p className="footnote">
                  Gruppen skapas och de markerade företagen läggs till
                  samtidigt.
                </p>
              </>
            )}
          </>
        )}
        {(validation || (failed && error)) && (
          <p className="error-box" role="alert">
            {validation || error}
          </p>
        )}
        <div className="dialog-actions">
          <Button variant="ghost" type="button" onClick={onClose}>
            Avbryt
          </Button>
          <Button
            type="submit"
            disabled={
              !count ||
              (action === "status" && !value) ||
              (action === "source" && !sourceTouched) ||
              (action === "group" &&
                (!value || (value === "__new__" && !newName.trim())))
            }
          >
            {action === "group" ? "Flytta leads" : "Spara ändring"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
