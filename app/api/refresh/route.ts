import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { ensureSchema } from "@/lib/sql";
import { sql } from "@vercel/postgres";
import { parseYearText } from "@/lib/parseYear";

export const runtime = "nodejs";

const URLS = [
  { adapter: "ALL-CAN300", url: "https://wiki.teltonika-gps.com/images/5/59/ALLCAN-300_List_2025_12_16.xlsx" },
  { adapter: "LV-CAN200",  url: "https://wiki.teltonika-gps.com/images/3/33/LV-CAN200_List_2025-12-16.xlsx" }
];

function normalizeHeader(s:any){ return String(s ?? "").trim(); }

export async function GET() {
  await ensureSchema();

  let total = 0;

  for (const item of URLS) {
    const res = await fetch(item.url, { cache: "no-store" });
    if (!res.ok) continue;
    const ab = await res.arrayBuffer();
    const wb = XLSX.read(ab, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows:any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true });

    // Wiki file layout: first row is header labels, then blank, then data (similar to your uploaded file)
    const header = rows[0].map(normalizeHeader);
    const dataRows = rows.slice(2);

    const idxBrand = header.findIndex(h => h.toLowerCase() === "brand");
    const idxModel = header.findIndex(h => h.toLowerCase() === "model");
    const idxYear  = header.findIndex(h => h.toLowerCase() === "year");
    const idxBuses = header.findIndex(h => h.toLowerCase().includes("number of can buses"));
    const idxFlags = header.findIndex(h => h.toLowerCase() === "flags" || h.toLowerCase().endsWith("flags"));

    if (idxBrand < 0 || idxModel < 0) continue;

    // Clear old rows for adapter
    await sql`DELETE FROM can_vehicle_compat WHERE adapter=${item.adapter};`;

    for (const r of dataRows) {
      const brand = String(r[idxBrand] ?? "").trim().toUpperCase();
      const model = String(r[idxModel] ?? "").trim().toUpperCase();
      if (!brand || !model) continue;

      const yearRaw = (idxYear >= 0) ? r[idxYear] : null;
      const { year_text, year_min, year_max, open_ended } = parseYearText(yearRaw);

      const can_buses = (idxBuses >= 0 && r[idxBuses] != null && r[idxBuses] !== "") ? Number(r[idxBuses]) : null;
      const flags = (idxFlags >= 0 && r[idxFlags] != null && String(r[idxFlags]).trim() !== "") ? String(r[idxFlags]).trim() : null;

      await sql`
        INSERT INTO can_vehicle_compat (adapter, brand, model, year_text, year_min, year_max, open_ended, can_buses, flags)
        VALUES (${item.adapter}, ${brand}, ${model}, ${year_text}, ${year_min}, ${year_max}, ${open_ended}, ${can_buses}, ${flags});
      `;
      total++;
    }
  }

  return NextResponse.json({ ok: true, totalLoaded: total, adapters: URLS.map(x=>x.adapter) });
}
