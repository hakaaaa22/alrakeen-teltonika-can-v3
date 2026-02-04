"use client";

import { useMemo, useState } from "react";

type Opts = {
  includeRecommendations: boolean;
  includePdf: boolean;
  includePlan: boolean;
  includeCost: boolean;
  embedImages: boolean;
  planBy: "location" | "owner";
  techCount: number;
  hoursPerDay: number;
  installsPerVehicleMinutes: number;
  kmPerDay: number;
  fuelPrice: number;
  fuelLitersPer100km: number;
  hotelCostPerNight: number;
  hotelNightsPerDay: number;
  technicianDailyCost: number;
  perDiemDaily: number;
  startDate: string;
};

export default function Planner() {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");
  const [lang, setLang] = useState<"ar"|"en">("ar");

  const [opts, setOpts] = useState<Opts>({
    includeRecommendations: true,
    includePdf: true,
    includePlan: true,
    includeCost: true,
    embedImages: false,
    planBy: "location",
    techCount: 2,
    hoursPerDay: 8,
    installsPerVehicleMinutes: 35,
    kmPerDay: 140,
    fuelPrice: 2.33,
    fuelLitersPer100km: 12,
    hotelCostPerNight: 280,
    hotelNightsPerDay: 0,
    technicianDailyCost: 350,
    perDiemDaily: 100,
    startDate: new Date().toISOString().slice(0,10)
  });

  const ui = useMemo(() => {
    if (lang === "ar") {
      return {
        title: "خطة تركيب + توصية أجهزة (PMP Style)",
        subtitle: "ارفع ملفك… واختر Features قبل التنزيل: توصية الأجهزة، خطة مناطق، جدولة أيام، وتكاليف (بنزين/فنيين/فنادق).",
        hint: "كل الخيارات اختيارية من الـ Checkboxes. الملف الناتج يحتوي Excel + PDF حسب اختيارك.",
        run: "توليد الملفات (ZIP)",
        lang: "English",
        features: "الخصائص",
        planning: "إعدادات الخطة",
        costs: "إعدادات التكاليف"
      };
    }
    return {
      title: "Installation Plan + Device Recommendation (PMP Style)",
      subtitle: "Upload your Excel… then choose features: recommendations, region planning, schedule, and costs.",
      hint: "All features are optional via checkboxes. Output ZIP contains Excel + PDF based on your selection.",
      run: "Generate files (ZIP)",
      lang: "العربية",
      features: "Features",
      planning: "Planning Settings",
      costs: "Cost Settings"
    };
  }, [lang]);

  function set<K extends keyof Opts>(k: K, v: Opts[K]) {
    setOpts((p) => ({ ...p, [k]: v }));
  }

  async function onGenerate() {
    if (!file) return;
    setBusy(true);
    setMsg("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("lang", lang);
      fd.append("options", JSON.stringify(opts));
      const res = await fetch("/api/plan", { method: "POST", body: fd });
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "ALRAKEEN_Project_Pack.zip";
      a.click();
      URL.revokeObjectURL(url);
      setMsg("✅ Done. ZIP downloaded.");
    } catch (e:any) {
      setMsg(e?.message || "Error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card">
      <div className="row" style={{justifyContent:"space-between"}}>
        <div>
          <h1 className="h1">{ui.title}</h1>
          <p className="p">{ui.subtitle}</p>
          <p className="small">{ui.hint}</p>
        </div>
        <button className="btn secondary" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>{ui.lang}</button>
      </div>

      <div className="row" style={{marginTop:16}}>
        <input className="input" type="file" accept=".xlsx,.xls" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button className="btn" disabled={!file || busy} onClick={onGenerate}>
          {busy ? "..." : ui.run}
        </button>
      </div>

      {msg ? <div className="card" style={{background:"#f7f9ff"}}>{msg}</div> : null}

      <hr className="hr" />

      <div className="hero">
        <div className="card" style={{background:"#ffffff"}}>
          <div style={{fontWeight:900, marginBottom:10}}>{ui.features}</div>
          <label className="row"><input type="checkbox" checked={opts.includeRecommendations} onChange={(e)=>set("includeRecommendations", e.target.checked)} /> Recommendations (Excel)</label>
          <label className="row"><input type="checkbox" checked={opts.includePdf} onChange={(e)=>set("includePdf", e.target.checked)} /> Professional PDF</label>
          <label className="row"><input type="checkbox" checked={opts.includePlan} onChange={(e)=>set("includePlan", e.target.checked)} /> Region plan + day schedule</label>
          <label className="row"><input type="checkbox" checked={opts.includeCost} onChange={(e)=>set("includeCost", e.target.checked)} /> Costs (PMP estimate)</label>
          <label className="row"><input type="checkbox" checked={opts.embedImages} onChange={(e)=>set("embedImages", e.target.checked)} /> Embed images in PDF (optional)</label>
          <div className="small">Excel contains image URLs (fast). PDF can optionally embed images (heavier).</div>
        </div>

        <div className="card" style={{background:"#ffffff"}}>
          <div style={{fontWeight:900, marginBottom:10}}>{ui.planning}</div>
          <div className="row">
            <label className="small" style={{minWidth:150}}>Start date</label>
            <input className="input" type="date" value={opts.startDate} onChange={(e)=>set("startDate", e.target.value)} />
          </div>
          <div className="row">
            <label className="small" style={{minWidth:150}}>Group by</label>
            <select className="input" value={opts.planBy} onChange={(e)=>set("planBy", e.target.value as any)}>
              <option value="location">Location / الموقع</option>
              <option value="owner">Owner / المالك</option>
            </select>
          </div>
          <div className="row">
            <label className="small" style={{minWidth:150}}>Technicians</label>
            <input className="input" type="number" value={opts.techCount} min={1} onChange={(e)=>set("techCount", Number(e.target.value||1))} />
          </div>
          <div className="row">
            <label className="small" style={{minWidth:150}}>Hours/day</label>
            <input className="input" type="number" value={opts.hoursPerDay} min={1} onChange={(e)=>set("hoursPerDay", Number(e.target.value||8))} />
          </div>
          <div className="row">
            <label className="small" style={{minWidth:150}}>Minutes/vehicle</label>
            <input className="input" type="number" value={opts.installsPerVehicleMinutes} min={10} onChange={(e)=>set("installsPerVehicleMinutes", Number(e.target.value||35))} />
          </div>
          <div className="small">We estimate days = ceil(total_minutes / (techCount * hoursPerDay * 60)).</div>
        </div>

        <div className="card" style={{background:"#ffffff"}}>
          <div style={{fontWeight:900, marginBottom:10}}>{ui.costs}</div>
          <div className="row">
            <label className="small" style={{minWidth:150}}>KM/day</label>
            <input className="input" type="number" value={opts.kmPerDay} min={0} onChange={(e)=>set("kmPerDay", Number(e.target.value||0))} />
          </div>
          <div className="row">
            <label className="small" style={{minWidth:150}}>Fuel price</label>
            <input className="input" type="number" value={opts.fuelPrice} min={0} step="0.01" onChange={(e)=>set("fuelPrice", Number(e.target.value||0))} />
          </div>
          <div className="row">
            <label className="small" style={{minWidth:150}}>L/100km</label>
            <input className="input" type="number" value={opts.fuelLitersPer100km} min={0} step="0.1" onChange={(e)=>set("fuelLitersPer100km", Number(e.target.value||0))} />
          </div>
          <div className="row">
            <label className="small" style={{minWidth:150}}>Tech/day</label>
            <input className="input" type="number" value={opts.technicianDailyCost} min={0} onChange={(e)=>set("technicianDailyCost", Number(e.target.value||0))} />
          </div>
          <div className="row">
            <label className="small" style={{minWidth:150}}>Per diem/day</label>
            <input className="input" type="number" value={opts.perDiemDaily} min={0} onChange={(e)=>set("perDiemDaily", Number(e.target.value||0))} />
          </div>
          <div className="row">
            <label className="small" style={{minWidth:150}}>Hotel/night</label>
            <input className="input" type="number" value={opts.hotelCostPerNight} min={0} onChange={(e)=>set("hotelCostPerNight", Number(e.target.value||0))} />
          </div>
          <div className="row">
            <label className="small" style={{minWidth:150}}>Hotel nights/day</label>
            <input className="input" type="number" value={opts.hotelNightsPerDay} min={0} onChange={(e)=>set("hotelNightsPerDay", Number(e.target.value||0))} />
          </div>
        </div>
      </div>
    </div>
  );
}
