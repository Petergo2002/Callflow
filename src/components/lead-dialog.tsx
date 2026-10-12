"use client";
import { useState } from "react";
import { ExternalLink, Phone, Trash2 } from "lucide-react";
import {
  Lead,
  LeadInput,
  Status,
  formatDate,
  leadInput,
  safeWebsite,
  statuses,
} from "@/lib/model";
import { useStore } from "@/lib/store";
import { deleteLeads, updateLead } from "@/lib/engine";
import { makeLead } from "@/lib/model";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { StatusBadge } from "./shared";

const blank: LeadInput = {
  companyName: "",
  phone: "",
  website: "",
  industry: "",
  city: "",
  contactName: "",
  notes: "",
  status: "Ej kontaktad",
};
export function LeadDialog({
  lead,
  onClose,
  onCall,
}: {
  lead: Lead | "new";
  onClose: () => void;
  onCall: (id: string) => void;
}) {
  const { data, mutate } = useStore();
  const [form, setForm] = useState<LeadInput>(lead === "new" ? blank : lead);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const editing = lead !== "new";
  if (!data) return null;
  const calls = editing
    ? data.calls
        .filter((c) => c.leadId === lead.id)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    : [];
  const fields: [keyof LeadInput, string][] = [
    ["companyName", "Företagsnamn *"],
    ["phone", "Telefon"],
    ["website", "Hemsida"],
    ["industry", "Bransch"],
    ["city", "Ort"],
    ["contactName", "Kontaktperson"],
  ];
  function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = leadInput.safeParse(form);
    if (!parsed.success) {
      setError(parsed.error.issues.map((i) => i.message).join(". "));
      return;
    }
    const ok = mutate((d) =>
      editing
        ? updateLead(d, lead.id, parsed.data)
        : { ...d, leads: [...d.leads, makeLead(parsed.data)] },
    );
    if (ok) {
      setSaved(true);
      setError("");
      if (!editing) onClose();
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title={editing ? lead.companyName : "Lägg till företag"}
      description={
        editing
          ? "Kontaktuppgifter, anteckningar och hela samtalshistoriken."
          : "Börja med ett namn. Resten kan du fylla i senare."
      }
    >
      {editing && (
        <div className="detail-meta">
          {lead.phone && (
            <a className="flex" href={`tel:${lead.phone}`}>
              <Phone size={13} />
              {lead.phone}
            </a>
          )}
          {lead.website && (
            <a
              className="flex"
              href={safeWebsite(lead.website)}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={13} />
              Besök hemsida
            </a>
          )}
          <span>{calls.length} samtalsförsök</span>
          {lead.demo && <span>Demoföretag</span>}
        </div>
      )}
      <form onSubmit={save}>
        <div className="form-grid">
          {fields.map(([field, label]) => (
            <label
              key={field}
              className={`form-field ${field === "companyName" ? "full" : ""}`}
            >
              {label}
              <input
                className="input"
                value={form[field]}
                required={field === "companyName"}
                maxLength={
                  field === "website" ? 1000 : field === "phone" ? 100 : 300
                }
                type={field === "phone" ? "tel" : "text"}
                placeholder={
                  field === "phone"
                    ? "031-123 45 67 eller +46…"
                    : field === "website"
                      ? "foretag.se"
                      : ""
                }
                onChange={(e) => {
                  setForm({ ...form, [field]: e.target.value });
                  setSaved(false);
                }}
              />
            </label>
          ))}
          <label className="form-field full">
            Status
            <select
              value={form.status}
              onChange={(e) => {
                setForm({ ...form, status: e.target.value as Status });
                setSaved(false);
              }}
            >
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label className="form-field full">
            Anteckningar
            <textarea
              value={form.notes}
              maxLength={20000}
              onChange={(e) => {
                setForm({ ...form, notes: e.target.value });
                setSaved(false);
              }}
              placeholder="Vad är bra att veta inför nästa samtal?"
            />
          </label>
        </div>
        {error && (
          <div role="alert" className="error-box">
            {error}
          </div>
        )}
        <div className="dialog-footer">
          {editing && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Ta bort företag"
              onClick={() => {
                if (
                  window.confirm(
                    `Ta bort ${lead.companyName} och dess samtal, uppföljningar och XP?`,
                  )
                ) {
                  if (mutate((d) => deleteLeads(d, [lead.id]))) onClose();
                }
              }}
            >
              <Trash2 size={16} />
            </Button>
          )}
          <Button variant="secondary" type="button" onClick={onClose}>
            Stäng
          </Button>
          <Button type="submit">
            {saved
              ? "Sparat"
              : editing
                ? "Spara ändringar"
                : "Lägg till företag"}
          </Button>
          {editing && (
            <Button
              type="button"
              onClick={() => {
                const parsed = leadInput.safeParse(form);
                if (!parsed.success) {
                  setError(
                    parsed.error.issues.map((i) => i.message).join(". "),
                  );
                  return;
                }
                if (mutate((d) => updateLead(d, lead.id, parsed.data)))
                  onCall(lead.id);
              }}
            >
              <Phone size={14} />
              Starta samtal
            </Button>
          )}
        </div>
      </form>
      {editing && (
        <div className="history">
          <h3 className="mb-5">Samtalshistorik · {calls.length}</h3>
          {calls.length ? (
            calls.map((c) => (
              <div key={c.id} className="history-row">
                <div className="flex between">
                  <StatusBadge status={c.outcome} />
                  <span className="muted">
                    {formatDate(c.createdAt, true)}
                    {c.demo ? " · demo" : ""}
                  </span>
                </div>
                {c.notes && <p>{c.notes}</p>}
                {c.meetingAt && (
                  <p>Mötestid: {formatDate(c.meetingAt, true)}</p>
                )}
              </div>
            ))
          ) : (
            <p className="muted text-xs">Inga samtal registrerade ännu.</p>
          )}
        </div>
      )}
    </Dialog>
  );
}
