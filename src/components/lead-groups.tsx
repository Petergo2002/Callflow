"use client";
import { useState } from "react";
import { FolderPlus, Save, Trash2 } from "lucide-react";
import { LeadGroup, groupColors } from "@/lib/model";
import { saveGroup, removeGroup } from "@/lib/organization";
import { useStore } from "@/lib/store";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
function GroupRow({ group, count }: { group: LeadGroup; count: number }) {
  const { mutate } = useStore();
  const [name, setName] = useState(group.name);
  const [color, setColor] = useState(group.color);
  return (
    <div className="group-manager-row">
      <label className="sr-only" htmlFor={`group-${group.id}`}>
        Namn på {group.name}
      </label>
      <input
        id={`group-${group.id}`}
        className="input"
        value={name}
        maxLength={80}
        onChange={(e) => setName(e.target.value)}
      />
      <select
        aria-label={`Färg på ${group.name}`}
        value={color}
        onChange={(e) => setColor(e.target.value)}
      >
        {groupColors.map((c, i) => (
          <option value={c} key={c}>
            Färg {i + 1}
          </option>
        ))}
      </select>
      <span className="group-count" style={{ color }}>
        {count} leads
      </span>
      <Button
        size="icon"
        variant="ghost"
        aria-label={`Spara gruppen ${group.name}`}
        onClick={() => mutate((d) => saveGroup(d, name, color, group.id))}
      >
        <Save size={15} />
      </Button>
      <Button
        size="icon"
        variant="ghost"
        aria-label={`Ta bort gruppen ${group.name}`}
        onClick={() => {
          if (
            window.confirm(
              `Ta bort gruppen ”${group.name}”? Dess ${count} leads behålls och blir utan grupp.`,
            )
          )
            mutate((d) => removeGroup(d, group.id));
        }}
      >
        <Trash2 size={15} />
      </Button>
    </div>
  );
}
export function LeadGroups({ onClose }: { onClose: () => void }) {
  const { data, mutate, error } = useStore();
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(groupColors[0]);
  if (!data) return null;
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title="Dina grupper"
      description="Samla företag som hör ihop. Källan beskriver var du hittade dem; gruppen hjälper dig planera nästa ringlista."
    >
      <form
        className="group-create-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (mutate((d) => saveGroup(d, name, color))) setName("");
        }}
      >
        <label className="form-field">
          Gruppnamn
          <input
            className="input"
            value={name}
            maxLength={80}
            required
            placeholder="Till exempel Göteborg · restauranger"
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <fieldset className="group-color-picker">
          <legend>Färg</legend>
          {groupColors.map((c, i) => (
            <label key={c} style={{ backgroundColor: c }}>
              <input
                type="radio"
                name="group-color"
                aria-label={`Gruppfärg ${i + 1}`}
                checked={color === c}
                onChange={() => setColor(c)}
              />
              <span aria-hidden>{color === c ? "✓" : ""}</span>
            </label>
          ))}
        </fieldset>
        <Button type="submit">
          <FolderPlus size={14} />
          Skapa grupp
        </Button>
      </form>
      {error && (
        <p role="alert" className="error-box">
          {error}
        </p>
      )}
      <div className="group-manager-list">
        {data.groups.length ? (
          data.groups.map((g) => (
            <GroupRow
              key={g.id}
              group={g}
              count={data.leads.filter((l) => l.groupId === g.id).length}
            />
          ))
        ) : (
          <p className="footnote">
            Här visas dina grupper. Börja med ett namn ovan.
          </p>
        )}
      </div>
      <p className="footnote">
        Varje lead kan tillhöra en grupp. Du kan flytta leads när som helst. Att
        ta bort en grupp raderar inga företag.
      </p>
    </Dialog>
  );
}
