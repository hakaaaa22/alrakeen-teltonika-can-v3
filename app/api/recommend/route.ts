import { NextResponse } from "next/server";
import { recommend } from "@/lib/recommend";

export const runtime = "nodejs";

type Body = {
  category?: string;
  make?: string;
  model?: string;
  year?: number | string;
};

function toInt(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : undefined;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const category = String(body.category ?? "").trim();
    const make = String(body.make ?? "").trim();
    const model = String(body.model ?? "").trim();
    const year = toInt(body.year);

    const rec = await recommend(category, make, model, year);

    return NextResponse.json(
      {
        ok: true,
        input: { category, make, model, year },
        ...rec,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || "Unknown error" },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    { ok: true, message: "POST { category, make, model, year }" },
    { status: 200 }
  );
}
