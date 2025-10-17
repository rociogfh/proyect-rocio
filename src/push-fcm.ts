// src/push-fcm.ts
import { app } from "./firebase";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

/**
 * Pide permiso y devuelve el token FCM (o null).
 * Debes pasar la clave VAPID pública (VITE_FCM_VAPID).
 */
export async function askAndGetFcmToken(vapidPublicKey: string) {
  const supported = await isSupported().catch(() => false);
  if (!supported) {
    console.warn("FCM no soportado en este navegador");
    return null;
  }

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return null;

  const messaging = getMessaging(app);
  const token = await getToken(messaging, { vapidKey: vapidPublicKey });
  return token; // ← ESTE es tu token
}
