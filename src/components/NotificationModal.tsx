import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { requestPushPermission } from "@/lib/push-notifications";

/** Popup izin notifikasi — ditampilkan di Beranda saat pertama dibuka. */
export function NotificationModal() {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;
    const dismissed = localStorage.getItem("dismissed_push_modal");
    if (dismissed && Date.now() - Number(dismissed) < 24 * 60 * 60 * 1000) return;
    const t = setTimeout(() => setOpen(true), 1000);
    return () => clearTimeout(t);
  }, []);

  // Jika izin sudah diberikan saat belum login, simpan perangkat setelah login.
  useEffect(() => {
    if (userId && "Notification" in window && Notification.permission === "granted") {
      requestPushPermission(userId).catch(() => {});
    }
  }, [userId]);

  async function handleAllow() {
    setLoading(true);
    if (userId) {
      const res = await requestPushPermission(userId);
      res.success ? toast.success(res.message) : toast.error(res.message);
    } else {
      const p = await Notification.requestPermission();
      p === "granted"
        ? toast.success("Notifikasi diizinkan! Masuk ke akun agar info kelas Anda terkirim.")
        : toast.error("Izin notifikasi tidak diberikan.");
    }
    setLoading(false);
    setOpen(false);
  }

  function handleDismiss() {
    localStorage.setItem("dismissed_push_modal", String(Date.now()));
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleDismiss()}>
      <DialogContent className="sm:max-w-md rounded-3xl p-6">
        <DialogHeader className="text-center sm:text-left">
          <div className="mx-auto sm:mx-0 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary mb-2">
            <Bell className="h-6 w-6" />
          </div>
          <DialogTitle className="text-xl font-semibold">Jangan Tertinggal Info & Jadwal Kelas!</DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm pt-1">
            Izinkan notifikasi agar Anda selalu mendapat pengingat jadwal kelas, masa paket yang hampir berakhir, dan pengumuman penting langsung di HP Anda.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-4 flex flex-col sm:flex-row gap-2">
          <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={handleDismiss} disabled={loading}>
            Nanti Saja
          </Button>
          <Button type="button" variant="hero" className="w-full sm:w-auto" onClick={handleAllow} disabled={loading}>
            {loading ? "Memproses..." : "Setuju, Aktifkan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
