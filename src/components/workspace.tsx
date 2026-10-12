"use client";
import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Bell,
  ChevronRight,
  Clock3,
  Database,
  LayoutDashboard,
  Menu,
  Moon,
  Phone,
  Plus,
  Search,
  Settings2,
  Sun,
  Users,
  X,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { Lead, dateKey, emptyData, metrics } from "@/lib/model";
import { changeSession, startSession } from "@/lib/engine";
import { download } from "@/lib/import";
import { Dashboard } from "./dashboard";
import { Leads } from "./leads";
import { Focus } from "./focus";
import { FollowUps } from "./followups";
import { Statistics } from "./statistics";
import { Settings } from "./settings";
import { LeadDialog } from "./lead-dialog";
import { ImportWizard } from "./import-wizard";
import { Progress } from "./shared";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { SyncLabel, SyncNotice } from "./cloud-access";
const navigation = [
  { id: "dashboard", label: "Översikt", icon: LayoutDashboard, url: "/" },
  { id: "leads", label: "Leads", icon: Users, url: "/leads" },
  { id: "focus", label: "Fokusläge", icon: Phone, url: "/focus" },
  { id: "followups", label: "Uppföljningar", icon: Clock3, url: "/followups" },
  { id: "statistics", label: "Statistik", icon: BarChart3, url: "/statistics" },
];
export function Workspace({ section }: { section: string }) {
  return (
    <Suspense
      fallback={<div className="empty muted">Öppnar ditt arbetsrum…</div>}
    >
      <WorkspaceInner section={section} />
    </Suspense>
  );
}
function WorkspaceInner({ section }: { section: string }) {
  const { data, error, setError, mutate, replace, repository, cloud } =
    useStore();
  const router = useRouter();
  const [detail, setDetail] = useState<Lead | "new">();
  const [importing, setImporting] = useState(false);
  const [groupContext, setGroupContext] = useState("");
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (section === "focus") return;
    function shortcut(e: KeyboardEvent) {
      if (
        e.key === "/" &&
        !e.ctrlKey &&
        !e.metaKey &&
        !(e.target as HTMLElement).closest(
          'input,textarea,select,[contenteditable],[role="dialog"]',
        )
      ) {
        e.preventDefault();
        setSearching(true);
      }
    }
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [section]);
  function onStart(batchId?: string) {
    if (!data) return;
    const active = data.sessions.find((s) => s.status !== "ended");
    if (batchId) {
      if (active) {
        if (!mutate((d) => changeSession(d, active.id, "ended"))) return;
      }
      if (
        !mutate((d) => startSession(d, batchId, data.settings.defaultStatuses))
      )
        return;
    } else if (active) {
      if (!mutate((d) => changeSession(d, active.id, "active"))) return;
    }
    setImporting(false);
    router.push("/focus");
  }
  function onCall(leadId: string) {
    if (!data) return;
    if (
      mutate((d) => startSession(d, "", data.settings.defaultStatuses, leadId))
    ) {
      setDetail(undefined);
      setSearching(false);
      router.push("/focus");
    }
  }
  if (!data)
    return (
      <main className="max-w-xl mx-auto p-10">
        <div className="text-green text-xl font-bold tracking-widest mb-10">
          CALLFLOW
        </div>
        {error ? (
          <>
            <h1>Din data är kvar.</h1>
            <p className="error-box">{error}</p>
            <div className="stack">
              <Button
                variant="secondary"
                onClick={() => {
                  const raw = repository.raw();
                  if (raw)
                    download(
                      raw,
                      "callflow-original-backup.json",
                      "application/json",
                    );
                }}
              >
                Hämta original som säkerhetskopia
              </Button>
              <Button
                onClick={() => {
                  if (
                    window.confirm(
                      "Ersätt den sparade datan med en tom databas? Hämta originalet först.",
                    )
                  )
                    replace(emptyData());
                }}
              >
                Återställ till tom databas
              </Button>
            </div>
          </>
        ) : (
          <p className="muted text-sm">Öppnar ditt arbetsrum…</p>
        )}
      </main>
    );
  const day = metrics(data, dateKey(), dateKey());
  const dueCount = data.followUps.filter(
    (f) => f.status === "pending" && dateKey(f.dueAt) <= dateKey(),
  ).length;
  const active = data.sessions.find((s) => s.status !== "ended");
  const label =
    section === "settings"
      ? "Inställningar"
      : navigation.find((n) => n.id === section)?.label;
  const open = (l: Lead) => setDetail(l);
  const add = (groupId?: string) => {
    setGroupContext(typeof groupId === "string" ? groupId : "");
    setDetail("new");
  };
  const importLeads = (groupId?: string) => {
    setGroupContext(typeof groupId === "string" ? groupId : "");
    setImporting(true);
  };
  return (
    <>
      {section === "focus" ? (
        <Focus onSearch={() => setSearching(true)} onImport={importLeads} />
      ) : (
        <div className="app-shell">
          {mobile && (
            <button
              className="mobile-backdrop"
              aria-label="Stäng menyn"
              onClick={() => setMobile(false)}
            />
          )}
          <aside className={`sidebar ${mobile ? "mobile-open" : ""}`}>
            <Link href="/" className="brand">
              <span className="brand-mark">
                <Phone size={16} />
              </span>
              CALLFLOW
            </Link>
            <div className="workspace-label">
              <span className="avatar">PG</span>
              <div>
                <strong className="text-xs font-normal text-[#d3e2d8]">
                  Mitt arbetsrum
                </strong>
                <p className="text-[10px] mt-1 text-[#758f81]">
                  Soloförsäljning · Sverige
                </p>
              </div>
            </div>
            <div className="nav-caption">Arbetsrum</div>
            <nav aria-label="Huvudnavigation">
              {navigation.map((n) => (
                <Link
                  key={n.id}
                  href={n.url}
                  className={`nav-link ${section === n.id ? "active" : ""}`}
                  onClick={() => setMobile(false)}
                >
                  <n.icon size={16} strokeWidth={1.6} />
                  {n.label}
                  {n.id === "followups" && dueCount > 0 && section !== n.id && (
                    <span className="nav-count">{dueCount}</span>
                  )}
                </Link>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <div className="side-goal">
                <div className="flex between text-[10px]">
                  <span>Dagens momentum</span>
                  <span className="text-[#d6e8da]">
                    {day.attempts} / {data.settings.dailyCallTarget}
                  </span>
                </div>
                <Progress
                  value={(day.attempts / data.settings.dailyCallTarget) * 100}
                />
                <small className="text-[9px] text-[#799585]">
                  Ett samtal närmare ditt mål.
                </small>
              </div>
              <button className="side-start" onClick={() => onStart()}>
                <Phone size={13} />
                {active ? "Fortsätt ringpass" : "Starta ringpass"}
                <ArrowRight size={13} />
              </button>
              <Link
                href="/settings"
                className={`nav-link ${section === "settings" ? "active" : ""}`}
                onClick={() => setMobile(false)}
              >
                <Settings2 size={16} strokeWidth={1.6} />
                Inställningar
              </Link>
              <div className="profile">
                <span className="avatar">PG</span>
                <div>
                  <strong>Ditt personliga arbetsrum</strong>
                  <small>
                    {cloud ? "Supabase & privat" : "Lokalt & privat"}
                  </small>
                </div>
                <span className="status-dot ml-auto" />
              </div>
            </div>
          </aside>
          <div className="main">
            <header className="topbar">
              <div className="flex">
                <Button
                  className="mobile-menu"
                  variant="ghost"
                  size="icon"
                  aria-label="Öppna menyn"
                  onClick={() => setMobile(true)}
                >
                  <Menu size={18} />
                </Button>
                <div className="breadcrumb">
                  <span>Arbetsrum</span>
                  <ChevronRight size={11} />
                  <span>{label}</span>
                </div>
              </div>
              <div className="top-actions">
                <button
                  className="global-search"
                  onClick={() => setSearching(true)}
                >
                  <Search size={14} />
                  <span>Sök i ditt arbetsrum…</span>
                  <kbd className="key ml-auto">/</kbd>
                </button>
                <span className="storage-tag">
                  <SyncLabel />
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={
                    data.settings.theme === "dark"
                      ? "Aktivera ljust tema"
                      : "Aktivera mörkt tema"
                  }
                  onClick={() =>
                    mutate((d) => ({
                      ...d,
                      settings: {
                        ...d.settings,
                        theme: document.documentElement.classList.contains(
                          "dark",
                        )
                          ? "light"
                          : "dark",
                      },
                    }))
                  }
                >
                  {data.settings.theme === "dark" ? (
                    <Sun size={16} />
                  ) : (
                    <Moon size={16} />
                  )}
                </Button>
                <Link
                  href="/followups"
                  className="btn btn-ghost btn-icon"
                  aria-label={`Uppföljningar: ${dueCount} väntar`}
                >
                  <Bell size={16} />
                </Link>
              </div>
            </header>
            <main className="content">
              <SyncNotice />
              {data.leads.some((l) => l.demo) && (
                <div className="demo-banner">
                  <span>
                    <Database size={13} />
                    Du utforskar ett arbetsrum med fiktiv demodata. Egna
                    importer märks separat.
                  </span>
                  <Link href="/settings" className="flex whitespace-nowrap">
                    Hantera data
                    <ArrowRight size={12} />
                  </Link>
                </div>
              )}
              {section === "dashboard" && (
                <Dashboard
                  data={data}
                  onStart={() => onStart()}
                  onOpen={open}
                />
              )}{" "}
              {section === "leads" && (
                <Leads
                  onOpen={open}
                  onAdd={add}
                  onImport={importLeads}
                  onCall={onCall}
                />
              )}{" "}
              {section === "followups" && (
                <FollowUps onOpen={open} onCall={onCall} />
              )}{" "}
              {section === "statistics" && <Statistics data={data} />}{" "}
              {section === "settings" && <Settings onImport={importLeads} />}
            </main>
          </div>
        </div>
      )}
      {detail && (
        <LeadDialog
          key={detail === "new" ? "new" : detail.id}
          lead={
            detail === "new"
              ? "new"
              : data.leads.find((l) => l.id === detail.id) || detail
          }
          initialGroupId={groupContext}
          onClose={() => setDetail(undefined)}
          onCall={onCall}
        />
      )}{" "}
      {importing && (
        <ImportWizard
          initialGroupId={groupContext}
          onClose={() => setImporting(false)}
          onStart={onStart}
        />
      )}
      <Dialog
        open={searching}
        onOpenChange={setSearching}
        title="Hitta nästa möjlighet"
        description="Sök efter företag, kontaktperson, telefon eller ort."
      >
        <div className="search-field max-w-none mb-4">
          <Search size={15} />
          <input
            className="input"
            aria-label="Sök i arbetsrummet"
            placeholder="Sök ett företag…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="max-h-80 overflow-auto">
          {data.leads
            .filter((l) =>
              [l.companyName, l.phone, l.city, l.contactName].some((v) =>
                v.toLowerCase().includes(query.toLowerCase()),
              ),
            )
            .slice(0, 30)
            .map((l) => (
              <button
                className="priority-row"
                key={l.id}
                onClick={() => {
                  setSearching(false);
                  setDetail(l);
                }}
              >
                <span className="company-avatar">{l.companyName[0]}</span>
                <div className="priority-text">
                  <strong>{l.companyName}</strong>
                  <p>
                    {l.city} · {l.phone || "Telefon saknas"}
                  </p>
                </div>
                <ChevronRight size={14} className="muted" />
              </button>
            ))}
          {!data.leads.length && (
            <p className="muted text-xs p-4">Inga företag ännu.</p>
          )}
          {data.leads.length > 0 &&
            !data.leads.some((l) =>
              [l.companyName, l.phone, l.city, l.contactName].some((v) =>
                v.toLowerCase().includes(query.toLowerCase()),
              ),
            ) && (
              <p className="muted text-xs p-4">
                Inga företag matchar din sökning.
              </p>
            )}
        </div>
        <div className="dialog-footer">
          <Button
            variant="secondary"
            onClick={() => {
              setSearching(false);
              router.push("/leads?q=" + encodeURIComponent(query));
            }}
          >
            Visa alla träffar
          </Button>
          <Button
            onClick={() => {
              setSearching(false);
              add();
            }}
          >
            <Plus size={14} />
            Lägg till företag
          </Button>
        </div>
      </Dialog>
      {error && (
        <div className="global-error" role="alert">
          <span className="flex-1 text-xs leading-6">{error}</span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Stäng felmeddelande"
            onClick={() => setError("")}
          >
            <X size={16} />
          </Button>
        </div>
      )}
    </>
  );
}
