// src/db.ts
import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "TasksDB";
const DB_VERSION = 1;

export type Task = {
  id?: number;
  title: string;
  description?: string;
  priority?: "Baja" | "Media" | "Alta";
  due?: string;          // ISO yyyy-mm-dd
  createdAt?: number;    // Date.now() (si no usas serverTimestamp en Firestore)
};

// Define el esquema de IndexedDB
interface DBSchema extends Record<string, unknown> {
  entries: {
    key: number;
    value: Task;
  };
  outbox: {
    key: number;
    value: any; // payloads pendientes de sync
  };
}

let _db: IDBPDatabase<DBSchema> | undefined;

async function db() {
  if (_db) return _db;
  _db = await openDB<DBSchema>(DB_NAME, DB_VERSION, {
    upgrade(d) {
      if (!d.objectStoreNames.contains("entries")) {
        d.createObjectStore("entries", { keyPath: "id", autoIncrement: true });
      }
      if (!d.objectStoreNames.contains("outbox")) {
        d.createObjectStore("outbox", { keyPath: "id", autoIncrement: true });
      }
    },
  });
  return _db;
}

export async function saveLocalEntry(t: Task) {
  const d = await db();
  await d.add("entries", { ...t, createdAt: Date.now() });
}

export async function listLocalEntries(): Promise<Task[]> {
  const d = await db();
  return d.getAll("entries");
}

export async function queueOutbox(payload: any) {
  const d = await db();
  await d.add("outbox", { ...payload, queuedAt: Date.now() });
}

export async function getOutbox(): Promise<any[]> {
  const d = await db();
  return d.getAll("outbox");
}

export async function deleteOutboxId(id: number) {
  const d = await db();
  await d.delete("outbox", id);
}
