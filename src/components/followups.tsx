"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CalendarClock, CalendarDays, Check, Phone } from "lucide-react";
import {
  Lead,
  dateKey,
  formatDate,
  fromStockholm,
  stockholmInput,
} from "@/lib/model";
import { useStore } from "@/lib/store";
import { completeFollowUp, reschedule } from "@/lib/engine";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Empty, StatusBadge } from "./shared";
export function FollowUps({
  onOpen,
  onCall,
}: {
  onOpen: (l: Lead) => void;
  onCall: (id: string) => void;
}) {
  const { data, mutate } = useStore();
  const params = useSearchParams();
  const [filter, setFilter] = useState(params.get("group") || "all");
  const [rescheduling, setRescheduling] = useState<string>();
  const [time, setTime] = useState("");
  const [error, setError] = useState("");
  if (!data) return null;
  const today = dateKey();
  const groups = [
    {
      id: "overdue",
      title: "Försenade",
      items: data.followUps.filter(
        (f) => f.status === "pending" && dateKey(f.dueAt) < today,
      ),
    },
    {
      id: "today",
      title: "Idag",
      items: data.followUps.filter(
        (f) => f.status === "pending" && dateKey(f.dueAt) === today,
      ),
    },
    {
      id: "upcoming",
      title: "Kommande",
      items: data.followUps.filter(
        (f) => f.status === "pending" && dateKey(f.dueAt) > today,
      ),
    },
    {
      id: "completed",
      title: "Avklarade",
      items: data.followUps.filter((f) => f.status === "completed"),
    },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Håll samtalet levande.</h1>
          <p>Dina löften, samlade på ett ställe. Följ upp i rätt ögonblick.</p>
        </div>
        <span className="date-pill flex">
          <CalendarDays size={13} />
          {data.followUps.filter((f) => f.status === "pending").length} att
          följa upp
        </span>
      </div>
      <div className="toolbar">
        {[{ id: "all", title: "Alla" }, ...groups].map((g) => (
          <Button
            key={g.id}
            variant={filter === g.id ? "default" : "secondary"}
            size="sm"
            onClick={() => setFilter(g.id)}
          >
            {g.title}
          </Button>
        ))}
      </div>
      {data.followUps.length === 0 && (
        <div className="panel">
          <Empty
            title="Inget att följa upp. Ännu."
            description="Välj Ring tillbaka under ett ringpass så dyker företaget upp här med rätt datum."
          />
        </div>
      )}
      {groups
        .filter((g) => filter === "all" || filter === g.id)
        .map((g) => (
          <section className="follow-group" key={g.id}>
            <div
              className={`group-title ${g.id === "overdue" ? "overdue" : ""}`}
            >
              <CalendarClock size={14} />
              <h3>{g.title}</h3>
              <span>{g.items.length}</span>
            </div>
            {g.items.length === 0 ? (
              <p className="muted text-xs py-4">
                Inga uppföljningar i den här gruppen.
              </p>
            ) : (
              [...g.items]
                .sort((a, b) => a.dueAt.localeCompare(b.dueAt))
                .map((f) => {
                  const l = data.leads.find((l) => l.id === f.leadId);
                  if (!l) return null;
                  return (
                    <div className="follow-row" key={f.id}>
                      <span className="company-avatar">{l.companyName[0]}</span>
                      <div className="follow-company">
                        <button onClick={() => onOpen(l)}>
                          {l.companyName}
                        </button>
                        <p>
                          {f.notes || l.notes || "Inga tidigare anteckningar."}
                        </p>
                        {l.phone && (
                          <a
                            className="table-link text-xs inline-block mt-2"
                            href={`tel:${l.phone}`}
                          >
                            {l.phone}
                          </a>
                        )}
                      </div>
                      <div
                        className={`follow-date ${g.id === "overdue" ? "overdue" : ""}`}
                      >
                        {formatDate(f.dueAt, true)}
                        {f.completedAt && (
                          <p className="muted text-[10px] mt-1">
                            Avklarad {formatDate(f.completedAt, true)}
                          </p>
                        )}
                      </div>
                      <StatusBadge status={l.status} />
                      {f.status === "pending" && (
                        <div className="follow-actions">
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Boka om ${l.companyName}`}
                            onClick={() => {
                              setRescheduling(f.id);
                              setTime(stockholmInput(f.dueAt));
                              setError("");
                            }}
                          >
                            <CalendarClock size={15} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            aria-label={`Markera ${l.companyName} avklarad`}
                            onClick={() =>
                              mutate((d) => completeFollowUp(d, f.id))
                            }
                          >
                            <Check size={16} />
                          </Button>
                          <Button size="sm" onClick={() => onCall(l.id)}>
                            <Phone size={13} />
                            Ring
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })
            )}
          </section>
        ))}
      {rescheduling && (
        <Dialog
          open
          onOpenChange={(o) => {
            if (!o) setRescheduling(undefined);
          }}
          title="Boka om uppföljning"
          description="Välj ett nytt klockslag i svensk tid."
        >
          <label className="form-field">
            Datum och tid
            <input
              className="input"
              type="datetime-local"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </label>
          {error && <div className="error-box">{error}</div>}
          <div className="dialog-footer">
            <Button
              variant="secondary"
              onClick={() => setRescheduling(undefined)}
            >
              Avbryt
            </Button>
            <Button
              onClick={() => {
                try {
                  const dueAt = fromStockholm(time);
                  if (new Date(dueAt).getTime() <= Date.now()) {
                    setError("Välj en tid i framtiden.");
                    return;
                  }
                  if (mutate((d) => reschedule(d, rescheduling, dueAt)))
                    setRescheduling(undefined);
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Spara ny tid
            </Button>
          </div>
        </Dialog>
      )}
    </>
  );
}
