import { sql } from "@vercel/postgres";

export async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS can_vehicle_compat (
      id SERIAL PRIMARY KEY,
      adapter TEXT NOT NULL,
      brand TEXT NOT NULL,
      model TEXT NOT NULL,
      year_text TEXT,
      year_min INT,
      year_max INT,
      open_ended BOOLEAN DEFAULT FALSE,
      can_buses INT,
      flags TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_can_brand_model ON can_vehicle_compat(adapter, brand, model);`;
}

export type CompatRow = {
  adapter: string;
  brand: string;
  model: string;
  year_text: string | null;
  year_min: number | null;
  year_max: number | null;
  open_ended: boolean | null;
  can_buses: number | null;
  flags: string | null;
};

export async function findCompat(adapter: string, brand: string, model: string) {
  const b = brand.trim().toUpperCase();
  const m = model.trim().toUpperCase();
  const res = await sql<CompatRow>`
    SELECT adapter, brand, model, year_text, year_min, year_max, open_ended, can_buses, flags
    FROM can_vehicle_compat
    WHERE adapter=${adapter} AND brand=${b} AND model=${m}
    LIMIT 50;
  `;
  return res.rows;
}
