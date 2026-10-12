"use client";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { Data, emptyData } from "./model";
import { demoData } from "./demo";
import { LocalStorageRepository, Repository, STORAGE_KEY } from "./repository";
import { changeSession } from "./engine";
import { CloudRepository, SyncStatus, transportFor } from "./cloud-repository";
import { cloudConfigured, supabaseClient } from "./supabase";
interface Store {
  data: Data | null;
  error: string;
  setError: (v: string) => void;
  mutate: (fn: (data: Data) => Data) => boolean;
  replace: (data: Data) => boolean;
  repository: Repository;
  cloud: boolean;
  authStatus: "loading" | "signed-out" | "denied" | "ready";
  userEmail: string;
  syncStatus: SyncStatus;
  syncMessage: string;
  legacy: Data | null;
  activateCloud: () => void;
  openLocal: () => void;
  signOut: () => Promise<void>;
  retrySync: () => Promise<void>;
  resolveConflict: (choice: "local" | "cloud") => Promise<void>;
  migrateLegacy: () => void;
  dismissLegacy: () => void;
}
const Context = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data | null>(null),
    ref = useRef<Data | null>(null);
  const [error, setError] = useState("");
  const [localRepository] = useState(() => new LocalStorageRepository());
  const repositoryRef = useRef<Repository>(localRepository);
  const [repository, setRepository] = useState<Repository>(localRepository);
  const [localMode, setLocalMode] = useState(() => !cloudConfigured());
  const [authStatus, setAuthStatus] = useState<Store["authStatus"]>("loading");
  const [userEmail, setUserEmail] = useState("");
  const [syncStatus, setSyncStatus] = useState<SyncStatus>("loading");
  const [syncMessage, setSyncMessage] = useState("");
  const [legacy, setLegacy] = useState<Data | null>(null);
  const pathname = usePathname();
  const wasFocus = useRef(false);
  const cloud = !localMode;
  useEffect(() => {
    let stopped = false;
    let cloudRepository: CloudRepository | undefined;
    let userId = "";
    let booting = false;
    const show = (next: Data) => {
      if (stopped) return;
      ref.current = next;
      setData(next);
    };
    const configure = (repo: Repository) => {
      repositoryRef.current = repo;
      setRepository(repo);
    };
    const localLoad = () => {
      try {
        const loaded = localRepository.load();
        let next = loaded ?? demoData();
        const active = next.sessions.find((s) => s.status === "active");
        if (active && window.location.pathname !== "/focus")
          next = changeSession(next, active.id, "paused");
        if (!loaded || next !== loaded) localRepository.save(next);
        configure(localRepository);
        show(next);
        setAuthStatus("ready");
        setSyncStatus("synced");
        setError("");
      } catch (e) {
        setError((e as Error).message);
        setAuthStatus("ready");
      }
    };
    async function connect() {
      if (booting || stopped) return;
      booting = true;
      try {
        const client = supabaseClient();
        const {
          data: { user },
          error: authError,
        } = await client.auth.getUser();
        if (stopped) return;
        if (authError || !user) {
          cloudRepository?.dispose();
          userId = "";
          ref.current = null;
          setData(null);
          setAuthStatus("signed-out");
          return;
        }
        if (userId === user.id && cloudRepository) return;
        setAuthStatus("loading");
        cloudRepository?.dispose();
        setUserEmail(user.email ?? "");
        const { data: access, error: accessError } = await client
          .from("callflow_access")
          .select("email")
          .maybeSingle();
        if (stopped) return;
        if (accessError || !access) {
          ref.current = null;
          setData(null);
          setAuthStatus("denied");
          setError("Det här kontot har inte åtkomst till CALLFLOW.");
          return;
        }
        const repo = new CloudRepository(
          transportFor(user.id),
          localStorage,
          user.id,
          (status, message, next) => {
            if (stopped) return;
            setSyncStatus(status);
            setSyncMessage(message);
            if (next) show(next);
          },
        );
        cloudRepository = repo;
        configure(repo);
        const next = await repo.open();
        if (stopped) {
          repo.dispose();
          return;
        }
        userId = user.id;
        show(next);
        setAuthStatus("ready");
        setError("");
        if (repo.revision === 0) {
          let hasLegacy = false;
          try {
            const candidate = localRepository.load();
            if (
              candidate &&
              (candidate.leads.length ||
                candidate.calls.length ||
                candidate.sessions.length)
            ) {
              setLegacy(candidate);
              hasLegacy = true;
            }
          } catch {
            /* Damaged legacy storage is preserved for manual recovery. */
          }
          if (!hasLegacy && !repo.dirty) repo.save(next);
        }
      } catch (e) {
        if (!stopped) {
          setError((e as Error).message);
          setAuthStatus("signed-out");
        }
      } finally {
        booting = false;
      }
    }
    let unsubscribe: () => void = () => {};
    if (localMode) {
      localLoad();
    } else {
      const client = supabaseClient();
      const { data: listener } = client.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") {
          cloudRepository?.dispose();
          userId = "";
          ref.current = null;
          setData(null);
          setLegacy(null);
          setAuthStatus("signed-out");
        } else if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")
          queueMicrotask(() => void connect());
      });
      unsubscribe = () => listener.subscription.unsubscribe();
      void connect();
    }
    const onStorage = (e: StorageEvent) => {
      if (localMode && e.key === STORAGE_KEY) localLoad();
      else if (cloudRepository && e.key === cloudRepository.cacheKey) {
        try {
          cloudRepository.adoptCache();
        } catch (e) {
          setError((e as Error).message);
        }
      }
    };
    const refresh = () => {
      if (cloudRepository) void cloudRepository.refresh();
    };
    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        if (localMode) localLoad();
        else refresh();
      }
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("online", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", onPageShow);
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, 30000);
    return () => {
      stopped = true;
      unsubscribe();
      cloudRepository?.dispose();
      clearInterval(poll);
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("online", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [localMode, localRepository]);
  useEffect(() => {
    if (pathname === "/focus") {
      wasFocus.current = true;
      return;
    }
    const active = ref.current?.sessions.find((s) => s.status === "active");
    if (wasFocus.current && active && ref.current) {
      try {
        const paused = changeSession(ref.current, active.id, "paused");
        repositoryRef.current.save(paused);
        ref.current = paused;
        setData(paused);
      } catch (e) {
        setError((e as Error).message);
      }
    }
    wasFocus.current = false;
  }, [pathname]);
  useEffect(() => {
    const pause = () => {
      if (window.location.pathname !== "/focus") return;
      const active = ref.current?.sessions.find((s) => s.status === "active");
      if (active && ref.current) {
        try {
          const paused = changeSession(ref.current, active.id, "paused");
          repositoryRef.current.save(paused);
          ref.current = paused;
        } catch {
          /* Last persisted snapshot stays intact. */
        }
      }
    };
    window.addEventListener("pagehide", pause);
    return () => window.removeEventListener("pagehide", pause);
  }, []);
  useEffect(() => {
    if (!data) return;
    const q = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      document.documentElement.classList.toggle(
        "dark",
        data.settings.theme === "dark" ||
          (data.settings.theme === "system" && q.matches),
      );
    apply();
    q.addEventListener("change", apply);
    return () => q.removeEventListener("change", apply);
  }, [data]);
  function replace(next: Data) {
    try {
      repositoryRef.current.save(next);
      ref.current = next;
      setData(next);
      setError("");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }
  function mutate(fn: (d: Data) => Data) {
    try {
      if (!ref.current) return false;
      return replace(fn(ref.current));
    } catch (e) {
      setError((e as Error).message);
      return false;
    }
  }
  async function signOut() {
    try {
      const repo = repositoryRef.current;
      if (repo instanceof CloudRepository) {
        await repo.flush();
        if (
          repo.dirty &&
          !window.confirm(
            "Ändringar väntar på synkning. Den lokala kopian behålls för nästa inloggning. Logga ut ändå?",
          )
        )
          return;
      }
      const { error } = await supabaseClient().auth.signOut({ scope: "local" });
      if (error) throw error;
    } catch {
      setError("Utloggningen kunde inte slutföras. Försök igen.");
    }
  }
  async function retrySync() {
    try {
      const repo = repositoryRef.current;
      if (repo instanceof CloudRepository) {
        await repo.refresh();
      } else if (cloud) {
        const { data } = await supabaseClient().auth.refreshSession();
        if (!data.session) setAuthStatus("signed-out");
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }
  async function resolveConflict(choice: "local" | "cloud") {
    try {
      const repo = repositoryRef.current;
      if (repo instanceof CloudRepository) await repo.resolveConflict(choice);
    } catch (e) {
      setError((e as Error).message);
    }
  }
  function migrateLegacy() {
    if (legacy && replace(legacy)) setLegacy(null);
  }
  function dismissLegacy() {
    if (replace(ref.current ?? emptyData())) setLegacy(null);
  }
  function changeMode(local: boolean) {
    const active = ref.current?.sessions.find((s) => s.status === "active");
    if (active && ref.current)
      replace(changeSession(ref.current, active.id, "paused"));
    ref.current = null;
    setData(null);
    setError("");
    setLegacy(null);
    setAuthStatus("loading");
    setLocalMode(local);
  }
  return (
    <Context.Provider
      value={{
        data,
        error,
        setError,
        mutate,
        replace,
        repository,
        cloud,
        authStatus,
        userEmail,
        syncStatus,
        syncMessage,
        legacy,
        activateCloud: () => changeMode(false),
        openLocal: () => changeMode(true),
        signOut,
        retrySync,
        resolveConflict,
        migrateLegacy,
        dismissLegacy,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const store = useContext(Context);
  if (!store) throw new Error("Store saknas");
  return store;
}
