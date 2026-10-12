import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CloudRepository,
  CloudTransport,
  ConflictError,
  RemoteDocument,
} from "../src/lib/cloud-repository";
import { emptyData, makeLead, Data } from "../src/lib/model";
import { logCall } from "../src/lib/engine";
function cache() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
function fixture(name = "Ångström") {
  const d = emptyData();
  d.leads.push(
    makeLead({
      companyName: name,
      phone: "0701234567",
      website: "",
      industry: "",
      city: "",
      contactName: "",
      notes: "",
      status: "Ej kontaktad",
    }),
  );
  return d;
}
function server() {
  let remote: RemoteDocument | null = null;
  let offline = false;
  const writes: number[] = [];
  const transport: CloudTransport = {
    async read() {
      if (offline) throw new Error("network");
      return remote ? structuredClone(remote) : null;
    },
    async write(document, revision) {
      if (offline) throw new Error("network");
      if (revision !== (remote?.revision ?? 0)) throw new ConflictError();
      writes.push(revision);
      remote = { document: structuredClone(document), revision: revision + 1 };
      return revision + 1;
    },
  };
  return {
    transport,
    writes,
    get remote() {
      return remote;
    },
    set offline(v: boolean) {
      offline = v;
    },
  };
}
afterEach(() => vi.useRealTimers());
describe("Supabase synkning", () => {
  it("saves a complete call/XP transaction and reads it on a second device", async () => {
    const db = server();
    const a = new CloudRepository(db.transport, cache(), "owner");
    await a.open();
    let d = fixture();
    d = logCall(d, {
      leadId: d.leads[0].id,
      outcome: "Kund",
      eventId: "event",
    }).data;
    a.save(d);
    await a.flush();
    expect(db.remote?.document.calls).toHaveLength(1);
    expect(db.remote?.document.xp.reduce((n, e) => n + e.points, 0)).toBe(105);
    expect(a.status).toBe("synced");
    const b = new CloudRepository(db.transport, cache(), "owner");
    expect(await b.open()).toEqual(d);
    a.dispose();
    b.dispose();
  });
  it("serializes edits made while an earlier write is in flight", async () => {
    let release!: () => void;
    let started!: () => void;
    const barrier = new Promise<void>((r) => (started = r)),
      wait = new Promise<void>((r) => (release = r));
    const db = server();
    let first = true;
    const transport = {
      ...db.transport,
      async write(d: Data, r: number) {
        if (first) {
          first = false;
          started();
          await wait;
        }
        return db.transport.write(d, r);
      },
    };
    const repo = new CloudRepository(transport, cache(), "owner");
    await repo.open();
    const d = fixture();
    repo.save(d);
    const syncing = repo.flush();
    await barrier;
    const edited = structuredClone(d);
    edited.leads[0].notes = "Ny anteckning ÅÄÖ";
    repo.save(edited);
    release();
    await syncing;
    expect(db.writes).toEqual([0, 1]);
    expect(db.remote?.document.leads[0].notes).toBe("Ny anteckning ÅÄÖ");
    expect(repo.dirty).toBe(false);
    repo.dispose();
  });
  it("keeps unsynced changes through an outage and refresh without duplicate XP", async () => {
    vi.useFakeTimers();
    const db = server(),
      disk = cache();
    const repo = new CloudRepository(db.transport, disk, "owner");
    await repo.open();
    db.offline = true;
    const d = fixture();
    const logged = logCall(d, {
      leadId: d.leads[0].id,
      outcome: "Möte bokat",
      eventId: "meeting",
    }).data;
    repo.save(logged);
    await repo.flush();
    expect(repo.status).toBe("offline");
    expect(repo.load()?.calls).toHaveLength(1);
    repo.dispose();
    const resumed = new CloudRepository(db.transport, disk, "owner");
    expect(await resumed.open()).toEqual(logged);
    db.offline = false;
    await resumed.flush();
    expect(db.remote?.document.xp.reduce((n, e) => n + e.points, 0)).toBe(35);
    expect(resumed.dirty).toBe(false);
    resumed.dispose();
  });
  it("detects conflicts and keeps both versions before explicit resolution", async () => {
    const db = server(),
      diskA = cache(),
      diskB = cache();
    const a = new CloudRepository(db.transport, diskA, "owner"),
      b = new CloudRepository(db.transport, diskB, "owner");
    await a.open();
    await b.open();
    a.save(fixture("Enhet A"));
    await a.flush();
    b.save(fixture("Enhet B"));
    await b.flush();
    expect(b.status).toBe("conflict");
    expect(db.remote?.document.leads[0].companyName).toBe("Enhet A");
    expect(b.load()?.leads[0].companyName).toBe("Enhet B");
    await b.resolveConflict("local");
    expect(db.remote?.document.leads[0].companyName).toBe("Enhet B");
    const backup = JSON.parse(diskB.getItem(b.cacheKey + ".conflict-backup")!);
    expect(backup.remote.document.leads[0].companyName).toBe("Enhet A");
    expect(backup.local.document.leads[0].companyName).toBe("Enhet B");
    a.dispose();
    b.dispose();
  });
  it("can choose the cloud version without deleting the local conflict copy", async () => {
    const db = server(),
      disk = cache();
    const a = new CloudRepository(db.transport, cache(), "owner"),
      b = new CloudRepository(db.transport, disk, "owner");
    await a.open();
    await b.open();
    a.save(fixture("Molnet"));
    await a.flush();
    b.save(fixture("Lokalt"));
    await b.flush();
    await b.resolveConflict("cloud");
    expect(b.load()?.leads[0].companyName).toBe("Molnet");
    expect(disk.getItem(b.cacheKey + ".conflict-backup")).toContain("Lokalt");
    expect(b.dirty).toBe(false);
    a.dispose();
    b.dispose();
  });
  it("recognizes a server write that succeeded before the response was lost", async () => {
    vi.useFakeTimers();
    const db = server(),
      disk = cache();
    let lose = true;
    const transport = {
      ...db.transport,
      async write(d: Data, r: number) {
        const revision = await db.transport.write(d, r);
        if (lose) {
          lose = false;
          throw new Error("response lost");
        }
        return revision;
      },
    };
    const a = new CloudRepository(transport, disk, "owner");
    await a.open();
    a.save(fixture());
    await a.flush();
    expect(a.status).toBe("offline");
    a.dispose();
    const b = new CloudRepository(db.transport, disk, "owner");
    await b.open();
    expect(b.status).toBe("synced");
    expect(b.revision).toBe(1);
    expect(db.writes).toHaveLength(1);
    b.dispose();
  });
  it("acknowledges committed data when JSONB returns object keys in a different order", async () => {
    vi.useFakeTimers();
    const db = server(),
      disk = cache();
    const reordered = {
      ...db.transport,
      async read() {
        const remote = await db.transport.read();
        if (!remote) return remote;
        const document = JSON.parse(
          JSON.stringify(remote.document, (_key, value) =>
            value && typeof value === "object" && !Array.isArray(value)
              ? Object.fromEntries(
                  Object.keys(value)
                    .sort()
                    .reverse()
                    .map((k) => [k, value[k]]),
                )
              : value,
          ),
        );
        return { ...remote, document };
      },
      async write(d: Data, revision: number) {
        await db.transport.write(d, revision);
        throw new Error("response lost");
      },
    };
    const a = new CloudRepository(reordered, disk, "owner");
    await a.open();
    a.save(fixture());
    await a.flush();
    a.dispose();
    const b = new CloudRepository(reordered, disk, "owner");
    await b.open();
    expect(b.status).toBe("synced");
    expect(db.writes).toHaveLength(1);
    b.dispose();
  });
  it("never overwrites corrupted cache or claims success when local persistence fails", async () => {
    const db = server(),
      disk = cache();
    const repo = new CloudRepository(db.transport, disk, "owner");
    await repo.open();
    disk.setItem(repo.cacheKey, "corrupt");
    expect(() => repo.save(fixture())).toThrow();
    expect(disk.getItem(repo.cacheKey)).toBe("corrupt");
    const bad = {
      getItem: () => null,
      setItem: () => {
        throw new Error("quota");
      },
    };
    const r = new CloudRepository(db.transport, bad, "owner");
    await expect(r.open()).rejects.toThrow("säkerhetskopian");
    expect(db.writes).toHaveLength(0);
    repo.dispose();
    r.dispose();
  });
  it("rejects a stale tab mutation instead of overwriting another tab draft", async () => {
    const db = server(),
      disk = cache();
    const a = new CloudRepository(db.transport, disk, "owner"),
      b = new CloudRepository(db.transport, disk, "owner");
    await a.open();
    await b.open();
    a.save(fixture("Nyare flik"));
    expect(() => b.save(fixture("Gammal flik"))).toThrow("annan flik");
    expect(b.load()?.leads[0].companyName).toBe("Nyare flik");
    await a.flush();
    await b.flush();
    expect(db.remote?.document.leads[0].companyName).toBe("Nyare flik");
    a.dispose();
    b.dispose();
  });
});
