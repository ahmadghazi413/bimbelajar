import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { requestPushPermission } from "@/lib/push-notifications";

export function NotificationModal() {
  const { session } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Hanya periksa jika user sudah login
    if (!session?.user?.id) return;

    // Periksa apakah browser mendukung Web Notification
    if (!("Notification" in window)) return;

    // Jika izin belum pernah diminta (masih 'default')
    if (Notification.permission === "default") {
      const dismissed = localStorage.getItem("dismissed_push_modal");
      const oneDay = 24 * 60 * 60 * 1000;

      // Tampilkan popup jika belum pernah ditutup atau sudah lewat 1 hari
      if (!dismissed || Date.now() - Number(dismissed) > oneDay) {
        const timer = setTimeout(() => setOpen(true), 1500); // Muncul anggun setelah 1.5 detik
        return () => clearTimeout(timer);
      }
    }
  }, [session?.user?.id]);

  async function handleAllow() {
    if (!session?.user?.id) return;
    setLoading(true);
    const res = await requestPushPermission(session.user.id);
    setLoading(false);

    if (res.success) {
      toast.success(res.message);
      setOpen(false);
    } else {
      toast.error(res.message);
      setOpen(false);
    }
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
          <DialogTitle className="text-xl font-semibold">
            Jangan Tertinggal Info & Jadwal Kelas!
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-sm pt-1">
            Aktifkan notifikasi agar Anda selalu mendapat pengingat jadwal Zoom, rekaman video baru, dan pengumuman penting langsung di layar HP Anda.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-4 flex flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            className="w-full sm:w-auto"
            onClick={handleDismiss}
            disabled={loading}
          >
            Nanti Saja
          </Button>
          <Button
            type="button"
            variant="hero"
            className="w-full sm:w-auto"
            onClick={handleAllow}
            disabled={loading}
          >
            {loading ? "Memproses..." : "Aktifkan Notifikasi"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
