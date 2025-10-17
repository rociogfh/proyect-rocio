// src/App.tsx
import { useEffect, useState } from "react";
import "./App.css";

import type { Task } from "./db";
import { listLocalEntries, saveLocalEntry, queueOutbox } from "./db";

import { db } from "./firebase";
import { collection, addDoc } from "firebase/firestore";

import { askAndGetFcmToken } from "./push-fcm";

const VAPID = import.meta.env.VITE_FCM_VAPID as string | undefined;
const HAS_PUSH = "serviceWorker" in navigator && "PushManager" in window;

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"Baja" | "Media" | "Alta">("Media");
  const [date, setDate] = useState("");
  const [online, setOnline] = useState(navigator.onLine);

  // Carga inicial + estado online/offline
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

  // Si ya hay permiso concedido, intenta suscribir automáticamente (cuando hay VAPID)
  useEffect(() => {
    (async () => {
      if (!VAPID || !HAS_PUSH) return;
      try {
        await navigator.serviceWorker?.ready;
        if (Notification.permission === "granted") {
          const token = await askAndGetFcmToken(VAPID);
          if (token) {
            console.log("🔑 FCM token:", token);
            localStorage.setItem("fcmToken", token);
            try {
              await addDoc(collection(db, "devices"), { token, createdAt: Date.now() });
            } catch {}
          }
        }
      } catch (e) {
        console.warn("Auto-subscribe push failed:", e);
      }
    })();
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

    // 1) Guarda local
    await saveLocalEntry(payload);
    setTasks(await listLocalEntries());

    // 2) Si hay red → Firestore; si falla → outbox
    if (navigator.onLine) {
      try {
        await addDoc(collection(db, "entries"), payload);
      } catch (e) {
        console.error("Firestore error -> encola:", e);
        await queueAndSync(payload);
      }
    } else {
      await queueAndSync(payload);
    }

    // (Opcional) La primera vez que el usuario crea algo, pide permiso de push
    if (Notification.permission === "default" && VAPID && HAS_PUSH) {
      try {
        const token = await askAndGetFcmToken(VAPID);
        if (token) {
          console.log("🔑 FCM token:", token);
          localStorage.setItem("fcmToken", token);
          try {
            await addDoc(collection(db, "devices"), { token, createdAt: Date.now() });
          } catch {}
        }
      } catch {}
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
    if (!HAS_PUSH) return alert("Tu navegador no soporta notificaciones Push.");
    if (!VAPID) return alert("Falta la variable VITE_FCM_VAPID en el entorno.");

    const token = await askAndGetFcmToken(VAPID);
    if (!token) {
      alert("Permiso denegado o no se pudo obtener el token.");
      return;
    }
    console.log("🔑 FCM token:", token);
    localStorage.setItem("fcmToken", token);
    try {
      await addDoc(collection(db, "devices"), { token, createdAt: Date.now() });
    } catch {}
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

          {/* Botón Push sólo si hay soporte y VAPID */}
          {HAS_PUSH && VAPID ? (
            <button type="button" className="ghost" onClick={enablePush}>
              Habilitar notificaciones
            </button>
          ) : (
            <span className="muted" style={{ marginLeft: 8 }}>
              {HAS_PUSH
                ? "Configura VITE_FCM_VAPID para habilitar notificaciones."
                : "Tu navegador no soporta Push."}
            </span>
          )}
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
