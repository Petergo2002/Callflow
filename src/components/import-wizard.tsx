"use client";
import { useEffect, useRef, useState, useMemo } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  Upload,
  Loader2,
} from "lucide-react";
import {
  Mapping,
  Sheet,
  ImportField,
  DuplicateMode,
  ImportSummary,
  autoMapping,
  importFields,
  prepareImport,
  applyImportAsync,
  download,
} from "@/lib/import";
import { leadSources, formatImportDate } from "@/lib/model";
import { useStore } from "@/lib/store";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";

export function ImportWizard({
  onClose,
  onStart,
  initialGroupId = "",
}: {
  onClose: () => void;
  onStart: (batchId: string) => void;
  initialGroupId?: string;
}) {
  const { data, mutate } = useStore();
  const [step, setStep] = useState(0);
  const [source, setSource] = useState("");
  const [groupId, setGroupId] = useState(initialGroupId);
  const [groupName, setGroupName] = useState("");
  const [file, setFile] = useState<File>();
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [sheetIndex, setSheetIndex] = useState(-1);
  const [mapping, setMapping] = useState<Mapping>(autoMapping([]));
  const [mode, setMode] = useState<DuplicateMode>("skip");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [drag, setDrag] = useState(false);
  const [summary, setSummary] = useState<ImportSummary>();
  const worker = useRef<Worker | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const committing = useRef(false);
  const [progress, setProgress] = useState(0);
  useEffect(() => () => worker.current?.terminate(), []);
  const sheet = sheets[sheetIndex];
  const prepared = useMemo(
    () => (sheet && data ? prepareImport(sheet, mapping, data.leads) : []),
    [sheet, mapping, data],
  );
  const valid = prepared.filter((r) => r.input).length,
    duplicates = prepared.filter((r) => r.duplicateId).length,
    ambiguous = prepared.filter((r) => r.ambiguous).length;
  async function load(selected?: File) {
    if (!selected) return;
    setError("");
    setSummary(undefined);
    setSheets([]);
    setSheetIndex(-1);
    setProgress(0);
    if (!/\.(csv|xlsx)$/i.test(selected.name)) {
      setError("Välj en CSV-fil (.csv) eller en Excel-fil (.xlsx).");
      return;
    }
    if (selected.size > 20 * 1024 * 1024) {
      setError("Filen är större än 20 MB. Dela upp den i mindre filer.");
      return;
    }
    setFile(selected);
    setLoading(true);
    worker.current?.terminate();
    const w = new Worker(new URL("../lib/import.worker.ts", import.meta.url));
    worker.current = w;
    w.onmessage = (e: MessageEvent<{ sheets?: Sheet[]; error?: string }>) => {
      setLoading(false);
      if (e.data.error) setError(e.data.error);
      else if (e.data.sheets) {
        setSheets(e.data.sheets);
        if (e.data.sheets.length === 1) {
          setSheetIndex(0);
          setMapping(autoMapping(e.data.sheets[0].headers));
        }
      }
      w.terminate();
    };
    w.onerror = () => {
      setLoading(false);
      setError(
        "Filen kunde inte läsas. Kontrollera att filen är hel och försök igen.",
      );
      w.terminate();
    };
    try {
      const buffer = await selected.arrayBuffer();
      w.postMessage({ buffer, filename: selected.name }, [buffer]);
    } catch {
      setLoading(false);
      setError("Filen gick inte att öppna. Välj den igen.");
    }
  }
  async function commit() {
    if (committing.current || !file || !sheet || !data) return;
    if (groupId === "__new__" && !groupName.trim()) {
      setError("Ange ett namn på den nya gruppen.");
      return;
    }
    committing.current = true;
    setLoading(true);
    setError("");
    setProgress(0);
    const base = data;
    let imported;
    try {
      imported = await applyImportAsync(
        base,
        prepared,
        mode,
        file.name,
        (processed, total) =>
          setProgress(Math.round((processed / Math.max(total, 1)) * 95)),
        {
          source,
          groupId: groupId === "__new__" ? undefined : groupId,
          groupName: groupId === "__new__" ? groupName : undefined,
        },
      );
    } catch (e) {
      setError((e as Error).message);
      setLoading(false);
      committing.current = false;
      return;
    }
    const success = mutate((d) => {
      if (d !== base)
        throw new Error(
          "Datan ändrades i ett annat fönster. Granska importen igen och försök på nytt.",
        );
      return imported.data;
    });
    setProgress(success ? 100 : 0);
    setLoading(false);
    committing.current = false;
    if (success) {
      setSummary(imported.summary);
      setStep(4);
    } else
      setError(
        "Importen kunde inte sparas. Ingen rad lades till. Se lagringsfelet och försök igen.",
      );
  }
  const totalImport =
    valid -
    (mode === "skip"
      ? duplicates
      : mode === "update"
        ? prepared.filter((r) => r.duplicateId && r.ambiguous).length
        : 0);
  return (
    <Dialog
      open
      onOpenChange={(o) => {
        if (!o && !committing.current) onClose();
      }}
      title="Importera företag"
      description="Vi jämför med alla dina befintliga leads, oavsett grupp eller importlista."
      wide
    >
      <div className="wizard-steps">
        {["Ladda upp", "Kolumner", "Förhandsvisa", "Dubbletter"].map(
          (label, i) => (
            <div
              key={label}
              className={`wizard-step ${step >= i ? "active" : ""}`}
            >
              <span>{step > i ? "✓" : i + 1}</span>
              {label}
            </div>
          ),
        )}
      </div>
      {step === 0 && (
        <>
          <div
            className={`dropzone ${drag ? "drag" : ""}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              void load(e.dataTransfer.files[0]);
            }}
          >
            <Upload size={30} strokeWidth={1.4} />
            <h3>Dra din fil hit</h3>
            <p>CSV eller Excel · högst 20 MB / 50 000 rader</p>
            <Button
              variant="secondary"
              onClick={() => fileInput.current?.click()}
            >
              <FileSpreadsheet size={15} />
              Välj fil
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,.xlsx"
              className="sr-only"
              aria-label="Välj importfil"
              onChange={(e) => void load(e.target.files?.[0])}
            />
          </div>
          {loading && (
            <p className="flex muted mt-4 text-xs">
              <Loader2 className="animate-spin" size={15} />
              Läser fil i bakgrunden…
            </p>
          )}
          {file && sheets.length > 0 && (
            <div className="file-info mt-4">
              <div className="flex">
                <FileSpreadsheet size={20} />
                <div>
                  {file.name}
                  <p className="muted text-xs mt-1">
                    {(file.size / 1024).toFixed(1)} kB{" "}
                    {sheet
                      ? `· ${sheet.rows.length.toLocaleString("sv-SE")} rader`
                      : `· ${sheets.length} kalkylblad`}
                  </p>
                </div>
              </div>
              <CheckCircle2 size={18} className="text-green" />
            </div>
          )}
          {sheets.length > 1 && (
            <label className="form-field mt-4">
              Välj kalkylblad
              <select
                value={sheetIndex}
                onChange={(e) => {
                  const index = Number(e.target.value);
                  setSheetIndex(index);
                  if (index >= 0)
                    setMapping(autoMapping(sheets[index].headers));
                }}
              >
                <option value={-1}>Välj ett blad för import</option>
                {sheets.map((s, i) => (
                  <option key={s.name} value={i}>
                    {s.name} · {s.rows.length} rader
                  </option>
                ))}
              </select>
            </label>
          )}
        </>
      )}
      {step === 1 && sheet && (
        <>
          <div className="file-info">
            <span>
              {file?.name} · {sheet.name}
            </span>
            <span className="muted">{sheet.rows.length} rader</span>
          </div>
          <p className="muted text-xs mb-5">
            Vi har föreslagit kolumner. Kontrollera att varje fält pekar på rätt
            kolumn. Okända kolumner ignoreras.
          </p>
          <div className="mapping-grid">
            {(Object.keys(importFields) as ImportField[]).map((field) => (
              <label className="form-field" key={field}>
                {importFields[field]}
                {field === "companyName" ? " *" : ""}
                <select
                  value={mapping[field]}
                  onChange={(e) =>
                    setMapping({ ...mapping, [field]: Number(e.target.value) })
                  }
                >
                  <option value={-1}>Ignorera / saknas</option>
                  {sheet.headers.map((h, i) => (
                    <option key={i} value={i}>
                      {h}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <p className="footnote">
            Telefonnummer behandlas som text. Företagsnamn är det enda
            obligatoriska fältet.
          </p>
          {sheet.warnings.map((w) => (
            <div className="warning" key={w}>
              {w}
            </div>
          ))}
        </>
      )}
      {step === 2 && sheet && (
        <>
          <div className="import-counts">
            <div>
              <strong>{valid}</strong>Giltiga rader
            </div>
            <div>
              <strong>{prepared.length - valid}</strong>Ogiltiga rader
            </div>
            <div>
              <strong>
                {prepared.filter((r) => r.input && !r.input.phone).length}
              </strong>
              Saknar telefon
            </div>
            <div>
              <strong>{duplicates}</strong>Möjliga dubbletter
            </div>
          </div>
          <div className="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Rad</th>
                  <th>Företagsnamn</th>
                  <th>Telefon</th>
                  <th>Hemsida</th>
                  <th>Kontroll</th>
                </tr>
              </thead>
              <tbody>
                {prepared.slice(0, 15).map((r) => (
                  <tr key={r.row}>
                    <td>{r.row}</td>
                    <td>
                      {r.input?.companyName ||
                        sheet.rows[r.row - 2][mapping.companyName]}
                    </td>
                    <td>{r.input?.phone || "—"}</td>
                    <td>{r.input?.website || "—"}</td>
                    <td>
                      <span
                        className={`badge ${r.reason ? "badge-red" : r.duplicateId ? "badge-orange" : "badge-green"}`}
                      >
                        {r.reason ||
                          (r.ambiguous
                            ? "Tvetydig träff"
                            : r.duplicateId
                              ? "Dubblett"
                              : "Giltig")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="footnote">
            Visar de första 15 raderna. {valid} företag kan behandlas. Rader
            utan telefon kan importeras men behöver kompletteras innan du
            ringer.
          </p>
        </>
      )}
      {step === 3 && (
        <>
          <section className="import-organization">
            <h3>Ge listan ett sammanhang</h3>
            <p className="footnote">
              Importdatum sparas automatiskt. Välj källa och grupp för att hitta
              rätt företag senare.
            </p>
            <div className="form-grid">
              <label className="form-field">
                Källa för importen
                <input
                  className="input"
                  list="import-source-options"
                  maxLength={100}
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                  placeholder="Google Maps, Instagram eller egen källa"
                />
                <datalist id="import-source-options">
                  {leadSources.map((s) => (
                    <option key={s} value={s} />
                  ))}
                </datalist>
              </label>
              <label className="form-field">
                Grupp för importen
                <select
                  value={groupId}
                  onChange={(e) => setGroupId(e.target.value)}
                >
                  <option value="">Utan grupp</option>
                  {data?.groups.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                  <option value="__new__">＋ Skapa en ny grupp</option>
                </select>
              </label>
              {groupId === "__new__" && (
                <label className="form-field full">
                  Namn på ny grupp
                  <input
                    className="input"
                    value={groupName}
                    required
                    maxLength={80}
                    onChange={(e) => setGroupName(e.target.value)}
                    placeholder="Till exempel Instagram · Stockholm"
                  />
                </label>
              )}
            </div>
            <p className="footnote">
              En mappad Källa-kolumn i filen används för respektive rad. Valet
              ovan används där kolumnen är tom.
            </p>
          </section>
          <h3>
            {duplicates
              ? `${duplicates} möjliga dubbletter hittades`
              : "Inga dubbletter hittades"}
          </h3>
          <p className="footnote">
            Vi jämför normaliserade telefonnummer, domäner och exakta
            företagsnamn. Liknande namn slås aldrig ihop automatiskt.
          </p>
          {(
            [
              [
                "skip",
                "Hoppa över dubbletter",
                "Behåll befintlig data. Rekommenderat för nya listor.",
              ],
              [
                "update",
                "Uppdatera matchande företag",
                "Uppdatera kontaktuppgifter för tydliga träffar. Nya anteckningar läggs till. Status, historik och uppföljningar bevaras.",
              ],
              [
                "separate",
                "Importera som separata företag",
                "Skapar dubbletter med egen historik. Använd bara för avsiktligt separata företag. Ringkön skyddar fortfarande mot samma nummer flera gånger idag.",
              ],
            ] as const
          ).map(([value, title, description]) => (
            <label className="radio-option" key={value}>
              <input
                type="radio"
                name="duplicates"
                checked={mode === value}
                onChange={() => setMode(value)}
              />
              <div>
                <strong className="text-xs">{title}</strong>
                <p>{description}</p>
              </div>
            </label>
          ))}
          {ambiguous > 0 && (
            <div className="warning">
              {ambiguous} tvetydiga träffar. Dessa hoppas över vid uppdatering.
              Granska företag manuellt eller välj separat import.
            </div>
          )}
          <p className="footnote">
            {totalImport} rader behandlas. {prepared.length - valid} ogiltiga
            rader avvisas.
          </p>
          {loading && (
            <div className="stack">
              <div className="progress">
                <div
                  className="progress-fill"
                  style={{ width: progress + "%" }}
                />
              </div>
              <span className="muted text-xs">
                Validerar och sparar hela importen…
              </span>
            </div>
          )}
        </>
      )}
      {step === 4 && summary && (
        <>
          <div className="summary-success">
            <CheckCircle2 size={37} strokeWidth={1.4} />
            <h2>Din nästa ringlista är redo.</h2>
            <p>
              {summary.imported} företag importerades. {summary.updated}{" "}
              uppdaterades.
              <br />
              {summary.skipped} dubbletter hoppades över. {summary.rejected}{" "}
              rader kunde inte importeras.
            </p>
          </div>
          <p className="footnote">
            Importerad{" "}
            {formatImportDate(
              data?.batches.find((b) => b.id === summary.batchId)?.importedAt,
              true,
            )}
            {source ? ` · ${source}` : ""}
          </p>
          {summary.reasons.length > 0 && (
            <>
              <div className="flex between mb-3">
                <h3>Överhoppade rader</h3>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    download(
                      summary.reasons.join("\r\n"),
                      "callflow-importrapport.txt",
                      "text/plain;charset=utf-8",
                    )
                  }
                >
                  Hämta rapport
                </Button>
              </div>
              <div className="reasons">
                {summary.reasons.slice(0, 100).map((r, i) => (
                  <p key={i}>{r}</p>
                ))}
                {summary.reasons.length > 100 && (
                  <p>
                    Hämta rapporten för alla {summary.reasons.length} rader.
                  </p>
                )}
              </div>
            </>
          )}
        </>
      )}
      {error && (
        <div className="error-box" role="alert">
          {error}
        </div>
      )}
      <div className="dialog-footer">
        {step > 0 && step < 4 && (
          <Button
            variant="secondary"
            disabled={loading}
            onClick={() => setStep(step - 1)}
          >
            <ArrowLeft size={14} />
            Tillbaka
          </Button>
        )}
        {step < 3 ? (
          <Button
            disabled={
              loading ||
              (step === 0 && !sheet) ||
              (step === 1 && mapping.companyName < 0) ||
              (step === 2 && !valid)
            }
            onClick={() => setStep(step + 1)}
          >
            Fortsätt
            <ArrowRight size={14} />
          </Button>
        ) : step === 3 ? (
          <Button disabled={loading || !valid} onClick={() => void commit()}>
            {loading ? "Sparar…" : "Importera företag"}
            <ArrowRight size={14} />
          </Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>
              Visa leads
            </Button>
            <Button
              disabled={!summary || summary.imported + summary.updated === 0}
              onClick={() => summary && onStart(summary.batchId)}
            >
              Starta ringpass
              <ArrowRight size={14} />
            </Button>
          </>
        )}
      </div>
    </Dialog>
  );
}
