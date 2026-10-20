import { describe, expect, it } from "vitest";
import { classesInSubject } from "@/lib/class-management";

describe("Ilmu → kelas", () => {
  const classes = [{ id: "besar", subject_id: "tahsin" }, { id: "bahasa", subject_id: "bahasa" }, { id: "tanpa", subject_id: null }];
  it("only shows classes belonging to the selected ilmu", () => {
    expect(classesInSubject(classes, "tahsin").map((c) => c.id)).toEqual(["besar"]);
    expect(classesInSubject(classes, "bahasa").map((c) => c.id)).toEqual(["bahasa"]);
    expect(classesInSubject(classes, "")).toEqual([]);
  });
});