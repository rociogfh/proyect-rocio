// src/App.tsx
import { useEffect, useState } from "react";
import "./App.css";

import type { Task } from "./db";
import { listLocalEntries, saveLocalEntry, queueOutbox } from "./db";

import { db } from "./firebase";
import { collection, addDoc } from "firebase/firestore";

import { askAndGetFcmToken } from "./push-fcm";

const VAPID = import.meta.env.VITE_FCM_VAPID as string | undefined;

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"Baja" | "Media" | "Alta">("Media");
  const [date, setDate] = useState("");
  const [online, setOnline] = useState(navigator.onLine);

  useEffect(() => {
    (async () => setTasks(await listLocalEntries()))();
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Task = {
      title,
      description,
      priority,
      due: date,
      createdAt: Date.now(),
    };

    // 1) Guarda local para que aparezca aunque recargues sin red
    await saveLocalEntry(payload);
    setTasks(await listLocalEntries());

    // 2) Si hay red, guarda en Firestore; si falla, encola
    if (navigator.onLine) {
      try {
        await addDoc(collection(db, "entries"), payload);
      } catch (e) {
        console.error("Firestore error -> encola:", e);
        await queueAndSync(payload);
      }
    } else {
      // 3) Offline: encola y registra Background Sync
      await queueAndSync(payload);
    }

    // (Opcional) Pide permiso de push la 1ª vez que el usuario crea algo
    if (Notification.permission === "default" && VAPID) {
      try {
        const token = await askAndGetFcmToken(VAPID);
        if (token) {
          console.log("🔑 FCM token:", token);
          localStorage.setItem("fcmToken", token);
          // Guarda el token para pruebas (puedes usar tu backend si quieres):
          await addDoc(collection(db, "devices"), { token, createdAt: Date.now() });
        }
      } catch {/* no-op */}
    }

    // Limpia formulario
    setTitle("");
    setDescription("");
    setPriority("Media");
    setDate("");
  }

  async function queueAndSync(payload: any) {
    await queueOutbox(payload);
    const reg = await navigator.serviceWorker.ready;

    // Background Sync si está soportado
    if ("SyncManager" in window) {
      const sync = (reg as any).sync as { register?: (tag: string) => Promise<void> } | undefined;
      if (sync?.register) {
        try {
          await sync.register("sync-entries");
        } catch (err) {
          console.warn("No se pudo registrar Background Sync:", err);
        }
      }
    }
  }

  async function enablePush() {
    if (!VAPID) {
      alert("Falta VITE_FCM_VAPID en .env");
      return;
    }
    const token = await askAndGetFcmToken(VAPID);
    if (!token) {
      alert("Permiso denegado o navegador no soportado");
      return;
    }

    console.log("🔑 FCM token:", token);
    localStorage.setItem("fcmToken", token);

    // Guarda el token en Firestore (o envíalo a tu backend si prefieres)
    try {
      await addDoc(collection(db, "devices"), { token, createdAt: Date.now() });
    } catch {/* no-op */}

    alert("Notificaciones habilitadas ✅ (revisa la consola para ver el token)");
  }

  return (
    <div className="page">
      <header className="top">
        <h1>Lista de tareas</h1>
        <span className={`pill ${online ? "ok" : "bad"}`}>
          {online ? "Online" : "Offline"}
        </span>
      </header>

      <section className="card">
        <h3>Tareas — Agregar nueva</h3>
        <form onSubmit={handleSubmit} className="form">
          <input
            placeholder="Título"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <textarea
            placeholder="Descripción"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="row">
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as any)}
            >
              <option>Baja</option>
              <option>Media</option>
              <option>Alta</option>
            </select>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>
          <button type="submit">Guardar tarea</button>
          <button type="button" className="ghost" onClick={enablePush}>
            Habilitar notificaciones
          </button>
        </form>
      </section>

      <section className="card">
        <h3>Tus tareas</h3>
        <ul className="list">
          {tasks.map((t) => (
            <li key={t.id}>
              <div>
                <strong>{t.title}</strong>
                {t.description && <div className="muted">{t.description}</div>}
              </div>
              <span className="badge">{t.priority ?? "Media"}</span>
            </li>
          ))}
          {tasks.length === 0 && <p className="muted">Aún no hay tareas.</p>}
        </ul>
      </section>
    </div>
  );
}
