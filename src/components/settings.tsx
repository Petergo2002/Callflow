"use client";
import { useRef, useState } from "react";
import {
  Download,
  FileJson,
  RotateCcw,
  Save,
  LogOut,
  Cloud,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { defaults, emptyData, GoalSettings, statuses } from "@/lib/model";
import { useStore } from "@/lib/store";
import { download, exportCSV } from "@/lib/import";
import { validateData } from "@/lib/repository";
import { Button } from "./ui/button";
import { SyncLabel } from "./cloud-access";
import { cloudConfigured } from "@/lib/supabase";
import { CloudRepository } from "@/lib/cloud-repository";
export function Settings({ onImport }: { onImport: () => void }) {
  const {
    data,
    mutate,
    replace,
    setError,
    cloud,
    userEmail,
    signOut,
    activateCloud,
    repository,
  } = useStore();
  const [settings, setSettings] = useState<GoalSettings>(
    data?.settings || defaults,
  );
  const [saved, setSaved] = useState(false);
  const restore = useRef<HTMLInputElement>(null);
  if (!data) return null;
  function change(patch: Partial<GoalSettings>) {
    setSettings({ ...settings, ...patch });
    setSaved(false);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <h1>Gör CALLFLOW till ditt.</h1>
          <p>Dina mål. Ditt tempo. Ditt sätt att jobba.</p>
        </div>
        <Button
          onClick={() => {
            if (settings.preferredWorkingDays.length === 0) {
              setError("Välj minst en arbetsdag.");
              return;
            }
            if (
              Object.entries(settings).some(
                ([k, v]) =>
                  k.endsWith("Target") &&
                  (typeof v !== "number" ||
                    !Number.isInteger(v) ||
                    v < 1 ||
                    v > 100000),
              )
            ) {
              setError("Mål måste vara heltal mellan 1 och 100 000.");
              return;
            }
            if (mutate((d) => ({ ...d, settings }))) setSaved(true);
          }}
        >
          <Save size={14} />
          {saved ? "Inställningar sparade" : "Spara inställningar"}
        </Button>
      </div>
      <div className="settings-grid">
        <div className="stack">
          <section className="panel settings-section">
            <h2>En riktning för din arbetsdag.</h2>
            <p>Sätt mål som ger dig lagom mycket att sträcka dig efter.</p>
            {(
              [
                ["dailyCallTarget", "Samtal per dag"],
                ["weeklyCallTarget", "Samtal per vecka"],
                ["weeklyMeetingTarget", "Möten per vecka"],
                ["weeklyFollowUpTarget", "Uppföljningar per vecka"],
                ["weeklyCustomerTarget", "Nya kunder per vecka"],
              ] as const
            ).map(([key, label]) => (
              <div className="settings-row" key={key}>
                <label htmlFor={key}>{label}</label>
                <input
                  id={key}
                  className="input"
                  type="number"
                  min={1}
                  max={100000}
                  value={settings[key]}
                  onChange={(e) => change({ [key]: Number(e.target.value) })}
                />
              </div>
            ))}
            <h3 className="mt-6">Dina arbetsdagar</h3>
            <div className="days">
              {["Mån", "Tis", "Ons", "Tor", "Fre", "Lör", "Sön"].map(
                (day, i) => {
                  const n = (i + 1) % 7;
                  return (
                    <button
                      key={day}
                      aria-pressed={settings.preferredWorkingDays.includes(n)}
                      className={`day-btn ${settings.preferredWorkingDays.includes(n) ? "selected" : ""}`}
                      onClick={() =>
                        change({
                          preferredWorkingDays:
                            settings.preferredWorkingDays.includes(n)
                              ? settings.preferredWorkingDays.filter(
                                  (v) => v !== n,
                                )
                              : [...settings.preferredWorkingDays, n],
                        })
                      }
                    >
                      {day}
                    </button>
                  );
                },
              )}
            </div>
            <p className="footnote">
              Vilodagar bryter aldrig din streak. En arbetsdag räknas när du når
              ditt dagsmål.
            </p>
          </section>
          <section className="panel settings-section">
            <h2>Ringpass & utseende</h2>
            <p>Välj vad som dyker upp i din ringlista.</p>
            <div className="checkboxes">
              {statuses.map((s) => (
                <label key={s}>
                  <input
                    type="checkbox"
                    checked={settings.defaultStatuses.includes(s)}
                    onChange={() =>
                      change({
                        defaultStatuses: settings.defaultStatuses.includes(s)
                          ? settings.defaultStatuses.filter((x) => x !== s)
                          : [...settings.defaultStatuses, s],
                      })
                    }
                  />
                  {s}
                </label>
              ))}
            </div>
            <div className="settings-row">
              <label htmlFor="theme">Tema</label>
              <select
                id="theme"
                value={settings.theme}
                onChange={(e) =>
                  change({ theme: e.target.value as GoalSettings["theme"] })
                }
              >
                <option value="light">Ljust</option>
                <option value="dark">Mörkt</option>
                <option value="system">Följ systemet</option>
              </select>
            </div>
          </section>
        </div>
        <div className="stack">
          <section className="panel settings-section">
            <h2>Din data, nära till hands.</h2>
            <p>Importera nya möjligheter eller ta med dig dina leads.</p>
            <div className="settings-actions">
              <Button variant="secondary" onClick={onImport}>
                <Upload size={15} />
                Importera CSV eller Excel
              </Button>
              <Button
                variant="secondary"
                onClick={() => download(exportCSV(data), "callflow-leads.csv")}
              >
                <Download size={15} />
                Exportera leads till CSV
              </Button>
              <Button
                variant="secondary"
                onClick={() =>
                  download(
                    JSON.stringify(data, null, 2),
                    "callflow-backup.json",
                    "application/json",
                  )
                }
              >
                <FileJson size={15} />
                Hämta full säkerhetskopia
              </Button>
              <Button
                variant="secondary"
                onClick={() => restore.current?.click()}
              >
                <RotateCcw size={15} />
                Återställ säkerhetskopia
              </Button>
              <input
                ref={restore}
                className="sr-only"
                type="file"
                accept=".json"
                aria-label="Välj säkerhetskopia"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    if (f.size > 25 * 1024 * 1024)
                      throw new Error("Säkerhetskopian är större än 25 MB.");
                    const restored = validateData(JSON.parse(await f.text()));
                    if (
                      window.confirm(
                        `Ersätt all aktuell data med säkerhetskopians ${restored.leads.length} företag och ${restored.calls.length} samtal?`,
                      )
                    ) {
                      if (replace(restored)) {
                        setSettings(restored.settings);
                        setSaved(true);
                      }
                    }
                  } catch (err) {
                    setError(
                      "Säkerhetskopian kunde inte återställas: " +
                        (err as Error).message,
                    );
                  }
                  e.target.value = "";
                }}
              />
            </div>
            <p className="footnote">
              CSV-filen använder UTF-8 och semikolon för svensk Excel. En
              JSON-säkerhetskopia innehåller även samtal, ringpass,
              uppföljningar och XP.
            </p>
          </section>
          <section className="panel settings-section">
            <div className="flex mb-3">
              <ShieldCheck size={17} className="text-green" />
              <h2>{cloud ? "Supabase & privat" : "Lokalt & privat"}</h2>
            </div>
            <p>
              {cloud
                ? "Arbetsrummet sparas i Supabase med en lokal säkerhetskopia. Ändringar synkas mellan dina enheter och åtkomsten är begränsad till ditt konto."
                : "All data sparas i den här webbläsaren. Ta regelbundet en säkerhetskopia om du byter dator eller rensar webbläsardata."}
            </p>
            <div className="settings-row">
              <span className="text-xs muted">Företag</span>
              <strong className="text-xs">{data.leads.length}</strong>
            </div>
            <div className="settings-row">
              <span className="text-xs muted">Samtal</span>
              <strong className="text-xs">{data.calls.length}</strong>
            </div>
            <div className="settings-row">
              <span className="text-xs muted">Lokal kopia</span>
              <strong className="text-xs">
                {(new Blob([JSON.stringify(data)]).size / 1024).toFixed(1)} kB
              </strong>
            </div>
            {cloud && (
              <div className="settings-row">
                <span className="text-xs muted">Synkning</span>
                <span className="text-xs">
                  <SyncLabel />
                </span>
              </div>
            )}
            <div className="cloud-settings-account">
              {cloud ? (
                <>
                  <span className="text-xs muted">{userEmail}</span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => void signOut()}
                  >
                    <LogOut size={13} />
                    Logga ut
                  </Button>
                </>
              ) : (
                cloudConfigured() && (
                  <Button variant="secondary" onClick={activateCloud}>
                    <Cloud size={14} />
                    Anslut mitt Supabase-arbetsrum
                  </Button>
                )
              )}
            </div>
            {cloud &&
              repository instanceof CloudRepository &&
              localStorage.getItem(
                repository.cacheKey + ".conflict-backup",
              ) && (
                <Button
                  className="mt-4"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const backup = localStorage.getItem(
                      repository.cacheKey + ".conflict-backup",
                    );
                    if (backup)
                      download(
                        backup,
                        "callflow-konfliktkopior.json",
                        "application/json",
                      );
                  }}
                >
                  Hämta konfliktkopior
                </Button>
              )}
          </section>
          <section className="panel settings-section">
            <h2>En ny start</h2>
            <p>Hämta en säkerhetskopia innan du återställer data.</p>
            <div className="settings-actions">
              <Button
                variant="ghost"
                className="danger-text"
                onClick={() => {
                  if (
                    window.confirm(
                      "Radera ALLA företag, samtal, uppföljningar, ringpass och XP? Det går inte att ångra utan säkerhetskopia.",
                    )
                  ) {
                    const empty = { ...emptyData(), settings: data.settings };
                    replace(empty);
                  }
                }}
              >
                <Trash2 size={14} />
                Radera all data
              </Button>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
