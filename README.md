# ALRAKEEN Teltonika CAN Recommender (Vercel)

## What it does
- Upload Excel → auto-detect columns → outputs ZIP containing:
  - Excel with recommended Teltonika device + CAN adapter
  - PDF summary (with logo)

## Data freshness
- Uses Vercel Cron to refresh supported vehicle lists from Teltonika Wiki daily at 03:00 UTC (see `vercel.json`)
- API: `/api/refresh`

## Setup (local)
```bash
npm i
npm run dev
```

## Deploy to Vercel
1) Create a Vercel Postgres database
2) Add env vars automatically (Vercel handles `POSTGRES_URL`)
3) Deploy

Then run once:
- Open `https://<your-app>.vercel.app/api/refresh` to load latest lists

## Notes
- Excel includes clickable links for device page and vehicle image.
- If you want embedding of images inside Excel cells, we can add it (heavier on serverless).


## Planner (PMP-style)
- Page: /planner
- API: /api/plan
- Output: ZIP containing Excel (Recommendations + Installation Plan + Cost Summary) and PDF.
