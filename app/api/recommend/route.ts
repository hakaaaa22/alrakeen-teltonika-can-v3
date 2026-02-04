import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { recommend } from "@/lib/recommend";
import { getWikimediaThumb, deviceImageUrl } from "@/lib/images";

export const runtime = "nodejs";

\
function normalizeHeader(h: string) {
  return h
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function findCol(headers: string[], targets: string[]) {
  const norm = headers.map((h) => ({ raw: h, n: normalizeHeader(h) }));
  const tnorm = targets.map((t) => normalizeHeader(t));
  // exact
  for (const t of tnorm) {
    const hit = norm.find((x) => x.n === t);
    if (hit) return hit.raw;
  }
  // contains
  for (const t of tnorm) {
    const hit = norm.find((x) => x.n.includes(t) || t.includes(x.n));
    if (hit) return hit.raw;
  }
  return null;
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
  for (const [rx, val] of makeMap) {
    if (rx.test(d)) { make = val; break; }
  }

  let model = "";
  const modelMap: Array<[RegExp, string]> = [
    [/actros/i, "ACTROS"],
    [/npr/i, "NPR"],
    [/x3000/i, "X3000"],
    [/howo/i, "HOWO"],
    [/camry/i, "CAMRY"],
    [/staria/i, "STARIA"],
  ];
  for (const [rx, val] of modelMap) {
    if (rx.test(d)) { model = val; break; }
  }

  const heavy = /قلاب|شاحنة|دينا|تريلا|تريله|رأس|راس|قاطرة|سكس|معدات|حفار|ونش|باص|اتوبيس/i.test(d);
  const category = heavy ? "HEAVY" : "";

  return { make, model, category };
}


function toInt(v:any){
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const lang = (form.get("lang") as string | null) ?? "ar";
  if (!file) return new NextResponse("Missing file", { status: 400 });

  const ab = await file.arrayBuffer();
  const wb = XLSX.read(ab, { type: "array" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[];

  if (!json.length) return new NextResponse("Empty sheet", { status: 400 });

  const headers = Object.keys(json[0]).map(String);
  const colCat = findCol(headers, ["category","vehicle category","cat","الفئة","تصنيف","نوع","Category"]);
  const colMake = findCol(headers, ["manufacturer","make","brand","الشركة","المصنع","الماركة","Manufacturer"]);
  const colModel = findCol(headers, ["model","vehicle model","الموديل","طراز","Model"]);
  const colYear = findCol(headers, ["model year","year","سنة الصنع","ســنة الصنــــع","السنة"]);
  const colDesc = findCol(headers, ["description","details","note","البيان","البيـــــــــان","البيـــــــــان "]);
  const colPlate = findCol(headers, ["plate no","plate","license","registration","رقم اللوحة","اللوحة"]);

  if ((!colMake || !colModel) && !colDesc) {
    return new NextResponse("Need columns: (Manufacturer+Model) OR Description/البيان to auto-detect.", { status: 400 });
  }

  // Build output rows with recommendations and image URLs
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
    const vehicleQuery = `${make} ${model}`;
    const vehicleImg = await getWikimediaThumb(vehicleQuery);
    const devicePage = deviceImageUrl(rec.recommendedDevice);

    outRows.push({
      ...r,
      "Recommended Teltonika Device": rec.recommendedDevice,
      "CAN Accessory": rec.canAccessory,
      "Supported CAN Adapters": rec.supportedAdapters,
      "All Compatible Options": rec.allOptions,
      "Rule Used": rec.rule,
      "Device Page URL": devicePage ?? "",
      "Vehicle Image URL": vehicleImg ?? ""
    });
  }

  // Excel output (with URLs; embedding images in Excel is possible but heavy in serverless, so we keep URLs)
  const outWb = new ExcelJS.Workbook();
  const sheet = outWb.addWorksheet("Recommendations");
  sheet.columns = Object.keys(outRows[0]).map((k) => ({ header: k, key: k, width: Math.min(40, Math.max(14, k.length + 2)) }));
  outRows.forEach(r => sheet.addRow(r));

  // hyperlink style for URL columns
  const urlCols = ["Device Page URL", "Vehicle Image URL"];
  for (const colName of urlCols) {
    const idx = sheet.columns.findIndex(c => c.header === colName) + 1;
    if (idx > 0) {
      sheet.getColumn(idx).eachCell((cell, rowNumber) => {
        if (rowNumber === 1) return;
        const v = String(cell.value ?? "");
        if (v.startsWith("http")) {
          cell.value = { text: "open", hyperlink: v };
        }
      });
    }
  }

  const excelBuf = await outWb.xlsx.writeBuffer();

  // PDF output (logo + summary + first 60 rows, and image URLs)
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595.28, 841.89]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);

  const title = lang === "ar" ? "ALRAKEEN | تقرير توصية أجهزة Teltonika CAN" : "ALRAKEEN | Teltonika CAN Recommendation Report";
  page.drawText(title, { x: 40, y: 800, size: 16, font: bold, color: rgb(0.12,0.27,0.95) });

  const counts = outRows.reduce((acc:any, r:any) => {
    const d = r["Recommended Teltonika Device"];
    acc[d] = (acc[d] || 0) + 1;
    return acc;
  }, {});

  let y = 775;
  page.drawText((lang==="ar" ? "ملخص سريع:" : "Quick summary:"), { x: 40, y, size: 11, font: bold });
  y -= 16;
  for (const [k,v] of Object.entries(counts)) {
    page.drawText(`${k}: ${v}`, { x: 40, y, size: 10, font });
    y -= 14;
  }

  y -= 10;
  page.drawText((lang==="ar" ? "عينة من البيانات (أول 60 صف):" : "Sample rows (first 60):"), { x: 40, y, size: 11, font: bold });
  y -= 16;

  const maxRows = Math.min(60, outRows.length);
  for (let i=0; i<maxRows; i++) {
    const r = outRows[i];
    const plate = colPlate ? String(r[colPlate] ?? "") : "";
    const line = `${i+1}) ${plate} | ${r[colMake]} ${r[colModel]} ${r[colYear] ?? ""} | ${r["Recommended Teltonika Device"]} | ${r["CAN Accessory"]}`;
    if (y < 40) break;
    page.drawText(line.slice(0, 110), { x: 40, y, size: 9, font });
    y -= 12;
  }

  const pdfBytes = await pdf.save();

  // ZIP both
  const zip = new JSZip();
  zip.file("ALRAKEEN_Teltonika_CAN_Recommendations.xlsx", Buffer.from(excelBuf));
  zip.file("ALRAKEEN_Teltonika_CAN_Report.pdf", Buffer.from(pdfBytes));
  const zipBuf = await zip.generateAsync({ type: "nodebuffer" });

  return new NextResponse(zipBuf, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": "attachment; filename=ALRAKEEN_CAN_Report.zip"
    }
  });
}
