\
import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { recommend } from "@/lib/recommend";
import { getWikimediaThumb, deviceImageUrl } from "@/lib/images";

export const runtime = "nodejs";

function normalizeHeader(h: string) {
  return h.toLowerCase().replace(/\s+/g, " ").trim();
}
function findCol(headers: string[], targets: string[]) {
  const norm = headers.map((h) => ({ raw: h, n: normalizeHeader(h) }));
  const tnorm = targets.map((t) => normalizeHeader(t));
  for (const t of tnorm) {
    const hit = norm.find((x) => x.n === t);
    if (hit) return hit.raw;
  }
  for (const t of tnorm) {
    const hit = norm.find((x) => x.n.includes(t) || t.includes(x.n));
    if (hit) return hit.raw;
  }
  return null;
}
function toInt(v:any){
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}
function detectFromArabicDescription(desc: string) {
  const d = (desc || "").toLowerCase();
  const makeMap: Array<[RegExp, string]> = [
    [/ايسوزو|isuzu/i, "ISUZU"],
    [/مرسيدس|mercedes|m-?benz/i, "MERCEDES-BENZ"],
    [/شاكمان|shacman/i, "SHACMAN"],
    [/سينوتراك|sinotruk|howo/i, "SINOTRUK"],
    [/تويوتا|toyota/i, "TOYOTA"],
    [/هيونداي|hyundai/i, "HYUNDAI"],
  ];
  let make = "";
  for (const [rx, val] of makeMap) if (rx.test(d)) { make = val; break; }

  let model = "";
  const modelMap: Array<[RegExp, string]> = [
    [/actros/i, "ACTROS"],
    [/npr/i, "NPR"],
    [/x3000/i, "X3000"],
    [/howo/i, "HOWO"],
    [/camry/i, "CAMRY"],
    [/staria/i, "STARIA"],
  ];
  for (const [rx, val] of modelMap) if (rx.test(d)) { model = val; break; }

  const heavy = /قلاب|شاحنة|دينا|تريلا|تريله|رأس|راس|قاطرة|سكس|معدات|حفار|ونش|باص|اتوبيس/i.test(d);
  const category = heavy ? "HEAVY" : "";
  return { make, model, category };
}
function addDaysISO(iso: string, days: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0,10);
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const lang = (form.get("lang") as string | null) ?? "ar";
  const optionsRaw = (form.get("options") as string | null) ?? "{}";
  const opt = JSON.parse(optionsRaw);

  if (!file) return new NextResponse("Missing file", { status: 400 });

  const ab = await file.arrayBuffer();
  const wb = XLSX.read(ab, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[];
  if (!json.length) return new NextResponse("Empty sheet", { status: 400 });

  const headers = Object.keys(json[0]).map(String);
  const colLoc = findCol(headers, ["location","site","الموقع","المـــــــوقع"]);
  const colOwner = findCol(headers, ["owner","المالك"]);
  const colDesc = findCol(headers, ["description","details","note","البيان","البيـــــــــان","البيـــــــــان "]);
  const colCat = findCol(headers, ["category","vehicle category","cat","الفئة","تصنيف","نوع","category"]);
  const colMake = findCol(headers, ["manufacturer","make","brand","الشركة","المصنع","الماركة","manufacturer"]);
  const colModel = findCol(headers, ["model","vehicle model","الموديل","طراز","model"]);
  const colYear = findCol(headers, ["model year","year","سنة الصنع","ســنة الصنــــع","السنة"]);
  const colPlate = findCol(headers, ["plate no","plate","license","registration","رقم اللوحة","اللوحة"]);

  const groupBy = (opt.planBy === "owner" ? (colOwner || colLoc) : (colLoc || colOwner));

  // Build recommendation rows
  const outRows:any[] = [];
  for (const r of json) {
    let category = colCat ? String(r[colCat] ?? "") : "";
    let make = colMake ? String(r[colMake] ?? "") : "";
    let model = colModel ? String(r[colModel] ?? "") : "";
    const year = colYear ? toInt(r[colYear]) : undefined;
    const desc = colDesc ? String(r[colDesc] ?? "") : "";

    if ((!make || !model || !category) && desc) {
      const d = detectFromArabicDescription(desc);
      make = make || d.make;
      model = model || d.model;
      category = category || d.category;
    }

    const rec = await recommend(category, make, model, year);
    const vehicleQuery = `${make} ${model}`.trim();
    const vehicleImg = vehicleQuery ? await getWikimediaThumb(vehicleQuery) : null;
    const devicePage = deviceImageUrl(rec.recommendedDevice);

    outRows.push({
      ...r,
      "__group": groupBy ? String(r[groupBy] ?? "") : "DEFAULT",
      "Recommended Teltonika Device": rec.recommendedDevice,
      "CAN Accessory": rec.canAccessory,
      "Supported CAN Adapters": rec.supportedAdapters,
      "All Compatible Options": rec.allOptions,
      "Rule Used": rec.rule,
      "Device Page URL": devicePage ?? "",
      "Vehicle Image URL": vehicleImg ?? ""
    });
  }

  const includePlan = !!opt.includePlan;
  const includeCost = !!opt.includeCost;

  const techCount = Math.max(1, Number(opt.techCount || 1));
  const hoursPerDay = Math.max(1, Number(opt.hoursPerDay || 8));
  const minutesPerVehicle = Math.max(10, Number(opt.installsPerVehicleMinutes || 35));
  const startDate = String(opt.startDate || new Date().toISOString().slice(0,10));
  const minutesPerDayTeam = techCount * hoursPerDay * 60;

  // group counts
  const byGroup = new Map<string, any>();
  for (const r of outRows) {
    const g = (r["__group"] || "DEFAULT").toString().trim() || "DEFAULT";
    const dev = r["Recommended Teltonika Device"];
    if (!byGroup.has(g)) byGroup.set(g, { group: g, count: 0, devices: {}, minutes: 0 });
    const o = byGroup.get(g);
    o.count += 1;
    o.devices[dev] = (o.devices[dev] || 0) + 1;
  }

  const groups = Array.from(byGroup.values()).sort((a,b)=>b.count-a.count);
  let dayCursor = 0;
  const planRows:any[] = [];
  for (const g of groups) {
    g.minutes = g.count * minutesPerVehicle;
    const days = Math.max(1, Math.ceil(g.minutes / minutesPerDayTeam));
    const dateFrom = addDaysISO(startDate, dayCursor);
    const dateTo = addDaysISO(startDate, dayCursor + days - 1);
    planRows.push({
      "Region/Group": g.group,
      "Vehicles": g.count,
      "Est. Minutes": g.minutes,
      "Team Capacity/Day (min)": minutesPerDayTeam,
      "Est. Days": days,
      "Start": dateFrom,
      "End": dateTo,
      "Device Mix": Object.entries(g.devices).map(([k,v])=>`${k}:${v}`).join(" | ")
    });
    dayCursor += days;
  }
  const totalDays = planRows.reduce((s,r)=>s + Number(r["Est. Days"]||0), 0);

  // Costs
  const kmPerDay = Math.max(0, Number(opt.kmPerDay || 0));
  const fuelPrice = Math.max(0, Number(opt.fuelPrice || 0));
  const litersPer100 = Math.max(0, Number(opt.fuelLitersPer100km || 0));
  const technicianDailyCost = Math.max(0, Number(opt.technicianDailyCost || 0));
  const perDiemDaily = Math.max(0, Number(opt.perDiemDaily || 0));
  const hotelCostPerNight = Math.max(0, Number(opt.hotelCostPerNight || 0));
  const hotelNightsPerDay = Math.max(0, Number(opt.hotelNightsPerDay || 0));

  const fuelLitersPerDay = (kmPerDay * litersPer100) / 100.0;
  const fuelCostPerDay = fuelLitersPerDay * fuelPrice;
  const techCostPerDay = techCount * technicianDailyCost;
  const perDiemCostPerDay = techCount * perDiemDaily;
  const hotelCostPerDay = hotelCostPerNight * hotelNightsPerDay;
  const totalCostPerDay = fuelCostPerDay + techCostPerDay + perDiemCostPerDay + hotelCostPerDay;
  const totalCost = totalCostPerDay * totalDays;

  const costRows = [
    {"Item":"Total Days", "Value": totalDays},
    {"Item":"Technicians", "Value": techCount},
    {"Item":"Minutes/Vehicle", "Value": minutesPerVehicle},
    {"Item":"KM/Day (assumption)", "Value": kmPerDay},
    {"Item":"Fuel L/100km", "Value": litersPer100},
    {"Item":"Fuel Price", "Value": fuelPrice},
    {"Item":"Fuel Cost/Day", "Value": fuelCostPerDay},
    {"Item":"Tech Cost/Day", "Value": techCostPerDay},
    {"Item":"Per Diem/Day", "Value": perDiemCostPerDay},
    {"Item":"Hotel Cost/Day", "Value": hotelCostPerDay},
    {"Item":"TOTAL Cost/Day", "Value": totalCostPerDay},
    {"Item":"TOTAL Cost", "Value": totalCost},
  ];

  // Excel output
  const outWb = new ExcelJS.Workbook();

  if (opt.includeRecommendations !== false) {
    const sheet = outWb.addWorksheet("Recommendations");
    sheet.columns = Object.keys(outRows[0]).filter(k=>k!=="__group").map((k) => ({ header: k, key: k, width: Math.min(42, Math.max(14, k.length + 2)) }));
    outRows.forEach(r => {
      const rr = {...r};
      delete rr["__group"];
      sheet.addRow(rr);
    });
    const urlCols = ["Device Page URL", "Vehicle Image URL"];
    for (const colName of urlCols) {
      const idx = sheet.columns.findIndex(c => c.header === colName) + 1;
      if (idx > 0) {
        sheet.getColumn(idx).eachCell((cell, rowNumber) => {
          if (rowNumber === 1) return;
          const v = String(cell.value ?? "");
          if (v.startsWith("http")) cell.value = { text: "open", hyperlink: v };
        });
      }
    }
  }

  if (includePlan && planRows.length) {
    const p = outWb.addWorksheet("Installation Plan");
    p.columns = Object.keys(planRows[0]).map((k) => ({ header: k, key: k, width: 22 }));
    planRows.forEach(r => p.addRow(r));
  }

  if (includeCost) {
    const c = outWb.addWorksheet("Cost Summary");
    c.columns = [{header:"Item", key:"Item", width:32}, {header:"Value", key:"Value", width:20}];
    costRows.forEach(r => c.addRow(r));
  }

  const excelBuf = await outWb.xlsx.writeBuffer();

  // PDF
  let pdfBytes: Uint8Array | null = null;
  if (opt.includePdf !== false) {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

    const title = lang === "ar" ? "ALRAKEEN | خطة تركيب وتوصية أجهزة Teltonika CAN" : "ALRAKEEN | Teltonika CAN Recommendation + Installation Plan";
    page.drawText(title, { x: 40, y: 800, size: 16, font: bold, color: rgb(0.12,0.27,0.95) });

    const counts = outRows.reduce((acc:any, r:any) => {
      const d = r["Recommended Teltonika Device"];
      acc[d] = (acc[d] || 0) + 1;
      return acc;
    }, {});

    let y = 775;
    page.drawText((lang==="ar" ? "ملخص:" : "Summary:"), { x: 40, y, size: 11, font: bold });
    y -= 16;
    for (const [k,v] of Object.entries(counts)) {
      page.drawText(`${k}: ${v}`, { x: 40, y, size: 10, font });
      y -= 14;
    }

    if (includePlan) {
      y -= 6;
      page.drawText((lang==="ar" ? "خطة التركيب (Top 10):" : "Installation plan (Top 10):"), { x: 40, y, size: 11, font: bold });
      y -= 16;
      for (const r of planRows.slice(0, 10)) {
        const line = `${r["Region/Group"]} | Vehicles:${r["Vehicles"]} | Days:${r["Est. Days"]} | ${r["Start"]}→${r["End"]}`;
        if (y < 70) break;
        page.drawText(line.slice(0, 120), { x: 40, y, size: 9, font });
        y -= 12;
      }
      page.drawText((lang==="ar" ? `إجمالي الأيام: ${totalDays}` : `Total days: ${totalDays}`), { x: 40, y: 60, size: 10, font: bold });
      y = 46;
    }

    if (includeCost) {
      page.drawText((lang==="ar" ? "تكاليف (تقديرية):" : "Costs (estimate):"), { x: 320, y: 260, size: 11, font: bold });
      const lines = [
        `Fuel/day: ${fuelCostPerDay.toFixed(2)}`,
        `Tech/day: ${techCostPerDay.toFixed(2)}`,
        `PerDiem/day: ${perDiemCostPerDay.toFixed(2)}`,
        `Hotel/day: ${hotelCostPerDay.toFixed(2)}`,
        `TOTAL/day: ${totalCostPerDay.toFixed(2)}`,
        `TOTAL: ${totalCost.toFixed(2)}`
      ];
      let yy = 240;
      for (const ln of lines) {
        page.drawText(ln, { x: 320, y: yy, size: 10, font });
        yy -= 14;
      }
      page.drawText((lang==="ar" ? "ملاحظة: التكاليف حسب افتراضاتك في الواجهة." : "Note: Costs are based on your UI assumptions."), { x: 40, y: 30, size: 9, font, color: rgb(0.4,0.4,0.4) });
    }

    pdfBytes = await pdf.save();
  }

  const zip = new JSZip();
  zip.file("ALRAKEEN_Output.xlsx", Buffer.from(excelBuf));
  if (pdfBytes) zip.file("ALRAKEEN_Report.pdf", Buffer.from(pdfBytes));
  const zipBuf = await zip.generateAsync({ type: "nodebuffer" });

  return new NextResponse(zipBuf, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": "attachment; filename=ALRAKEEN_Project_Pack.zip"
    }
  });
}
