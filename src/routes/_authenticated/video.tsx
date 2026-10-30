import { createFileRoute, redirect } from "@tanstack/react-router";

// Riwayat video sudah digabung ke menu Kelas Saya (di bawah tiap sesi).
export const Route = createFileRoute("/_authenticated/video")({
  beforeLoad: () => {
    throw redirect({ to: "/kelas-saya" });
  },
});
