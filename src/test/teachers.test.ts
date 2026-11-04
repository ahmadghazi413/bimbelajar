import { describe, expect, it } from "vitest";
import { teacherHasClass, type Teacher } from "@/lib/teachers";
const base: Teacher = { id: "t", name: "Guru", email: "guru@example.test", createdAt: "" };
describe("teacher assignments", () => {
  it("allows all classes when allClasses is checked", () => {
    expect(teacherHasClass({ ...base, allClasses: true, classIds: [] }, "kelas-1")).toBe(true);
    expect(teacherHasClass({ ...base, allClasses: true, classIds: [] }, "kelas-2")).toBe(true);
  });
  it("allows only checked classes", () => {
    expect(teacherHasClass({ ...base, classIds: ["kelas-1"] }, "kelas-1")).toBe(true);
    expect(teacherHasClass({ ...base, classIds: ["kelas-1"] }, "kelas-2")).toBe(false);
  });
  it("does not treat an empty checklist as all classes", () => {
    expect(teacherHasClass({ ...base, classIds: [] }, "kelas-1")).toBe(false);
  });
});