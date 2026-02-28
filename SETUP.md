# AR Menu — Setup Guide

## 1. Supabase

1. Go to [supabase.com](https://supabase.com) → New project
2. Once created, go to **Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
3. Go to **SQL Editor** → paste and run `schema.sql` (in this repo root)
4. After running, get your demo restaurant ID:
   ```sql
   select id from restaurants where slug = 'demo';
   ```
   Copy that UUID → `NEXT_PUBLIC_DEMO_RESTAURANT_ID`
5. Go to **Storage** → create two buckets:
   - `photos` — set to **Public**
   - `models` — set to **Public**

## 2. Meshy

1. Sign up at [meshy.ai](https://meshy.ai)
2. Go to **API Keys** and create a key → `MESHY_API_KEY`
3. After you deploy to Vercel, register the webhook in Meshy:
   - **Settings → Webhooks** → add `https://your-domain.vercel.app/api/meshy/webhook`

## 3. Environment variables

Fill in `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

MESHY_API_KEY=msy_...

NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DEMO_RESTAURANT_ID=your-restaurant-uuid-here
```

For production (Vercel), set the same vars in **Project → Settings → Environment Variables**, and update `NEXT_PUBLIC_APP_URL` to your Vercel domain.

## 4. Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000/admin](http://localhost:3000/admin)

## 5. Deploy to Vercel

```bash
npx vercel --prod
```

Or connect the GitHub repo in the Vercel dashboard — it will auto-deploy on push.

---

## How it works

1. Admin goes to `/admin/dishes/new`, uploads 1–4 photos of a dish
2. Photos are stored in Supabase Storage (`photos` bucket)
3. Meshy is called with the photo URLs → async 3D generation job starts
4. Meshy calls the webhook at `/api/meshy/webhook` when done
5. Webhook downloads GLB + USDZ from Meshy, uploads to Supabase Storage (`models` bucket), updates the dish record
6. Customer scans QR code → lands on `/r/{restaurantId}` → taps a dish → AR viewer opens
   - iOS: AR Quick Look (USDZ)
   - Android: Scene Viewer (GLB)
