"use client";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Folder,
  Pencil,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { groupColors } from "@/lib/model";
import { saveGroup, removeGroup } from "@/lib/organization";
import { useStore } from "@/lib/store";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { GroupColorPicker } from "./group-color-picker";
export function LeadGroups({
  onClose,
  onSelect,
  onRemoved,
  startCreating = false,
}: {
  onClose: () => void;
  onSelect: (id: string) => void;
  onRemoved: (id: string) => void;
  startCreating?: boolean;
}) {
  const { data, mutate, error } = useStore();
  const [editing, setEditing] = useState<string | null>(
    startCreating ? "new" : null,
  );
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(groupColors[0]);
  const [search, setSearch] = useState("");
  const [validation, setValidation] = useState("");
  const [failed, setFailed] = useState(false);
  const [message, setMessage] = useState("");
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    data?.leads.forEach((l) => {
      if (l.groupId) map.set(l.groupId, (map.get(l.groupId) || 0) + 1);
    });
    return map;
  }, [data?.leads]);
  if (!data) return null;
  const groups = data.groups
    .filter((g) =>
      g.name.toLocaleLowerCase("sv").includes(search.toLocaleLowerCase("sv")),
    )
    .sort((a, b) => a.name.localeCompare(b.name, "sv"));
  function openEditor(id = "new") {
    const g = data!.groups.find((g) => g.id === id);
    setEditing(id);
    setName(g?.name || "");
    setColor(g?.color || groupColors[0]);
    setValidation("");
    setFailed(false);
    setMessage("");
  }
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={
        editing === "new"
          ? "Skapa en grupp"
          : editing
            ? "Redigera grupp"
            : "Dina grupper"
      }
      description={
        editing
          ? "Ge gruppen ett namn och en färg. Du kan lägga till leads efteråt."
          : "Dina ringlistor på ett ställe. Öppna en grupp eller redigera dess namn och färg."
      }
    >
      {editing ? (
        <form
          className="group-editor"
          onSubmit={(e) => {
            e.preventDefault();
            setValidation("");
            setFailed(false);
            try {
              saveGroup(
                data,
                name,
                color,
                editing === "new" ? undefined : editing,
              );
            } catch (e) {
              setValidation((e as Error).message);
              return;
            }
            if (
              mutate((d) =>
                saveGroup(
                  d,
                  name,
                  color,
                  editing === "new" ? undefined : editing,
                ),
              )
            ) {
              setEditing(null);
              setMessage(
                editing === "new"
                  ? `Gruppen ”${name.trim()}” är skapad. Öppna den för att lägga till eller importera leads.`
                  : "Gruppen är uppdaterad.",
              );
              setSearch("");
            } else setFailed(true);
          }}
        >
          <label className="form-field">
            Gruppnamn
            <input
              autoFocus
              className="input"
              value={name}
              required
              maxLength={80}
              placeholder="Till exempel Restauranger · Göteborg"
              onChange={(e) => {
                setName(e.target.value);
                setValidation("");
              }}
            />
          </label>
          <GroupColorPicker value={color} onChange={setColor} />
          {(validation || (failed && error)) && (
            <p className="error-box" role="alert">
              {validation || error}
            </p>
          )}
          <div className="dialog-actions">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setEditing(null);
                setValidation("");
              }}
            >
              <ArrowLeft size={14} />
              Tillbaka
            </Button>
            <Button type="submit" disabled={!name.trim()}>
              {editing === "new" ? "Skapa grupp" : "Spara grupp"}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <div className="group-manager-toolbar">
            <div className="search-field">
              <Search size={15} />
              <input
                className="input"
                aria-label="Sök grupper"
                placeholder="Hitta en grupp…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button onClick={() => openEditor()}>
              <Plus size={14} />
              Ny grupp
            </Button>
          </div>
          {message && (
            <p className="lead-success" role="status">
              {message}
            </p>
          )}
          {failed && error && (
            <p className="error-box" role="alert">
              {error}
            </p>
          )}
          <div className="group-manager-list">
            {groups.length ? (
              groups.map((g) => (
                <div className="group-list-row" key={g.id}>
                  <button
                    className="group-open"
                    onClick={() => {
                      onSelect(g.id);
                      onClose();
                    }}
                    aria-label={`Öppna gruppen ${g.name}`}
                  >
                    <span className="group-folder" style={{ color: g.color }}>
                      <Folder size={19} />
                    </span>
                    <span>
                      <strong>{g.name}</strong>
                      <small>{counts.get(g.id) || 0} leads</small>
                    </span>
                    <ArrowRight size={14} />
                  </button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Redigera gruppen ${g.name}`}
                    onClick={() => openEditor(g.id)}
                  >
                    <Pencil size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Ta bort gruppen ${g.name}`}
                    onClick={() => {
                      if (
                        !window.confirm(
                          `Ta bort gruppen ”${g.name}”? Dess ${counts.get(g.id) || 0} leads behålls och blir utan grupp.`,
                        )
                      )
                        return;
                      setFailed(false);
                      if (mutate((d) => removeGroup(d, g.id))) {
                        onRemoved(g.id);
                        setMessage("Gruppen är borttagen. Företagen är kvar.");
                      } else setFailed(true);
                    }}
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              ))
            ) : (
              <div className="group-empty">
                <Folder size={26} />
                <h3>
                  {search
                    ? "Ingen grupp matchar sökningen"
                    : "Ge nästa ringlista ett namn"}
                </h3>
                <p>
                  {search
                    ? "Prova ett annat namn."
                    : "Grupper samlar företag du vill arbeta med tillsammans. Börja med en ort, målgrupp eller kampanj."}
                </p>
                {!search && (
                  <Button variant="secondary" onClick={() => openEditor()}>
                    Skapa din första grupp
                  </Button>
                )}
              </div>
            )}
          </div>
          <p className="footnote">
            Ett lead kan tillhöra en grupp. Källan, till exempel Google Maps
            eller Instagram, sparas separat.
          </p>
        </>
      )}
    </Dialog>
  );
}
