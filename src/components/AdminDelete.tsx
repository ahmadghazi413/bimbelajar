import { useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";

export function AdminDelete({ name, description, onDelete }: { name: string; description: string; onDelete: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  async function remove() {
    setBusy(true);
    try { await onDelete(); setOpen(false); toast.success("Berhasil dihapus."); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Gagal menghapus."); }
    finally { setBusy(false); }
  }
  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild><Button variant="outline" size="icon" aria-label={`Hapus ${name}`} title={`Hapus ${name}`}><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
      <AlertDialogContent className="max-w-[calc(100%-2rem)] sm:max-w-lg">
        <AlertDialogHeader><AlertDialogTitle>Hapus {name}?</AlertDialogTitle><AlertDialogDescription>{description}</AlertDialogDescription></AlertDialogHeader>
        <AlertDialogFooter><AlertDialogCancel disabled={busy}>Batal</AlertDialogCancel><Button variant="destructive" disabled={busy} onClick={remove}>{busy ? "Menghapus..." : "Hapus permanen"}</Button></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}