"use client";
import { useState } from "react";
import { CalendarDays, Phone, Users, TrendingUp, Target } from "lucide-react";
import { Data, dateKey, metrics, shiftDate, weekStart } from "@/lib/model";
import { WeekChart } from "./dashboard";
export function Statistics({ data }: { data: Data }) {
  const [period, setPeriod] = useState("week");
  const today = dateKey();
  const [customStart, setCustomStart] = useState(shiftDate(today, -30));
  const [customEnd, setCustomEnd] = useState(today);
  const start =
    period === "today"
      ? today
      : period === "week"
        ? weekStart()
        : period === "month"
          ? today.slice(0, 7) + "-01"
          : customStart;
  const end = period === "custom" ? customEnd : today;
  const valid = !!start && !!end && start <= end;
  const m = metrics(data, valid ? start : today, valid ? end : today);
  const days = valid
    ? Math.round(
        (new Date(end + "T12:00Z").getTime() -
          new Date(start + "T12:00Z").getTime()) /
          86400000,
      ) + 1
    : 1;
  const goalDays = Array.from({ length: Math.min(days, 3660) }, (_, i) =>
    shiftDate(start, i),
  ).filter(
    (d) =>
      data.settings.preferredWorkingDays.includes(
        new Date(d + "T12:00Z").getUTCDay(),
      ) && d <= today,
  );
  const achieved = goalDays.filter(
    (d) =>
      m.calls.filter((c) => dateKey(c.createdAt) === d).length >=
      data.settings.dailyCallTarget,
  ).length;
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Se vad som för dig framåt.</h1>
          <p>Faktiska samtal. Tydliga insikter. Mer momentum.</p>
        </div>
        <div className="period-control">
          <CalendarDays size={14} className="muted" />
          <select
            aria-label="Statistikperiod"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
          >
            <option value="today">Idag</option>
            <option value="week">Den här veckan</option>
            <option value="month">Den här månaden</option>
            <option value="custom">Egen period</option>
          </select>
          {period === "custom" && (
            <>
              <input
                type="date"
                aria-label="Från datum"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
              <input
                type="date"
                aria-label="Till datum"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </>
          )}
        </div>
      </div>
      {!valid || days > 3660 ? (
        <div className="error-box">Välj en giltig period på högst tio år.</div>
      ) : (
        <>
          <div className="metrics-row mb-7">
            <div className="metric">
              <div className="metric-title">
                <Phone size={13} />
                Samtalsförsök
              </div>
              <div className="metric-value">{m.attempts}</div>
              <div className="metric-sub">
                {data.calls.length} samtal totalt
              </div>
            </div>
            <div className="metric">
              <div className="metric-title">
                <Users size={13} />
                Unika företag
              </div>
              <div className="metric-value">{m.unique}</div>
              <div className="metric-sub">Kontaktade under perioden</div>
            </div>
            <div className="metric">
              <div className="metric-title">
                <TrendingUp size={13} />
                Möten bokade
              </div>
              <div className="metric-value">{m.meetings}</div>
              <div className="metric-sub good">
                {m.conversion.toFixed(1)} % av samtalsförsöken
              </div>
            </div>
            <div className="metric">
              <div className="metric-title">
                <Target size={13} />
                Nya kunder
              </div>
              <div className="metric-value">{m.customers}</div>
              <div className="metric-sub">Första kundutfallet per företag</div>
            </div>
          </div>
          <section className="panel">
            <div className="panel-header">
              <div>
                <h2>Varje samtal räknas.</h2>
                <p>
                  {start} — {end} · Europe/Stockholm
                </p>
              </div>
              <span className="badge badge-green">{m.attempts} samtal</span>
            </div>
            <div className="panel-body">
              <div className="analytics-chart">
                <WeekChart
                  data={data}
                  days={Math.min(days, 62)}
                  start={days > 62 ? shiftDate(end, -61) : start}
                />
              </div>
              {days > 62 && (
                <p className="footnote">
                  Diagrammet visar de senaste 62 dagarna i perioden. Nyckeltalen
                  avser hela perioden.
                </p>
              )}
            </div>
          </section>
          <div className="stat-detail-grid">
            <div className="stat-detail">
              <p>Svarsfrekvens</p>
              <strong>{m.answerRate.toFixed(1)} %</strong>
              <small>
                {m.answered} besvarade av {m.attempts} försök
              </small>
            </div>
            <div className="stat-detail">
              <p>Möteskonvertering</p>
              <strong>{m.conversion.toFixed(1)} %</strong>
              <small>
                {m.meetings} första möten av {m.attempts} försök
              </small>
            </div>
            <div className="stat-detail">
              <p>Dagsmål uppnått</p>
              <strong>
                {goalDays.length
                  ? Math.round((achieved / goalDays.length) * 100)
                  : 0}{" "}
                %
              </strong>
              <small>
                {achieved} av {goalDays.length} schemalagda arbetsdagar
              </small>
            </div>
          </div>
          <p className="footnote">
            Ett försök räknas först när ett resultat registreras. Alla utfall
            utom ”Inget svar” räknas som besvarade. Upprepade samtal är separata
            försök; ett företag räknas bara en gång som unikt. Möten och nya
            kunder räknas vid företagets första registrerade utfall. Målgraden
            jämförs med dina aktuella mål och arbetsdagar.
          </p>
        </>
      )}
    </>
  );
}
