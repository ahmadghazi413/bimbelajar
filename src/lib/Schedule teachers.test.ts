import { describe, expect, it } from "vitest";
import { classHasTeacher, classTeacherIds, removeTeacherUpdate, slotsForSave, slotsOf } from "@/lib/schedule";

const kelas = {
  schedule_slots: [
    { day: "Jumat", start: "19:30", end: "20:30", teacherId: "A" },
    { day: "Ahad", start: "09:00", end: "10:00", teacherId: "B" },
  ],
  teacher_id: "A",
};

describe("pengajar per hari", () => {
  it("mengenali semua pengajar kelas, termasuk yang bukan pengajar utama", () => {
    expect(classTeacherIds(kelas)).toEqual(["A", "B"]);
    expect(classHasTeacher(kelas, "B")).toBe(true);
    expect(classHasTeacher(kelas, "Z")).toBe(false);
  });
  it("kelas lama memakai pengajar lama untuk semua hari", () => {
    expect(slotsOf({ schedule: "Jumat 19:30–20:30 WIB", teacher_id: "A" })).toEqual([{ day: "Jumat", start: "19:30", end: "20:30", teacherId: "A" }]);
    expect(classTeacherIds({ schedule: "Jumat malam", teacher_id: "A" })).toEqual(["A"]);
  });
  it("menghapus pengajar menyisakan pengajar lain sebagai pengajar utama", () => {
    expect(removeTeacherUpdate(kelas, "A")).toEqual({
      schedule_slots: [{ day: "Jumat", start: "19:30", end: "20:30" }, { day: "Ahad", start: "09:00", end: "10:00", teacherId: "B" }],
      teacher_id: "B",
    });
    expect(removeTeacherUpdate(kelas, "Z")).toBeNull();
  });
  it("jadwal tersimpan urut menurut hari", () => {
    expect(slotsForSave([{ day: "Ahad", start: "09:00", end: "10:00" }, { day: "Jumat", start: "19:30", end: "20:30" }]).map((s) => s.day)).toEqual(["Jumat", "Ahad"]);
  });
});
