"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Flame,
  Headphones,
  MapPin,
  Pause,
  Phone,
  PhoneMissed,
  Play,
  Search,
  Sprout,
  Target,
  Trophy,
  User,
  UserCheck,
  X,
} from "lucide-react";
import {
  CallingSession,
  Data,
  Status,
  dateKey,
  formatDate,
  fromStockholm,
  id,
  metrics,
  safeWebsite,
  sessionSeconds,
  shiftDate,
  statuses,
  stockholmInput,
} from "@/lib/model";
import {
  changeSession,
  logCall,
  nextLead,
  startSession,
  undoCall,
  UndoCall,
} from "@/lib/engine";
import { useStore } from "@/lib/store";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { duration, Empty, Progress, StatusBadge } from "./shared";
import { SyncLabel, SyncNotice } from "./cloud-access";
const actions: {
  outcome: Status;
  title: string;
  icon: typeof Phone;
  positive?: boolean;
}[] = [
  { outcome: "Inget svar", title: "Inget svar", icon: PhoneMissed },
  { outcome: "Inte intresserad", title: "Inte intresserad", icon: X },
  { outcome: "Återkom senare", title: "Ring tillbaka", icon: Clock3 },
  {
    outcome: "Intresserad",
    title: "Intresserad",
    icon: Sprout,
    positive: true,
  },
  {
    outcome: "Möte bokat",
    title: "Möte bokat",
    icon: CalendarCheck,
    positive: true,
  },
  { outcome: "Kund", title: "Kund", icon: UserCheck, positive: true },
];
export function Focus({
  onSearch,
  onImport,
}: {
  onSearch: () => void;
  onImport: () => void;
}) {
  const { data, mutate } = useStore();
  const [batch, setBatch] = useState("");
  const [included, setIncluded] = useState<Status[]>(
    data?.settings.defaultStatuses || [],
  );
  const [panel, setPanel] = useState<"followup" | "meeting">();
  const [time, setTime] = useState("");
  const [timeError, setTimeError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [undo, setUndo] = useState<UndoCall>();
  const [summary, setSummary] = useState<CallingSession>();
  const [milestone, setMilestone] = useState<number>();
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const milestoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = data?.sessions.find((s) => s.status !== "ended");
  const lead = data?.leads.find((l) => l.id === active?.currentLeadId);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      if (undoTimer.current) clearTimeout(undoTimer.current);
      if (lockTimer.current) clearTimeout(lockTimer.current);
      if (milestoneTimer.current) clearTimeout(milestoneTimer.current);
    };
  }, []);
  function register(outcome: Status, followUpAt?: string, meetingAt?: string) {
    if (
      !lead ||
      !active ||
      active.status !== "active" ||
      locked.current ||
      !data
    )
      return;
    locked.current = true;
    setBusy(true);
    const eventId = id();
    let inverse: UndoCall | undefined;
    const before = metrics(data, dateKey(), dateKey()).attempts;
    const ok = mutate((d) => {
      const r = logCall(d, {
        leadId: lead.id,
        sessionId: active.id,
        outcome,
        eventId,
        followUpAt,
        meetingAt,
      });
      inverse = r.undo;
      return r.data;
    });
    if (ok && inverse) {
      setUndo(inverse);
      if (undoTimer.current) clearTimeout(undoTimer.current);
      undoTimer.current = setTimeout(() => setUndo(undefined), 10000);
      setPanel(undefined);
      setTime("");
      if (
        [10, 25, 50, 100].includes(before + 1) ||
        before + 1 === data.settings.dailyCallTarget
      ) {
        setMilestone(before + 1);
        if (milestoneTimer.current) clearTimeout(milestoneTimer.current);
        milestoneTimer.current = setTimeout(
          () => setMilestone(undefined),
          4000,
        );
      }
    }
    lockTimer.current = setTimeout(() => {
      locked.current = false;
      setBusy(false);
    }, 650);
  }
  function outcomeAction(outcome: Status) {
    if (busy || active?.status !== "active") return;
    if (outcome === "Återkom senare") {
      setPanel("followup");
      setTime("");
      setTimeError("");
    } else if (outcome === "Möte bokat") {
      setPanel("meeting");
      setTime("");
      setTimeError("");
    } else register(outcome);
  }
  useEffect(() => {
    function shortcut(e: KeyboardEvent) {
      const el = e.target as HTMLElement;
      if (
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        e.repeat ||
        el.closest(
          'input,textarea,select,[contenteditable="true"],[role="dialog"]',
        )
      )
        return;
      if (e.key === "/") {
        e.preventDefault();
        onSearch();
        return;
      }
      if (e.key === "Escape") {
        setPanel(undefined);
        return;
      }
      if (!active || active.status !== "active" || busy) return;
      if (panel) return;
      const n = Number(e.key);
      if (n >= 1 && n <= 6) {
        e.preventDefault();
        outcomeAction(actions[n - 1].outcome);
      }
      if (e.key.toLowerCase() === "n" || e.key.toLowerCase() === "p") {
        e.preventDefault();
        mutate((d) => nextLead(d, active.id, e.key.toLowerCase() === "p"));
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  });
  if (!data) return null;
  const daily = metrics(data, dateKey(), dateKey());
  const sessionCalls = data.calls.filter((c) => c.sessionId === active?.id);
  const xp = data.xp
    .filter(
      (e) =>
        sessionCalls.some((c) => c.id === e.sourceEventId) ||
        data.followUps.some(
          (f) =>
            f.id === e.sourceEventId &&
            sessionCalls.some(
              (c) => c.leadId === f.leadId && c.createdAt === f.completedAt,
            ),
        ),
    )
    .reduce((s, e) => s + e.points, 0);
  function selectDate(days: number, later = false) {
    const next = later
      ? new Date(Date.now() + 2 * 3600000).toISOString()
      : fromStockholm(shiftDate(dateKey(), days) + "T09:00");
    register("Återkom senare", next);
  }
  function finish() {
    if (!active || !data) return;
    const ended = {
      ...active,
      status: "ended" as const,
      activeDuration: sessionSeconds(active),
      activeSince: undefined,
      endedAt: new Date().toISOString(),
    };
    if (mutate((d) => changeSession(d, active.id, "ended"))) {
      setSummary(ended);
      setPanel(undefined);
      setUndo(undefined);
    }
  }
  function scheduled() {
    try {
      const value = time ? fromStockholm(time) : undefined;
      if (
        panel === "followup" &&
        (!value || new Date(value).getTime() <= Date.now())
      ) {
        setTimeError("Välj ett datum och klockslag i framtiden.");
        return;
      }
      if (value && new Date(value).getTime() <= Date.now()) {
        setTimeError("Välj en tid i framtiden.");
        return;
      }
      register(
        panel === "followup" ? "Återkom senare" : "Möte bokat",
        panel === "followup" ? value : undefined,
        panel === "meeting" ? value : undefined,
      );
    } catch (e) {
      setTimeError((e as Error).message);
    }
  }
  return (
    <div className="focus-shell">
      <header className="focus-header">
        <Link
          href="/"
          className="brand"
          onClick={() => {
            if (active?.status === "active")
              mutate((d) => changeSession(d, active.id, "paused"));
          }}
        >
          <span className="brand-mark">
            <Phone size={13} />
          </span>
          CALLFLOW
        </Link>
        <div className="session-progress">
          <div className="flex between">
            <span>
              <strong>{daily.attempts}</strong> /{" "}
              {data.settings.dailyCallTarget} samtal idag
            </span>
            <span className="muted">
              {Math.round(
                (daily.attempts / data.settings.dailyCallTarget) * 100,
              )}{" "}
              %
            </span>
          </div>
          <Progress
            value={(daily.attempts / data.settings.dailyCallTarget) * 100}
          />
        </div>
        <div className="session-controls">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Sök företag"
            onClick={onSearch}
          >
            <Search size={16} />
          </Button>
          {active && (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  mutate((d) =>
                    changeSession(
                      d,
                      active.id,
                      active.status === "active" ? "paused" : "active",
                    ),
                  );
                  setPanel(undefined);
                }}
              >
                {active.status === "active" ? (
                  <Pause size={14} />
                ) : (
                  <Play size={14} />
                )}{" "}
                {active.status === "active" ? "Pausa" : "Fortsätt"}
              </Button>
              <Button variant="secondary" onClick={finish}>
                Avsluta
              </Button>
            </>
          )}
          <Link
            href="/"
            className="btn btn-ghost btn-icon"
            aria-label="Till översikten"
            onClick={() => {
              if (active?.status === "active")
                mutate((d) => changeSession(d, active.id, "paused"));
            }}
          >
            <X size={17} />
          </Link>
        </div>
      </header>
      <div className="focus-sync">
        <SyncLabel />
      </div>
      <SyncNotice />
      {!active ? (
        <div className="panel focus-start">
          <Headphones size={32} className="text-green" strokeWidth={1.4} />
          <div className="eyebrow muted mt-6">Ditt fokusrum</div>
          <h1>Ett samtal i taget.</h1>
          <p>
            Välj din lista, sätt på hörlurarna och hitta ditt flow. Vi tar hand
            om resten.
          </p>
          <label className="form-field">
            Ringlista
            <select
              aria-label="Välj ringlista"
              value={batch}
              onChange={(e) => setBatch(e.target.value)}
            >
              <option value="">Alla företag</option>
              {data.batches.map((b) => (
                <option value={b.id} key={b.id}>
                  {b.filename}
                </option>
              ))}
            </select>
          </label>
          <h3 className="mt-6">Inkludera statusar</h3>
          <div className="checkboxes">
            {statuses.map((s) => (
              <label key={s}>
                <input
                  type="checkbox"
                  checked={included.includes(s)}
                  onChange={() =>
                    setIncluded(
                      included.includes(s)
                        ? included.filter((v) => v !== s)
                        : [...included, s],
                    )
                  }
                />
                {s}
              </label>
            ))}
          </div>
          <p className="footnote">
            Försenade uppföljningar kommer först. Framtida återringningar väntar
            till sitt klockslag.
          </p>
          <Button
            disabled={!included.length || !data.leads.length}
            onClick={() => mutate((d) => startSession(d, batch, included))}
          >
            <Phone size={14} />
            Starta ringpass
            <ArrowRight size={14} />
          </Button>
          {!data.leads.length && (
            <Button variant="ghost" onClick={onImport}>
              Importera din första lista
            </Button>
          )}
        </div>
      ) : (
        <main className="focus-content">
          <div className="session-strip">
            <span className="flex">
              <span className="status-dot" />
              {active.status === "paused"
                ? "Ringpass pausat"
                : "Ringpass pågår"}{" "}
              · {sessionCalls.length} samtal
            </span>
            <span className="flex">
              <Clock3 size={13} />
              {duration(sessionSeconds(active, now))}
              <span className="mx-2">·</span>
              <Flame size={13} />
              {xp} XP
            </span>
          </div>
          {active.status === "paused" ? (
            <div className="pause-overlay">
              <Pause size={35} strokeWidth={1.5} />
              <h2>Ta ett andetag.</h2>
              <p>
                Ditt ringpass är sparat. Tidtagningen står still tills du
                fortsätter.
              </p>
              <Button
                onClick={() =>
                  mutate((d) => changeSession(d, active.id, "active"))
                }
              >
                <Play size={14} />
                Fortsätt ringpass
              </Button>
            </div>
          ) : lead ? (
            <>
              <AnimatePresence mode="wait" initial={false}>
                <motion.section
                  key={lead.id}
                  className="focus-company"
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.13 }}
                >
                  <div className="focus-company-top">
                    <span className="eyebrow muted">
                      Nästa möjlighet{lead.demo ? " · Demoföretag" : ""}
                    </span>
                    <StatusBadge status={lead.status} />
                  </div>
                  <h1>{lead.companyName}</h1>
                  <div className="focus-info">
                    {lead.industry && (
                      <span>
                        <Sprout size={13} />
                        {lead.industry}
                      </span>
                    )}
                    {lead.city && (
                      <span>
                        <MapPin size={13} />
                        {lead.city}
                      </span>
                    )}
                    {lead.contactName && (
                      <span>
                        <User size={13} />
                        {lead.contactName}
                      </span>
                    )}
                    {lead.website && (
                      <a
                        href={safeWebsite(lead.website)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <ExternalLink size={13} />
                        Hemsida
                      </a>
                    )}
                  </div>
                  <div className="phone-block">
                    <div>
                      {lead.phone ? (
                        <a className="phone-number" href={`tel:${lead.phone}`}>
                          {lead.phone}
                        </a>
                      ) : (
                        <span className="phone-number muted">
                          Telefon saknas
                        </span>
                      )}
                      <span className="phone-caption">
                        {lead.nextFollowUpAt
                          ? `Uppföljning ${formatDate(lead.nextFollowUpAt, true)}`
                          : "Välj resultat när samtalet är klart."}
                      </span>
                    </div>
                    {lead.phone ? (
                      <Button asChild>
                        <a href={`tel:${lead.phone}`}>
                          <Phone size={16} />
                          Ring
                        </a>
                      </Button>
                    ) : (
                      <span className="muted text-xs">Komplettera i Leads</span>
                    )}
                  </div>
                  <div className="focus-notes">
                    <div className="focus-notes-head">
                      <label htmlFor="quickNotes">Dina anteckningar</label>
                      <span className="muted flex">
                        <Check size={11} />
                        Autosparas
                      </span>
                    </div>
                    <textarea
                      id="quickNotes"
                      value={lead.notes}
                      maxLength={20000}
                      placeholder="Skriv en snabb anteckning inför nästa samtal…"
                      onChange={(e) => {
                        const value = e.target.value;
                        mutate((d) => ({
                          ...d,
                          leads: d.leads.map((l) =>
                            l.id === lead.id
                              ? {
                                  ...l,
                                  notes: value,
                                  updatedAt: new Date().toISOString(),
                                }
                              : l,
                          ),
                        }));
                      }}
                    />
                  </div>
                  <div className="focus-history">
                    <Clock3 size={12} />
                    <span>
                      {data.calls.filter((c) => c.leadId === lead.id).length}{" "}
                      tidigare försök
                    </span>
                    {data.calls
                      .filter((c) => c.leadId === lead.id)
                      .slice(-2)
                      .map((c) => (
                        <span key={c.id}>
                          {c.outcome} · {formatDate(c.createdAt)}
                        </span>
                      ))}
                  </div>
                  {data.calls.filter((c) => c.leadId === lead.id).length >
                    0 && (
                    <details className="mt-3 text-xs muted">
                      <summary className="cursor-pointer">
                        Visa tidigare samtal och anteckningar
                      </summary>
                      {data.calls
                        .filter((c) => c.leadId === lead.id)
                        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
                        .map((c) => (
                          <div className="mt-3" key={c.id}>
                            <strong>
                              {c.outcome} · {formatDate(c.createdAt, true)}
                            </strong>
                            <p className="mt-1 whitespace-pre-wrap">
                              {c.notes || "Inga anteckningar."}
                            </p>
                          </div>
                        ))}
                    </details>
                  )}
                </motion.section>
              </AnimatePresence>
              <div className="outcome-heading">
                <strong>Hur gick samtalet?</strong>
                <span className="muted">
                  Resultat sparas direkt · +5 XP per samtal
                </span>
              </div>
              <div className="outcomes">
                {actions.map((a, i) => (
                  <button
                    key={a.outcome}
                    className={`outcome-button ${a.positive ? "positive" : ""}`}
                    disabled={busy}
                    onClick={() => outcomeAction(a.outcome)}
                  >
                    <span className="flex">
                      <a.icon size={16} strokeWidth={1.7} />
                      {a.title}
                    </span>
                    <kbd className="key">{i + 1}</kbd>
                  </button>
                ))}
              </div>
              {panel && (
                <section className="inline-panel">
                  <div className="flex between">
                    <h3>
                      {panel === "followup"
                        ? "När ska du ringa tillbaka?"
                        : "Boka ett möte"}
                    </h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Stäng datumväljare"
                      onClick={() => setPanel(undefined)}
                    >
                      <X size={15} />
                    </Button>
                  </div>
                  {panel === "followup" && (
                    <div className="quick-dates">
                      <button
                        disabled={busy}
                        onClick={() => selectDate(0, true)}
                      >
                        Senare idag
                      </button>
                      <button disabled={busy} onClick={() => selectDate(1)}>
                        Imorgon
                      </button>
                      <button disabled={busy} onClick={() => selectDate(3)}>
                        Om 3 dagar
                      </button>
                      <button disabled={busy} onClick={() => selectDate(7)}>
                        Nästa vecka
                      </button>
                    </div>
                  )}
                  <div className="flex mt-4">
                    <label className="form-field flex-1">
                      {panel === "meeting" ? "Mötestid (valfri)" : "Välj datum"}{" "}
                      · svensk tid
                      <input
                        type="datetime-local"
                        aria-label={
                          panel === "meeting" ? "Mötestid" : "Uppföljningstid"
                        }
                        value={time}
                        min={stockholmInput(new Date().toISOString())}
                        onChange={(e) => setTime(e.target.value)}
                      />
                    </label>
                    <Button
                      disabled={busy}
                      className="self-end"
                      onClick={scheduled}
                    >
                      {panel === "meeting" && !time
                        ? "Registrera utan tid"
                        : "Spara & nästa"}
                    </Button>
                  </div>
                  {timeError && <div className="error-box">{timeError}</div>}
                </section>
              )}
              <div className="focus-nav">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy || !active.visited.length}
                  onClick={() => {
                    setPanel(undefined);
                    mutate((d) => nextLead(d, active.id, true));
                  }}
                >
                  <ChevronLeft size={15} />
                  Föregående<kbd className="key">P</kbd>
                </Button>
                <span>Ringknappen registrerar inget samtal.</span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy}
                  onClick={() => {
                    setPanel(undefined);
                    mutate((d) => nextLead(d, active.id));
                  }}
                >
                  Hoppa över<kbd className="key">N</kbd>
                  <ChevronRight size={15} />
                </Button>
              </div>
            </>
          ) : (
            <div className="panel">
              <Empty
                title="Du har gått igenom din ringlista."
                description="Framtida uppföljningar väntar till avtalad tid. Avsluta passet för att se dina resultat, eller återgå till ett tidigare företag."
              />
              <div className="flex justify-center pb-8">
                <Button
                  variant="secondary"
                  disabled={!active.visited.length}
                  onClick={() => mutate((d) => nextLead(d, active.id, true))}
                >
                  <ArrowLeft size={14} />
                  Föregående företag
                </Button>
                <Button onClick={finish}>
                  Se sammanfattning
                  <ArrowRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </main>
      )}
      <AnimatePresence>
        {undo && (
          <motion.div
            role="status"
            className="toast"
            style={{ left: "50%" }}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <Check size={16} />
            Samtalet sparat
            <button
              onClick={() => {
                if (mutate((d) => undoCall(d, undo))) {
                  setUndo(undefined);
                  setMilestone(undefined);
                }
              }}
            >
              Ångra
            </button>
          </motion.div>
        )}
        {milestone && (
          <motion.div
            className="milestone"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
          >
            <Trophy size={25} className="text-green" />
            <div>
              <strong>
                {milestone === data.settings.dailyCallTarget
                  ? "Dagsmålet är nått!"
                  : `${milestone} samtal idag.`}
              </strong>
              <small>Du bygger momentum. Fortsätt i ditt tempo.</small>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      {summary && (
        <SessionSummary
          data={data}
          session={summary}
          onClose={() => setSummary(undefined)}
        />
      )}
      <div className="sr-only" aria-live="polite">
        {lead ? `Nästa företag: ${lead.companyName}` : "Ringlista slut"}
      </div>
    </div>
  );
}
function SessionSummary({
  data,
  session,
  onClose,
}: {
  data: Data;
  session: CallingSession;
  onClose: () => void;
}) {
  const calls = data.calls.filter((c) => c.sessionId === session.id);
  const followups = data.followUps.filter((f) =>
    calls.some((c) => c.id === f.sourceCallId),
  );
  const xp = data.xp
    .filter(
      (e) =>
        calls.some((c) => c.id === e.sourceEventId) ||
        data.followUps.some(
          (f) =>
            e.sourceEventId === f.id &&
            calls.some(
              (c) => c.leadId === f.leadId && c.createdAt === f.completedAt,
            ),
        ),
    )
    .reduce((s, e) => s + e.points, 0);
  const count = (s: string) => calls.filter((c) => c.outcome === s).length;
  const stats: [number | string, string][] = [
    [calls.length, "Samtalsförsök"],
    [
      calls.filter((c) => c.outcome !== "Inget svar").length,
      "Besvarade samtal",
    ],
    [count("Intresserad"), "Intresserade"],
    [count("Möte bokat"), "Möten bokade"],
    [count("Kund"), "Nya kunder"],
    [followups.length, "Uppföljningar skapade"],
  ];
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      title="Bra jobbat. Du tog nästa steg."
      description="Ditt ringpass är avslutat och alla resultat är sparade."
    >
      <div className="summary-success">
        <Trophy size={34} />
        <h2>{xp} XP för ditt arbete</h2>
        <p>
          {duration(sessionSeconds(session))} i fokus · {calls.length} nya
          möjligheter att lära av.
        </p>
      </div>
      <div className="summary-grid">
        {stats.map(([v, l]) => (
          <div key={l}>
            <strong>{v}</strong>
            {l}
          </div>
        ))}
      </div>
      <p className="footnote">
        Idag: {metrics(data, dateKey(), dateKey()).attempts} av{" "}
        {data.settings.dailyCallTarget} samtal. Fortsätt när det passar dig.
      </p>
      <div className="dialog-footer">
        <Button variant="secondary" asChild>
          <Link href="/statistics">Se statistik</Link>
        </Button>
        <Button onClick={onClose}>
          Klart
          <Target size={14} />
        </Button>
      </div>
    </Dialog>
  );
}
