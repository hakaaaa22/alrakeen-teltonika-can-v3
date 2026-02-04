export function parseYearText(input: any): {year_text: string|null, year_min: number|null, year_max: number|null, open_ended: boolean} {
  if (input === null || input === undefined) return {year_text:null, year_min:null, year_max:null, open_ended:false};
  const s = String(input).trim();
  if (!s || s.toLowerCase() === "nan") return {year_text:null, year_min:null, year_max:null, open_ended:false};

  const m1 = s.match(/^\s*(\d{4})\s*>\s*$/);
  if (m1) {
    const y = Number(m1[1]);
    return {year_text:s, year_min:y, year_max:null, open_ended:true};
  }
  const m2 = s.match(/^\s*(\d{4})\s*-\s*(\d{4})\s*$/);
  if (m2) {
    return {year_text:s, year_min:Number(m2[1]), year_max:Number(m2[2]), open_ended:false};
  }
  const m3 = s.match(/^\s*(\d{4})\s*$/);
  if (m3) {
    const y = Number(m3[1]);
    return {year_text:s, year_min:y, year_max:y, open_ended:false};
  }
  const m4 = s.match(/(\d{4})/);
  if (m4) {
    const y = Number(m4[1]);
    return {year_text:s, year_min:y, year_max:null, open_ended:false};
  }
  return {year_text:s, year_min:null, year_max:null, open_ended:false};
}

export function yearFits(year: number|undefined, row: {year_min:any, year_max:any, open_ended:any}) {
  if (!year) return true;
  const ymin = row.year_min ?? null;
  const ymax = row.year_max ?? null;
  const oe = !!row.open_ended;
  if (ymin === null && ymax === null) return true;
  if (oe && ymin !== null) return year >= ymin;
  if (ymin !== null && ymax !== null) return year >= ymin && year <= ymax;
  if (ymin !== null && ymax === null) return year >= ymin;
  return true;
}
