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
  Copy,
  ExternalLink,
  Flame,
  Headphones,
  Layers3,
  Keyboard,
  MapPin,
  Pause,
  Phone,
  PhoneMissed,
  Play,
  RotateCcw,
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
  rankedLeads,
  safeWebsite,
  sessionSeconds,
  shiftDate,
  sessionScopeValid,
  sessionIncludesLead,
  sourceName,
  stockholmInput,
  contactMemory,
  contactedToday,
} from "@/lib/model";
import {
  changeSession,
  configureSession,
  refreshSessionLead,
  logCall,
  nextLead,
  startSession,
  undoCall,
  UndoCall,
} from "@/lib/engine";
import { attemptLabel, nextStepText } from "@/lib/lead-intelligence";
import { useStore } from "@/lib/store";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { duration, Empty, Progress, StatusBadge } from "./shared";
import { SyncLabel, SyncNotice } from "./cloud-access";
import { FocusSelection } from "./focus-selection";
import {
  FocusSelectionValue,
  queueInfo,
  scopeLabel,
  selectionSession,
} from "@/lib/focus-queue";
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
  onOpenLead,
}: {
  onOpenLead: (lead: import("@/lib/model").Lead) => void;
  onSearch: () => void;
  onImport: (groupId?: string) => void;
}) {
  const { data, mutate } = useStore();
  const [selection, setSelection] = useState<FocusSelectionValue>({
    group: "",
    batch: "",
    source: "",
    included: data?.settings.defaultStatuses || [],
  });
  const [editingSelection, setEditingSelection] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [copyError, setCopyError] = useState<string>();
  const [panelFor, setPanelFor] = useState<{
    type: "followup" | "meeting";
    leadId: string;
  }>();
  const [time, setTime] = useState("");
  const [timeError, setTimeError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const locked = useRef(false);
  const [undo, setUndo] = useState<UndoCall>();
  const [lastFeedback, setLastFeedback] = useState<{
    message: string;
    icon?: string;
  }>();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [summary, setSummary] = useState<CallingSession>();
  const [milestone, setMilestone] = useState<number>();
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lockTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const milestoneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const active = data?.sessions.find((s) => s.status !== "ended");
  const lead = data?.leads.find((l) => l.id === active?.currentLeadId);
  const panel = panelFor?.leadId === lead?.id ? panelFor?.type : undefined;
  function setPanel(type?: "followup" | "meeting") {
    setPanelFor(type && lead ? { type, leadId: lead.id } : undefined);
  }
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      if (undoTimer.current) clearTimeout(undoTimer.current);
      if (lockTimer.current) clearTimeout(lockTimer.current);
      if (milestoneTimer.current) clearTimeout(milestoneTimer.current);
      if (copyTimer.current) clearTimeout(copyTimer.current);
    };
  }, []);

  useEffect(() => {
    if (active?.status !== "active") return;
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [active?.status]);

  useEffect(() => {
    if (!data || !active || active.status !== "active") return;
    if (refreshSessionLead(data, active.id) !== data)
      mutate((d) => refreshSessionLead(d, active.id));
  }, [active, data, now, mutate]);

  async function copyPhone(phoneToCopy: string, leadId: string) {
    setCopyError(undefined);
    try {
      await navigator.clipboard.writeText(phoneToCopy);
      setCopiedId(leadId);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopyError(leadId);
    }
  }
  function editSelection() {
    if (!active) return;
    if (!mutate((d) => changeSession(d, active.id, "paused"))) return;
    setPanel(undefined);
    setUndo(undefined);
    setSelection({
      group: active.selectedGroup || "",
      batch: active.selectedBatch === "all" ? "" : active.selectedBatch || "",
      source: active.selectedSource || "",
      included: [...active.includedStatuses],
    });
    setEditingSelection(true);
  }
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
    let earned = 0;
    let retryAt: string | undefined;
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
      retryAt = r.data.leads.find((l) => l.id === lead.id)?.nextRetryAt;
      earned =
        r.data.xp.reduce((sum, e) => sum + e.points, 0) -
        d.xp.reduce((sum, e) => sum + e.points, 0);
      return r.data;
    });
    if (ok && inverse) {
      setUndo(inverse);
      if (outcome === "Möte bokat") {
        setLastFeedback({ message: `Möte bokat! +${earned} XP`, icon: "🎉" });
      } else if (outcome === "Kund") {
        setLastFeedback({
          message: `Kund registrerad! +${earned} XP`,
          icon: "🏆",
        });
      } else if (outcome === "Återkom senare") {
        setLastFeedback({ message: "Uppföljning schemalagd", icon: "⏰" });
      } else if (outcome === "Inget svar" && retryAt) {
        setLastFeedback({
          message: `Inget svar. Nästa försök ${formatDate(retryAt, true)}`,
          icon: "⏰",
        });
      } else {
        setLastFeedback({
          message: `Samtalet sparat (+${earned} XP)`,
          icon: "✓",
        });
      }
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
      if (
        e.code === "Space" &&
        active &&
        !busy &&
        !panel &&
        !el.closest("button,a") &&
        data &&
        sessionScopeValid(data, active)
      ) {
        e.preventDefault();
        mutate((d) =>
          changeSession(
            d,
            active.id,
            active.status === "active" ? "paused" : "active",
          ),
        );
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
  const preview = selectionSession(
    selection,
    editingSelection ? active : undefined,
  );
  const previewQueue = queueInfo(data, preview, new Date(now));
  const canStart =
    sessionScopeValid(data, preview) && previewQueue.ready.length > 0;
  const scopeValid = !active || sessionScopeValid(data, active);
  const activeQueue = active
    ? queueInfo(data, active, new Date(now))
    : undefined;
  const previousAvailable = active?.visited.some((id) =>
    data.leads.some((l) => l.id === id && sessionIncludesLead(data, l, active)),
  );
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
            size="sm"
            aria-label="Sök nummer eller företag"
            onClick={onSearch}
          >
            <Search size={16} />
            Sök nummer
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Snabbkommandon"
            onClick={() => setShortcutsOpen(true)}
          >
            <Keyboard size={16} />
          </Button>
          {active && (
            <>
              <Button
                disabled={busy || (!scopeValid && active.status === "paused")}
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
            Välj en grupp och fokusera på nästa samtal. Ditt urval, dina
            anteckningar och dina resultat sparas under tiden.
          </p>
          <FocusSelection
            data={data}
            value={selection}
            onChange={setSelection}
            now={now}
          />
          <div className="focus-start-actions">
            <Button
              disabled={!canStart}
              onClick={() =>
                mutate((d) =>
                  startSession(
                    d,
                    selection.batch,
                    selection.included,
                    undefined,
                    { groupId: selection.group, source: selection.source },
                  ),
                )
              }
            >
              <Phone size={14} />
              Starta ringpass
              <ArrowRight size={14} />
            </Button>
            {!previewQueue.ready.length && (
              <Button
                variant="secondary"
                onClick={() =>
                  onImport(
                    selection.group && selection.group !== "__none__"
                      ? selection.group
                      : undefined,
                  )
                }
              >
                Importera leads
              </Button>
            )}
            <Button variant="ghost" asChild>
              <Link href="/leads">Hantera leads och grupper</Link>
            </Button>
          </div>
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
          <div className="focus-scope-bar">
            <div>
              <span className="flex">
                <Layers3 size={15} />
                <strong>{scopeLabel(data, active)}</strong>
              </span>
              <small>
                {[
                  active.selectedBatch && active.selectedBatch !== "all"
                    ? data.batches.find((b) => b.id === active.selectedBatch)
                        ?.filename || "Importlistan har tagits bort"
                    : "",
                  active.selectedSource || "",
                  `${activeQueue!.ready.length + (lead && !activeQueue!.ready.some((l) => l.id === lead.id) ? 1 : 0)} kvar att ringa`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </small>
            </div>
            <Button
              variant="secondary"
              size="sm"
              disabled={busy}
              onClick={editSelection}
            >
              Ändra urval
            </Button>
          </div>
          {active.status === "paused" ? (
            <div className="pause-overlay">
              <Pause size={35} strokeWidth={1.5} />
              <h2>Ta ett andetag.</h2>
              <p>
                Ditt ringpass är sparat. Tidtagningen står still tills du
                fortsätter.
              </p>
              {!scopeValid && (
                <p className="error-box">
                  Gruppen eller importlistan har tagits bort. Ändra urvalet för
                  att fortsätta.
                </p>
              )}
              <Button
                disabled={!scopeValid}
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
                  <div className="focus-lead-origin">
                    <span>
                      {data.groups.find((g) => g.id === lead.groupId)?.name ||
                        "Utan grupp"}
                    </span>
                    {sourceName(data, lead) !==
                      data.groups.find((g) => g.id === lead.groupId)?.name && (
                      <span>{sourceName(data, lead)}</span>
                    )}
                  </div>
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
                    <a
                      href={`https://www.allabolag.se/bransch-sok?q=${encodeURIComponent(lead.companyName)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="allabolag-badge"
                      title="Sök bolaget på Allabolag"
                    >
                      <Search size={13} />
                      Allabolag
                    </a>
                  </div>
                  <div className="phone-block">
                    <div>
                      {lead.phone ? (
                        <div className="flex items-center gap-3">
                          <a
                            className="phone-number"
                            href={`tel:${lead.phone}`}
                          >
                            {lead.phone}
                          </a>
                          <button
                            type="button"
                            className="btn-copy"
                            onClick={() => copyPhone(lead.phone, lead.id)}
                            title="Kopiera telefonnummer"
                            aria-label="Kopiera telefonnummer"
                          >
                            {copiedId === lead.id ? (
                              <span className="copied-pill">
                                <Check size={12} /> Kopierat!
                              </span>
                            ) : (
                              <span className="copy-icon">
                                <Copy size={13} /> Kopiera
                              </span>
                            )}
                          </button>
                        </div>
                      ) : (
                        <span className="phone-number muted">
                          Telefon saknas
                        </span>
                      )}
                      {copyError === lead.id && (
                        <small role="alert">
                          Kunde inte kopiera. Markera telefonnumret och kopiera
                          manuellt.
                        </small>
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
                  <div className="flex between flex-wrap mt-3">
                    <span className="footnote">{nextStepText(lead)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onOpenLead(lead)}
                    >
                      Planera nästa steg
                    </Button>
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
                    <span>{attemptLabel(data, lead.id)}</span>
                    {data.calls
                      .filter((c) => c.leadId === lead.id)
                      .slice(-2)
                      .map((c) => (
                        <span key={c.id}>
                          {c.outcome} · {formatDate(c.createdAt)}
                        </span>
                      ))}
                  </div>
                  {contactedToday(
                    lead,
                    contactMemory(data)(lead),
                    new Date(now),
                  ) && (
                    <div className="warning" role="status">
                      Det här företaget eller telefonnumret har redan ringts
                      idag ({formatDate(contactMemory(data)(lead), true)}). Du
                      har öppnat det manuellt. Kontrollera historiken innan du
                      ringer igen.
                    </div>
                  )}
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
                        autoFocus
                        aria-label={
                          panel === "meeting" ? "Mötestid" : "Uppföljningstid"
                        }
                        value={time}
                        min={stockholmInput(new Date().toISOString())}
                        onChange={(e) => setTime(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            scheduled();
                          }
                        }}
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
                  disabled={busy || !previousAvailable}
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
                title={
                  activeQueue!.future.length
                    ? "Alla leads som är redo är genomgångna."
                    : "Du har gått igenom din ringlista."
                }
                description={
                  activeQueue!.nextAt
                    ? `${activeQueue!.future.length} leads väntar på nästa kontakttid. Nästa: ${formatDate(activeQueue!.nextAt, true)}. Kön uppdateras automatiskt när det är dags.`
                    : `${activeQueue!.contactedToday ? `${activeQueue!.contactedToday} leads eller nummer har redan ringts idag och väntar till nästa dag. ` : ""}${activeQueue!.missingPhone ? `${activeQueue!.missingPhone} leads saknar telefonnummer. ` : ""}Ändra urvalet för att ringa fler leads, eller avsluta och se dina resultat.`
                }
              />
              <div className="focus-empty-actions">
                <Button
                  variant="secondary"
                  disabled={!previousAvailable}
                  onClick={() => mutate((d) => nextLead(d, active.id, true))}
                >
                  <ArrowLeft size={14} />
                  Föregående företag
                </Button>
                <Button
                  variant="secondary"
                  disabled={
                    !rankedLeads(data, { ...active, visited: [] }).length
                  }
                  onClick={() => {
                    mutate((d) => ({
                      ...d,
                      sessions: d.sessions.map((s) =>
                        s.id === active.id
                          ? {
                              ...s,
                              visited: [],
                              currentLeadId: rankedLeads(d, {
                                ...s,
                                visited: [],
                              })[0]?.id,
                            }
                          : s,
                      ),
                    }));
                  }}
                >
                  <RotateCcw size={14} />
                  Börja om listan
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
            {lastFeedback?.icon ? (
              <span className="text-base mr-1">{lastFeedback.icon}</span>
            ) : (
              <Check size={16} />
            )}
            <span>{lastFeedback?.message ?? "Samtalet sparat"}</span>
            {data.calls.find((c) => c.id === undo.callId)?.outcome ===
              "Intresserad" && (
              <button
                onClick={() => {
                  const previous = data.leads.find(
                    (l) => l.id === undo.previousLead.id,
                  );
                  if (previous) onOpenLead(previous);
                }}
              >
                Planera nästa steg
              </button>
            )}

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
      {editingSelection && active && (
        <Dialog
          open
          title="Ändra ringpassets urval"
          description="Passet är pausat. Tid, resultat och genomgångna leads behålls när du byter urval."
          onOpenChange={setEditingSelection}
        >
          <FocusSelection
            data={data}
            value={selection}
            onChange={setSelection}
            session={active}
            now={now}
          />
          <div className="dialog-footer">
            <Button
              variant="secondary"
              onClick={() => setEditingSelection(false)}
            >
              Behåll pausat
            </Button>
            <Button
              disabled={
                !sessionScopeValid(data, preview) || !selection.included.length
              }
              onClick={() => {
                if (
                  mutate((d) =>
                    configureSession(
                      d,
                      active.id,
                      selection.batch,
                      selection.included,
                      { groupId: selection.group, source: selection.source },
                    ),
                  )
                )
                  setEditingSelection(false);
              }}
            >
              Spara och fortsätt
              <Play size={14} />
            </Button>
          </div>
        </Dialog>
      )}
      <Dialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
        title="Snabbkommandon"
        description="Kommandona fungerar när du inte skriver i ett fält eller har en dialog öppen."
      >
        <dl className="focus-shortcuts">
          <div>
            <dt>Registrera resultat</dt>
            <dd>
              <kbd>1</kbd>–<kbd>6</kbd>
            </dd>
          </div>
          <div>
            <dt>Hoppa över / föregående</dt>
            <dd>
              <kbd>N</kbd> / <kbd>P</kbd>
            </dd>
          </div>
          <div>
            <dt>Pausa / fortsätt</dt>
            <dd>
              <kbd>Mellanslag</kbd>
            </dd>
          </div>
          <div>
            <dt>Sök företag</dt>
            <dd>
              <kbd>/</kbd>
            </dd>
          </div>
          <div>
            <dt>Stäng datumval</dt>
            <dd>
              <kbd>Esc</kbd>
            </dd>
          </div>
        </dl>
      </Dialog>
      {summary && (
        <SessionSummary
          data={data}
          session={summary}
          onClose={() => setSummary(undefined)}
        />
      )}
      <div className="sr-only" aria-live="polite">
        {active?.status === "paused"
          ? "Ringpass pausat"
          : lead
            ? `Nästa företag: ${lead.companyName}`
            : "Ringlista slut"}
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
      <p className="footnote">
        Ringpass: {scopeLabel(data, session)}
        {session.selectedSource ? ` · ${session.selectedSource}` : ""}
      </p>
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
