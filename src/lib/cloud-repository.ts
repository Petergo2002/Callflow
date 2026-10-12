import { Data, emptyData } from "./model";
import { Repository, validateData } from "./repository";
import { PROJECT_REF, supabaseClient } from "./supabase";
export type SyncStatus =
  "loading" | "syncing" | "synced" | "offline" | "conflict" | "error";
export interface RemoteDocument {
  document: Data;
  revision: number;
}
export class ConflictError extends Error {
  constructor() {
    super(
      "Arbetsrummet har ändrats på en annan enhet. Dina lokala ändringar är kvar.",
    );
  }
}
export interface CloudTransport {
  read(): Promise<RemoteDocument | null>;
  write(document: Data, revision: number): Promise<number>;
}
export interface Cache {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
interface Envelope extends RemoteDocument {
  dirty: boolean;
}
export function transportFor(ownerId: string): CloudTransport {
  const client = supabaseClient();
  return {
    async read() {
      const { data, error } = await client
        .rpc("callflow_read_workspace")
        .maybeSingle()
        .overrideTypes<
          { document: unknown; revision: number },
          { merge: false }
        >();
      if (error) throw error;
      return data
        ? {
            document: validateData(data.document),
            revision: Number(data.revision),
          }
        : null;
    },
    async write(document, revision) {
      const next = revision + 1;
      const query =
        revision === 0
          ? client
              .from("callflow_workspaces")
              .insert({ owner_id: ownerId, document, revision: next })
          : client
              .from("callflow_workspaces")
              .update({ document, revision: next })
              .eq("owner_id", ownerId)
              .eq("revision", revision);
      const { data, error } = await query.select("revision").maybeSingle();
      if (error?.code === "23505" || (!error && !data))
        throw new ConflictError();
      if (error) throw error;
      return Number(data!.revision);
    },
  };
}
export class CloudRepository implements Repository {
  readonly cacheKey: string;
  status: SyncStatus = "loading";
  message = "";
  private state: Envelope | null = null;
  private generation = 0;
  private syncing: Promise<void> | null = null;
  private disposed = false;
  private retryTimer?: ReturnType<typeof setTimeout>;
  private retries = 0;
  private needsInitialChoice = false;
  constructor(
    private transport: CloudTransport,
    private cache: Cache,
    ownerId: string,
    private listener: (
      status: SyncStatus,
      message: string,
      document?: Data,
    ) => void = () => {},
  ) {
    this.cacheKey = `callflow.cloud.${PROJECT_REF}.${ownerId}`;
  }
  private emit(status: SyncStatus, message = "", document?: Data) {
    if (this.disposed) return;
    this.status = status;
    this.message = message;
    this.listener(status, message, document);
  }
  private cacheState(state: Envelope) {
    try {
      this.cache.setItem(this.cacheKey, JSON.stringify(state));
    } catch {
      throw new Error(
        "Den lokala säkerhetskopian kunde inte sparas. Frigör webbläsarlagring innan du fortsätter.",
      );
    }
  }
  private cached(): Envelope | null {
    const raw = this.cache.getItem(this.cacheKey);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (
        !Number.isSafeInteger(parsed.revision) ||
        parsed.revision < 0 ||
        typeof parsed.dirty !== "boolean"
      )
        throw new Error();
      return { ...parsed, document: validateData(parsed.document) };
    } catch {
      throw new Error(
        "Den lokala molnkopian kunde inte läsas. Originalet är kvar. Hämta en säkerhetskopia.",
      );
    }
  }
  async open() {
    const cached = this.cached();
    let remote: RemoteDocument | null;
    try {
      remote = await this.transport.read();
    } catch {
      if (!cached)
        throw new Error(
          "Supabase kunde inte nås och ingen lokal kopia finns på den här enheten. Försök igen när du har anslutning.",
        );
      this.state = cached;
      this.emit(
        "offline",
        "Supabase kunde inte nås. Din lokala kopia är kvar.",
      );
      if (cached.dirty) this.scheduleRetry();
      return cached.document;
    }
    if (cached?.dirty) {
      if (
        remote &&
        JSON.stringify(remote.document) === JSON.stringify(cached.document)
      ) {
        this.state = { ...remote, dirty: false };
        this.cacheState(this.state);
        this.emit("synced");
      } else if ((remote?.revision ?? 0) !== cached.revision) {
        this.state = cached;
        this.emit("conflict", new ConflictError().message);
      } else {
        this.state = cached;
        void this.flush();
      }
    } else {
      this.needsInitialChoice = !remote && !cached;
      this.state = {
        ...(remote ?? cached ?? { document: emptyData(), revision: 0 }),
        dirty: false,
      };
      this.cacheState(this.state);
      this.emit("synced");
    }
    return this.state!.document;
  }
  get initialChoice() {
    return this.needsInitialChoice;
  }
  get dirty() {
    return this.state?.dirty ?? false;
  }
  get revision() {
    return this.state?.revision ?? 0;
  }
  load() {
    return this.state?.document ?? null;
  }
  raw() {
    const raw = this.cache.getItem(this.cacheKey);
    if (!raw) return null;
    try {
      return JSON.stringify(JSON.parse(raw).document);
    } catch {
      return raw;
    }
  }
  save(document: Data) {
    if (!this.state) throw new Error("Arbetsrummet är inte inläst ännu.");
    const cached = this.cached();
    if (cached && JSON.stringify(cached) !== JSON.stringify(this.state)) {
      this.adoptCache();
      throw new Error(
        "Arbetsrummet ändrades i en annan flik. Senaste versionen har lästs in; prova ändringen igen.",
      );
    }
    const next = {
      ...this.state,
      document: validateData(document),
      dirty: true,
    };
    this.cacheState(next);
    this.state = next;
    this.generation++;
    this.needsInitialChoice = false;
    if (this.status !== "conflict") {
      this.emit("syncing");
      queueMicrotask(() => void this.flush());
    }
  }
  private scheduleRetry() {
    if (this.retryTimer || this.disposed) return;
    const delay = Math.min(30000, 1000 * 2 ** Math.min(this.retries++, 5));
    this.retryTimer = setTimeout(() => {
      this.retryTimer = undefined;
      void this.flush();
    }, delay);
  }
  async flush(): Promise<void> {
    if (this.disposed || this.status === "conflict") return;
    if (this.syncing) return this.syncing;
    this.syncing = this.syncLoop();
    try {
      await this.syncing;
    } finally {
      this.syncing = null;
      if (this.dirty && this.status === "syncing" && !this.disposed)
        queueMicrotask(() => void this.flush());
    }
  }
  private async syncLoop() {
    while (this.state?.dirty && !this.disposed) {
      const snapshot = this.state,
        generation = this.generation;
      this.emit("syncing");
      try {
        let revision: number;
        try {
          revision = await this.transport.write(
            snapshot.document,
            snapshot.revision,
          );
        } catch (e) {
          if (!(e instanceof ConflictError)) throw e;
          const remote = await this.transport.read();
          if (
            remote &&
            JSON.stringify(remote.document) ===
              JSON.stringify(snapshot.document)
          )
            revision = remote.revision;
          else throw e;
        }
        const next = {
          ...this.state,
          revision: Math.max(revision, this.state.revision),
          dirty: this.generation !== generation,
        };
        this.cacheState(next);
        this.state = next;
        this.retries = 0;
        if (!next.dirty) this.emit("synced");
      } catch (e) {
        if (e instanceof ConflictError) {
          this.emit("conflict", e.message);
          return;
        }
        const code = (e as { code?: string }).code;
        const blocked = [
          "42501",
          "PGRST301",
          "PGRST302",
          "22023",
          "23514",
        ].includes(code ?? "");
        this.emit(
          blocked ? "error" : "offline",
          blocked
            ? "Supabase nekade ändringen. Dina uppgifter är sparade lokalt; kontrollera inloggningen och försök igen."
            : "Sparat på den här enheten. Väntar på anslutning till Supabase.",
        );
        if (!blocked) this.scheduleRetry();
        return;
      }
    }
  }
  async refresh() {
    if (this.dirty) return this.flush();
    if (this.syncing || this.disposed) return;
    const generation = this.generation;
    try {
      const remote = await this.transport.read();
      if (this.generation !== generation || this.dirty) return;
      if (remote && remote.revision !== this.state?.revision) {
        this.cacheState({ ...remote, dirty: false });
        this.state = { ...remote, dirty: false };
        this.emit("synced", "", remote.document);
      } else this.emit("synced");
    } catch {
      this.emit(
        "offline",
        "Din lokala kopia är kvar. Supabase kunde inte nås.",
      );
    }
  }
  adoptCache() {
    const cached = this.cached();
    if (!cached || JSON.stringify(cached) === JSON.stringify(this.state))
      return;
    this.state = cached;
    this.generation++;
    this.emit(cached.dirty ? "syncing" : "synced", "", cached.document);
    if (cached.dirty) void this.flush();
  }
  async resolveConflict(choice: "cloud" | "local") {
    if (!this.state) return;
    const generation = this.generation;
    const remote = await this.transport.read();
    if (this.generation !== generation)
      throw new Error("Nya lokala ändringar tillkom. Försök igen.");
    this.cache.setItem(
      this.cacheKey + ".conflict-backup",
      JSON.stringify({ local: this.state, remote }),
    );
    if (choice === "cloud") {
      if (!remote)
        throw new Error("Molnversionen saknas. Din lokala kopia är kvar.");
      const next = { ...remote, dirty: false };
      this.cacheState(next);
      this.state = next;
      this.generation++;
      this.emit("synced", "", next.document);
    } else {
      const next = { ...this.state, revision: remote?.revision ?? 0 };
      this.cacheState(next);
      this.state = next;
      this.emit("syncing");
      await this.flush();
    }
  }
  dispose() {
    this.disposed = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
  }
}
