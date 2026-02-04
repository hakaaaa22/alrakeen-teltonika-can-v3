import { findCompat } from "./sql";
import { yearFits } from "./parseYear";

const HEAVY = new Set(["HEAVY","TRUCK","BUS"]);

export async function recommend(category: string, manufacturer: string, model: string, year?: number) {
  const cat = (category || "").trim().toUpperCase();
  const make = (manufacturer || "").trim();
  const mdl = (model || "").trim();

  const options: string[] = [];

  if (HEAVY.has(cat)) {
    return {
      recommendedDevice: "FMC650",
      canAccessory: "",
      supportedAdapters: "FMS/J1939 (heavy)",
      allOptions: "FMC650 (FMS/J1939)",
      rule: "Heavy/Truck/Bus => FMC650 (FMS/CAN)"
    };
  }

  const allcan = await findCompat("ALL-CAN300", make, mdl);
  const hitAllcan = allcan.find(r => yearFits(year, r as any));
  if (hitAllcan) options.push(`FMC150 + ALL-CAN300 (${hitAllcan.year_text ?? ""})`);

  const lvcan = await findCompat("LV-CAN200", make, mdl);
  const hitLv = lvcan.find(r => yearFits(year, r as any));
  if (hitLv) options.push(`FMC150 + LV-CAN200 (${hitLv.year_text ?? ""})`);

  if (options.length === 0) options.push("FMC150 + LV-CAN200 (fallback)");

  if (hitAllcan) {
    return {
      recommendedDevice: "FMC150",
      canAccessory: "ALL-CAN300",
      supportedAdapters: "ALL-CAN300",
      allOptions: options.join(" | "),
      rule: `ALL-CAN300 match (${hitAllcan.year_text ?? ""}) => FMC150 + ALL-CAN300`
    };
  }

  if (hitLv) {
    return {
      recommendedDevice: "FMC150",
      canAccessory: "LV-CAN200",
      supportedAdapters: "LV-CAN200",
      allOptions: options.join(" | "),
      rule: `LV-CAN200 match (${hitLv.year_text ?? ""}) => FMC150 + LV-CAN200`
    };
  }

  return {
    recommendedDevice: "FMC150",
    canAccessory: "LV-CAN200",
    supportedAdapters: "LV-CAN200 (fallback)",
    allOptions: options.join(" | "),
    rule: "DEFAULT light vehicle => FMC150 + LV-CAN200"
  };
}
