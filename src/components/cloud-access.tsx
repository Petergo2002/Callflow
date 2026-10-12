"use client";
import { ReactNode, useState } from "react";
import {
  ArrowRight,
  Cloud,
  Download,
  KeyRound,
  Loader2,
  LogOut,
  Eye,
  EyeOff,
  Phone,
  ShieldCheck,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { supabaseClient } from "@/lib/supabase";
import { download } from "@/lib/import";
import { Button } from "./ui/button";
export function CloudAccess({ children }: { children: ReactNode }) {
  const store = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  if (!store.cloud) return children;
  if (store.authStatus === "ready" && !store.legacy) return children;
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      const { error } = await supabaseClient().auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error)
        throw new Error(
          error.status === 429
            ? "För många försök. Vänta en stund och försök igen."
            : error.code === "email_not_confirmed"
              ? "Kontot behöver bekräftas av administratören i Supabase Auth."
              : "Kunde inte logga in. Kontrollera mejladress och lösenord.",
        );
      setPassword("");
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const legacy = store.legacy;
  return (
    <main className="cloud-login">
      <section className="cloud-login-panel">
        <div className="flex between">
          <div className="brand text-green">
            <span className="brand-mark">
              <Phone size={15} />
            </span>
            CALLFLOW
          </div>
          <ShieldCheck size={21} className="text-green" />
        </div>
        {store.authStatus === "loading" ? (
          <div className="empty">
            <Loader2 size={26} className="animate-spin" />
            <h2>Öppnar ditt arbetsrum…</h2>
            <p>
              Kontrollerar din inloggning och hämtar dina sparade uppgifter.
            </p>
          </div>
        ) : legacy ? (
          <>
            <div className="eyebrow muted mt-8">
              Ditt arbetsrum, på fler enheter
            </div>
            <h1 className="mt-3">Ta med ditt momentum.</h1>
            <p className="muted mt-4 text-sm leading-7">
              På den här enheten finns {legacy.leads.length} företag,{" "}
              {legacy.calls.length} samtal och {legacy.followUps.length}{" "}
              uppföljningar. Din Supabase-databas är tom.
            </p>
            <p className="footnote">
              All historik, mål och XP följer med. Den gamla lokala kopian
              behålls som säkerhetskopia.
            </p>
            <div className="stack mt-6">
              <Button onClick={store.migrateLegacy}>
                <Cloud size={15} />
                Överför mitt lokala arbetsrum
                <ArrowRight size={14} />
              </Button>
              <Button variant="secondary" onClick={store.dismissLegacy}>
                Börja med ett tomt molnarbetsrum
              </Button>
              <Button
                variant="ghost"
                onClick={() =>
                  download(
                    JSON.stringify(legacy, null, 2),
                    "callflow-fore-molnflytt.json",
                    "application/json",
                  )
                }
              >
                <Download size={14} />
                Hämta säkerhetskopia först
              </Button>
            </div>
          </>
        ) : store.authStatus === "denied" ? (
          <>
            <h1 className="mt-8">Ett privat arbetsrum.</h1>
            <p className="muted mt-4 text-sm leading-7">
              Det här kontot har inte åtkomst. Logga ut och använd mejladressen
              som är kopplad till ditt CALLFLOW.
            </p>
            <Button className="mt-6" onClick={() => void store.signOut()}>
              <LogOut size={14} />
              Logga ut
            </Button>
          </>
        ) : (
          <>
            <div className="eyebrow muted mt-8">Ditt personliga arbetsrum</div>
            <h1 className="mt-3">Välkommen tillbaka.</h1>
            <p className="muted mt-4 text-sm leading-7">
              Logga in för att fortsätta med dina leads, samtal och
              uppföljningar.
            </p>
            <form className="stack mt-7" onSubmit={login}>
              <label className="form-field">
                Din mejladress
                <input
                  className="input"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="namn@exempel.se"
                />
              </label>
              <label className="form-field">
                Lösenord
                <span className="relative block">
                  <input
                    className="input pr-12 w-full"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Ditt lösenord"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 muted"
                    aria-label={
                      showPassword ? "Dölj lösenord" : "Visa lösenord"
                    }
                    aria-pressed={showPassword}
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </button>
                </span>
              </label>
              <Button disabled={busy} type="submit">
                {busy ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <KeyRound size={15} />
                )}
                {busy ? "Loggar in…" : "Logga in"}
                <ArrowRight size={14} />
              </Button>
            </form>
            <p className="footnote mt-6">
              Konton och lösenord hanteras av administratören. Kontakta
              administratören om du behöver hjälp att logga in.
            </p>
            <div className="cloud-login-footer">
              <span className="flex text-xs muted">
                <ShieldCheck size={13} />
                Endast ditt konto får åtkomst
              </span>
            </div>
          </>
        )}
        {(message || store.error) && (
          <div className="error-box" role="alert">
            {message || store.error}
          </div>
        )}
      </section>
      <p className="muted text-[10px] mt-5 text-center">
        CALLFLOW · En sak i taget. Ett samtal närmare.
      </p>
    </main>
  );
}
export function SyncNotice() {
  const store = useStore();
  if (
    !store.cloud ||
    store.syncStatus === "synced" ||
    store.syncStatus === "syncing"
  )
    return null;
  return (
    <div className="sync-notice" role="status">
      <div className="flex">
        <Cloud size={15} />
        <span>{store.syncMessage}</span>
      </div>
      <div className="flex">
        {store.syncStatus === "conflict" ? (
          <>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (
                  window.confirm(
                    "Hämta molnversionen? Dina aktuella lokala ändringar sparas först som konfliktkopia på den här enheten.",
                  )
                )
                  void store.resolveConflict("cloud");
              }}
            >
              Hämta molnversionen
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (
                  window.confirm(
                    "Ersätt molnversionen med din lokala version? Båda versionerna sparas först som konfliktkopia.",
                  )
                )
                  void store.resolveConflict("local");
              }}
            >
              Spara min version
            </Button>
          </>
        ) : (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void store.retrySync()}
          >
            Försök synka igen
          </Button>
        )}
        <Button
          size="sm"
          variant="ghost"
          onClick={() =>
            store.data &&
            download(
              JSON.stringify(store.data, null, 2),
              "callflow-lokala-andringar.json",
              "application/json",
            )
          }
        >
          <Download size={13} />
          Säkerhetskopia
        </Button>
      </div>
    </div>
  );
}
export function SyncLabel() {
  const s = useStore();
  const labels = {
    loading: "Hämtar arbetsrum",
    syncing: "Sparat lokalt · synkar…",
    synced: "Sparat i Supabase",
    offline: "Sparat lokalt · väntar på nätverk",
    conflict: "Sparat lokalt · versionskonflikt",
    error: "Sparat lokalt · synkfel",
  };
  return (
    <span className="flex gap-1.5">
      <span
        className={`status-dot ${s.cloud && s.syncStatus !== "synced" ? "status-pending" : ""}`}
      />
      {s.error
        ? "Ändring ej sparad"
        : s.cloud
          ? labels[s.syncStatus]
          : "Sparat lokalt"}
    </span>
  );
}
