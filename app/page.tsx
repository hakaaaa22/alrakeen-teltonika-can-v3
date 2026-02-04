"use client";

import { useMemo, useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [lang, setLang] = useState<"ar"|"en">("ar");

  const ui = useMemo(() => {
    if (lang === "ar") {
      return {
        title: "ارفع Excel… وخذ توصية CAN جاهزة",
        subtitle: "المنصة تقرأ الأعمدة تلقائيًا (Category / Manufacturer / Model / Model Year) وتطلع لك Excel + PDF + صور.",
        upload: "ارفع ملف Excel",
        run: "استخراج التقرير (Excel + PDF)",
        hint: "ملاحظة: لو الأعمدة عندك مختلفة، بنحاول نكتشفها تلقائيًا.",
        out: "سيتم تحميل ملف ZIP يحتوي: Excel + PDF",
        lang: "English"
      };
    }
    return {
      title: "Upload Excel… get CAN recommendation instantly",
      subtitle: "Auto-detects columns (Arabic/English) incl. البيان/Description and exports Excel + PDF + images.",
      upload: "Upload Excel",
      run: "Generate report (Excel + PDF)",
      hint: "Note: If your headers are different, we try to auto-map them.",
      out: "You will download a ZIP containing: Excel + PDF",
      lang: "العربية"
    };
  }, [lang]);

  async function onGenerate() {
    if (!file) return;
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("lang", lang);
      const res = await fetch("/api/recommend", { method: "POST", body: fd });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(t || "Request failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ALRAKEEN_CAN_Report.zip";
      a.click();
      URL.revokeObjectURL(url);
      setMsg(ui.out);
    } catch (e:any) {
      setMsg(e?.message || "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card hero">
      <div>
        <h1 className="h1">{ui.title}</h1>
        <p className="p">{ui.subtitle}</p>

        <div className="row" style={{marginTop:16}}>
          <input
            className="input"
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button className="btn" disabled={!file || busy} onClick={onGenerate}>
            {busy ? "..." : ui.run}
          </button>
          <button className="btn secondary" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
            {ui.lang}
          </button>
        </div>

        <p className="small" style={{marginTop:10}}>{ui.hint}</p>

        {msg ? <div className="card" style={{background:"#f7f9ff"}}>{msg}</div> : null}

        <hr className="hr" />

        <div className="kpis">
          <div className="kpi"><b>FMC650</b><div className="small">Heavy/Truck/Bus → FMS/CAN</div></div>
          <div className="kpi"><b>FMC150</b><div className="small">Light/Car/Van → CAN via adapter</div></div>
          <div className="kpi"><b>Auto-Update</b><div className="small">Cron refresh from Teltonika Wiki</div></div>
        </div>
      </div>

      <div className="card" style={{background:"#ffffff"}}>
        <div style={{fontWeight:900, marginBottom:8}}>Output Columns</div>
        <ul className="small" style={{lineHeight:1.8, margin:0, paddingInlineStart:18}}>
          <li>Recommended Teltonika Device</li>
          <li>CAN Accessory</li>
          <li>Supported CAN Adapters + All Compatible Options</li>
          <li>Rule Used</li>
          <li>Device Image (URL)</li>
          <li>Vehicle Image (URL)</li>
        </ul>
        <hr className="hr" />
        <div className="small">
          ✅ Sources: Teltonika products + Teltonika Wiki supported vehicle lists.<br/>
          ✅ PDF includes logo + summary + images (URLs embedded).
        </div>
      </div>
    </div>
  );
}
