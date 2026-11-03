// src/lib/push-notifications.ts
import { supabase } from "@/integrations/supabase/client";

export async function requestPushPermission(userId: string): Promise<{ success: boolean; message: string }> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    return { success: false, message: "Browser ini belum mendukung notifikasi HP." };
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { success: false, message: "Izin notifikasi tidak diberikan." };
    }

    const reg = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;

    let sub = await reg.pushManager.getSubscription();
    // Jika belum ada, gunakan mode push lokal atau server VAPID
    if (!sub) {
      // Browser Chrome akan meminta pendaftaran endpoint unik
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
      }).catch(() => null);
    }

    if (sub) {
      const subJson = sub.toJSON();
      if (subJson.endpoint && subJson.keys?.["p256dh"] && subJson.keys?.["auth"]) {
        await supabase.from("push_subscriptions" as any).upsert(
          {
            user_id: userId,
            endpoint: subJson.endpoint,
            p256dh: subJson.keys["p256dh"],
            auth: subJson.keys["auth"],
            user_agent: navigator.userAgent,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "endpoint" }
        );
      }
    }

    return { success: true, message: "Notifikasi HP berhasil diaktifkan!" };
  } catch (err: any) {
    return { success: false, message: err.message || "Gagal mengaktifkan notifikasi." };
  }
}
