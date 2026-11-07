import { describe, expect, it } from "vitest";
import { getPackagePrice, monthlyChoices, packageCounts, packageLabel, startingPrice } from "@/lib/package-prices";
import { formatSchedule, parseSchedule } from "@/lib/schedule";

const kelas = {
  allowed_packages: ["monthly", "session"],
  package_prices: {
    monthly: { "1": { normal: 50000, promo: 40000 }, "2": { normal: 100000, promo: 70000 }, "3": { normal: 150000, promo: 0 } },
    session: { "4": { normal: 60000, promo: 0 }, "8": { normal: 100000, promo: 90000 } },
  },
};

describe("harga per paket", () => {
  it("tiap paket punya harga sendiri, bukan kelipatan", () => {
    expect(getPackagePrice(kelas, "monthly", 1).final).toBe(40000);
    expect(getPackagePrice(kelas, "monthly", 2).final).toBe(70000);
    expect(getPackagePrice(kelas, "monthly", 3).final).toBe(150000);
    expect(getPackagePrice(kelas, "session", 8)).toMatchObject({ normal: 100000, final: 90000, hasPromo: true });
  });
  it("promo yang tidak lebih murah dari normal diabaikan", () => {
    expect(getPackagePrice({ price_normal: 50, price_promo: 99, price: 50 }, "monthly", 1).hasPromo).toBe(false);
  });
  it("kelas lama tanpa tabel memakai harga satuan x jumlah", () => {
    expect(getPackagePrice({ price: 40000, price_normal: 40000 }, "monthly", 2).final).toBe(80000);
  });
  it("daftar paket dan harga mulai dari", () => {
    expect(packageCounts(kelas, "monthly")).toEqual([1, 2, 3]);
    expect(startingPrice(kelas)).toMatchObject({ final: 40000, label: "1 bulan" });
  });
});

describe("satuan paket", () => {
  it("label mengikuti satuan kelas", () => {
    expect(packageLabel("monthly", 2, 4)).toBe("2 bulan");
    expect(packageLabel("monthly", 2, 1)).toBe("2 minggu");
    expect(packageLabel("monthly", 1, 2)).toBe("2 minggu");
  });
  it("satuan mingguan dibatasi maksimal 3 minggu", () => {
    expect(monthlyChoices(1)).toEqual([1, 2, 3]);
    expect(monthlyChoices(2)).toEqual([1]);
    expect(monthlyChoices(4)).toEqual([1, 2, 3, 6, 12]);
  });
});

describe("jadwal", () => {
  it("format berurutan lalu bisa dibaca kembali", () => {
    const text = formatSchedule([{ day: "Rabu", start: "19:30", end: "21:00" }, { day: "Senin", start: "08:00", end: "09:30" }]);
    expect(text).toBe("Senin 08:00–09:30 WIB, Rabu 19:30–21:00 WIB");
    expect(parseSchedule(text)).toHaveLength(2);
  });
  it("teks jadwal lama yang bebas tidak terbaca", () => {
    expect(parseSchedule("Senin & Rabu malam")).toEqual([]);
  });
});
