"use client";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Flame,
  Headphones,
  Phone,
  Sprout,
  Target,
  TrendingUp,
  Users,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
} from "recharts";
import {
  Data,
  Lead,
  dateKey,
  formatDate,
  metrics,
  shiftDate,
  streak,
  weekStart,
} from "@/lib/model";
import { completedThisWeek } from "@/lib/engine";
import { Button } from "./ui/button";
import { Progress, StatusBadge } from "./shared";
export function WeekChart({
  data,
  days = 7,
  start,
}: {
  data: Data;
  days?: number;
  start?: string;
}) {
  const today = dateKey();
  const first = start || shiftDate(today, -days + 1);
  const grouped = new Map<string, number>();
  data.calls.forEach((c) => {
    const key = dateKey(c.createdAt);
    grouped.set(key, (grouped.get(key) || 0) + 1);
  });
  const chart = Array.from({ length: days }, (_, i) => {
    const day = shiftDate(first, i);
    return {
      day,
      label:
        days <= 7
          ? new Intl.DateTimeFormat("sv-SE", {
              weekday: "short",
              timeZone: "Europe/Stockholm",
            })
              .format(new Date(day + "T12:00Z"))
              .replace(".", "")
          : day.slice(8),
      count: grouped.get(day) || 0,
    };
  });
  return (
    <ResponsiveContainer width="100%" height="100%" minWidth={0}>
      <BarChart
        data={chart}
        barSize={days > 14 ? 15 : 29}
        margin={{ top: 10, right: 5, left: 5, bottom: 0 }}
      >
        <CartesianGrid
          vertical={false}
          stroke="var(--line)"
          strokeDasharray="3 4"
        />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 10, fill: "var(--muted)" }}
          dy={7}
        />
        <Tooltip
          cursor={{ fill: "var(--surface2)" }}
          contentStyle={{
            background: "var(--surface)",
            border: "1px solid var(--line)",
            borderRadius: 7,
            fontSize: 12,
          }}
          labelFormatter={(_, payload) => payload?.[0]?.payload?.day || ""}
          formatter={(v) => [
            v,
            Number(v) >= data.settings.dailyCallTarget
              ? "Samtal · dagsmål nått"
              : "Samtal",
          ]}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {chart.map((c) => (
            <Cell
              key={c.day}
              fill={
                c.day === today
                  ? "var(--green)"
                  : c.count >= data.settings.dailyCallTarget
                    ? "#6caa85"
                    : "#bbd3c2"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
export function Dashboard({
  data,
  onStart,
  onOpen,
}: {
  data: Data;
  onStart: () => void;
  onOpen: (l: Lead) => void;
}) {
  const today = dateKey(),
    day = metrics(data, today, today),
    week = metrics(data, weekStart(), today);
  const due = data.followUps.filter((f) => f.status === "pending");
  const overdue = due.filter((f) => dateKey(f.dueAt) < today),
    todays = due.filter((f) => dateKey(f.dueAt) === today);
  const newLeads = data.leads.filter((l) => l.status === "Ej kontaktad"),
    interested = data.leads.filter((l) => l.status === "Intresserad");
  const active = data.sessions.find((s) => s.status !== "ended");
  const xp = data.xp.reduce((s, e) => s + e.points, 0);
  const completed = completedThisWeek(data, weekStart());
  const priorities = [
    {
      icon: Clock3,
      title: "Försenade uppföljningar",
      description: "Ett samtal kan få bollen i rullning igen.",
      count: overdue.length,
      href: "/followups?group=overdue",
      orange: true,
    },
    {
      icon: CalendarDays,
      title: "Dagens uppföljningar",
      description: "Följ upp när du lovade.",
      count: todays.length,
      href: "/followups?group=today",
    },
    {
      icon: Sprout,
      title: "Nya företag att kontakta",
      description: "Färska möjligheter i din ringlista.",
      count: newLeads.length,
      href: "/leads?status=Ej%20kontaktad",
    },
    {
      icon: TrendingUp,
      title: "Intresserade leads",
      description: "Håll momentum i dina bästa samtal.",
      count: interested.length,
      href: "/leads?status=Intresserad",
    },
  ];
  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow muted mb-2">Ditt arbetsrum</div>
          <h1>En bra dag för nya möjligheter.</h1>
          <p>Lite mindre administration. Lite mer momentum.</p>
        </div>
        <span className="date-pill flex">
          <CalendarDays size={13} />
          {new Intl.DateTimeFormat("sv-SE", {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: "Europe/Stockholm",
          }).format(new Date())}
        </span>
      </div>
      <section className="hero">
        <div>
          <div className="eyebrow text-green flex">
            <span className="status-dot" />
            Fokus för idag
          </div>
          <h2>
            Din nästa affär börjar
            <br />
            med ett samtal.
          </h2>
          <p>
            {day.attempts >= data.settings.dailyCallTarget
              ? "Dagens mål är nått. Allt du gör nu är extra momentum."
              : `Du har ${Math.max(0, data.settings.dailyCallTarget - day.attempts)} samtal kvar till dagens mål. Ett i taget.`}
          </p>
          <div className="hero-actions">
            <Button onClick={onStart}>
              <Phone size={14} />
              {active ? "Fortsätt ringpass" : "Starta ringpass"}
              <ArrowRight size={14} />
            </Button>
            <span className="muted text-[10px] flex">
              <Headphones size={13} />
              Hitta ditt flow
            </span>
          </div>
        </div>
        <div className="hero-visual">
          <div className="eyebrow muted">Dagens samtal</div>
          <div className="goal-number">
            {day.attempts}
            <span> / {data.settings.dailyCallTarget}</span>
          </div>
          <Progress
            value={(day.attempts / data.settings.dailyCallTarget) * 100}
          />
          <div className="goal-footer">
            <span>
              {Math.round((day.attempts / data.settings.dailyCallTarget) * 100)}{" "}
              % av dagsmålet
            </span>
            <span className="flex">
              <Target size={12} />
              {day.attempts >= data.settings.dailyCallTarget
                ? "Mål uppnått"
                : "Du är på väg"}
            </span>
          </div>
        </div>
      </section>
      <div className="metrics-row">
        <div className="metric">
          <div className="metric-title">
            <Phone size={13} />
            Samtal den här veckan
          </div>
          <div className="metric-value">{week.attempts}</div>
          <div className="metric-sub good">
            av {data.settings.weeklyCallTarget} i veckomål
          </div>
        </div>
        <div className="metric">
          <div className="metric-title">
            <CalendarDays size={13} />
            Möten bokade
          </div>
          <div className="metric-value">{week.meetings}</div>
          <div className="metric-sub">
            av {data.settings.weeklyMeetingTarget} den här veckan
          </div>
        </div>
        <div className="metric">
          <div className="metric-title">
            <Check size={13} />
            Uppföljningar klara
          </div>
          <div className="metric-value">{completed}</div>
          <div className="metric-sub">
            av {data.settings.weeklyFollowUpTarget} i veckomål
          </div>
        </div>
        <div className="metric">
          <div className="metric-title">
            <Flame size={13} />
            Din streak
          </div>
          <div className="metric-value">
            {streak(data)}{" "}
            <span className="text-sm muted font-normal">dagar</span>
          </div>
          <div className="metric-sub good">
            {xp.toLocaleString("sv-SE")} XP totalt · nivå{" "}
            {Math.floor(xp / 250) + 1}
          </div>
        </div>
      </div>
      <div className="dashboard-columns">
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Dagens prioriteringar</h2>
              <p>Rätt företag, i rätt ordning.</p>
            </div>
            <span className="key">
              {overdue.length + todays.length + interested.length}
            </span>
          </div>
          <div className="panel-body">
            {priorities.map((p) => (
              <Link className="priority-row" href={p.href} key={p.title}>
                <div className={`priority-icon ${p.orange ? "orange" : ""}`}>
                  <p.icon size={16} strokeWidth={1.6} />
                </div>
                <div className="priority-text">
                  <strong>{p.title}</strong>
                  <p>{p.description}</p>
                </div>
                <span className="priority-count">{p.count}</span>
                <ChevronRight size={13} className="muted" />
              </Link>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-header">
            <div>
              <h2>Små steg. Stor skillnad.</h2>
              <p>Dina samtal de senaste sju dagarna.</p>
            </div>
            <Link className="btn btn-ghost btn-sm" href="/statistics">
              Statistik
              <ArrowRight size={12} />
            </Link>
          </div>
          <div className="panel-body">
            <div className="chart-area">
              <WeekChart data={data} />
            </div>
            <div className="week-summary">
              <span>
                <strong>
                  {metrics(data, shiftDate(today, -6), today).attempts}
                </strong>{" "}
                samtal senaste 7 dagarna
              </span>
              <span className="flex">
                <span className="status-dot" />
                Idag
              </span>
            </div>
            <div className="week-summary mt-3 border-t-0 pt-0">
              <span>Nya kunder den här veckan</span>
              <span>
                <strong>{week.customers}</strong> /{" "}
                {data.settings.weeklyCustomerTarget}
              </span>
            </div>
          </div>
        </section>
      </div>
      <section className="panel activity">
        <div className="panel-header">
          <div>
            <h2>Senaste aktiviteten</h2>
            <p>Varje samtal för dig framåt.</p>
          </div>
          <span className="muted flex text-[10px]">
            <Users size={13} />
            {data.leads.length} företag i ditt arbetsrum
          </span>
        </div>
        {data.calls.length ? (
          [...data.calls]
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
            .slice(0, 4)
            .map((c) => {
              const l = data.leads.find((l) => l.id === c.leadId);
              if (!l) return null;
              return (
                <div className="activity-row" key={c.id}>
                  <span className="company-avatar">{l.companyName[0]}</span>
                  <div className="activity-text">
                    <button
                      className="bg-transparent border-0 p-0 text-left"
                      onClick={() => onOpen(l)}
                    >
                      {l.companyName}
                    </button>
                    <small>
                      {l.city} ·{" "}
                      {c.demo ? "Demohändelse" : "Samtal registrerat"}
                    </small>
                  </div>
                  <StatusBadge status={c.outcome} />
                  <span className="activity-time">
                    {formatDate(c.createdAt, true)}
                  </span>
                </div>
              );
            })
        ) : (
          <p className="muted text-xs p-6">
            Här dyker dina samtal upp. Starta ett ringpass för att komma igång.
          </p>
        )}
      </section>
      <div className="footer-note">
        <span>En sak i taget. Ett samtal närmare.</span>
        <span>CALLFLOW · Byggt för momentum</span>
      </div>
    </>
  );
}
