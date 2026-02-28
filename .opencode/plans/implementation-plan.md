# AR Menu — Full Implementation Plan

## Overview
Restaurant photo → 3D model pipeline. Customers scan QR → view dishes in AR via browser (no app install).

## Stack
- **Framework**: Next.js 15 (App Router, TypeScript, Tailwind v4)
- **Deployment**: Vercel
- **Database + Storage**: Supabase (PostgreSQL + Storage for GLB/USDZ files)
- **3D Generation**: Meshy API (multi-image-to-3d endpoint, outputs GLB + USDZ)
- **AR Display**: Google `<model-viewer>` web component (iOS → AR Quick Look/USDZ, Android → Scene Viewer/GLB)
- **QR Codes**: `qrcode` npm library
- **Architecture**: Monolith (admin + customer routes in one Next.js app)

## Directory Structure
```
ar-menu/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout (Tailwind, fonts)
│   │   ├── page.tsx                      # Landing page
│   │   ├── globals.css                   # Tailwind imports
│   │   │
│   │   ├── admin/                        # Restaurant admin area
│   │   │   ├── layout.tsx                # Admin layout (sidebar nav)
│   │   │   ├── page.tsx                  # Dashboard
│   │   │   ├── dishes/
│   │   │   │   ├── page.tsx              # List dishes with status
│   │   │   │   ├── new/page.tsx          # Upload photos → create dish
│   │   │   │   └── [id]/page.tsx         # Dish detail / model status / preview
│   │   │   └── qr/page.tsx              # Generate QR codes
│   │   │
│   │   ├── r/[restaurantId]/             # Customer-facing (public, no auth)
│   │   │   ├── page.tsx                  # Full menu view
│   │   │   └── dishes/[dishId]/page.tsx  # Single dish + AR viewer
│   │   │
│   │   └── api/
│   │       ├── dishes/route.ts           # GET (list), POST (create dish + photos)
│   │       ├── meshy/
│   │       │   ├── generate/route.ts     # POST — kick off 3D generation for a dish
│   │       │   └── webhook/route.ts      # POST — Meshy callback → download models → store
│   │       └── qr/route.ts              # GET — generate QR code PNG for a dish URL
│   │
│   ├── components/
│   │   ├── ModelViewer.tsx               # Dynamic import wrapper (ssr: false)
│   │   ├── ModelViewerInner.tsx          # Actual <model-viewer> with AR attrs
│   │   ├── PhotoUpload.tsx               # Drag-and-drop multi-photo upload (1-4)
│   │   ├── DishCard.tsx                  # Card with name, photo, model status badge
│   │   └── QRCode.tsx                    # QR code display/download component
│   │
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts                 # createBrowserClient (client components)
│   │   │   └── server.ts                 # createServerClient (server components, route handlers)
│   │   ├── meshy.ts                      # Meshy API wrapper: createTask, getTask, listTasks
│   │   └── storage.ts                    # Upload helpers: uploadModel, uploadPhoto, getPublicUrl
│   │
│   └── types/
│       ├── model-viewer.d.ts             # JSX IntrinsicElements for <model-viewer>
│       └── database.ts                   # TypeScript types for DB tables
│
├── middleware.ts                          # Supabase auth session refresh
├── .env.local                            # API keys (gitignored)
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
└── .gitignore
```

## Dependencies (already installed)
```json
{
  "dependencies": {
    "@google/model-viewer": "^4.1.0",
    "@supabase/ssr": "^0.8.0",
    "@supabase/supabase-js": "^2.98.0",
    "next": "^15.3.4",
    "qrcode": "^1.5.4",
    "react": "^19.1.0",
    "react-dom": "^19.1.0",
    "three": "^0.172.0"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4.2.1",
    "@types/node": "^25.3.2",
    "@types/qrcode": "^1.5.5",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@types/three": "^0.172.0",
    "eslint": "^9.39.3",
    "eslint-config-next": "^16.1.6",
    "postcss": "^8.5.6",
    "tailwindcss": "^4.2.1",
    "typescript": "^5.9.3"
  }
}
```

## Database Schema (create in Supabase SQL editor)
```sql
-- Restaurants
create table restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now()
);

-- Dishes
create table dishes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references restaurants(id) not null,
  name text not null,
  description text,
  price decimal(10,2),
  glb_url text,
  usdz_url text,
  poster_url text,
  meshy_task_id text,
  model_status text default 'pending'
    check (model_status in ('pending','processing','succeeded','failed')),
  created_at timestamptz default now()
);

-- Dish photos (originals uploaded by admin)
create table dish_photos (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid references dishes(id) on delete cascade not null,
  photo_url text not null,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- Enable RLS
alter table restaurants enable row level security;
alter table dishes enable row level security;
alter table dish_photos enable row level security;

-- Public read policies (customer-facing pages need unauthenticated access)
create policy "Public read restaurants" on restaurants for select using (true);
create policy "Public read dishes" on dishes for select using (true);
create policy "Public read dish_photos" on dish_photos for select using (true);

-- Create storage buckets:
-- 1. "photos" — public bucket for dish photos
-- 2. "models" — public bucket for GLB/USDZ files
-- Folder structure: {restaurant_id}/{dish_id}/filename
```

## Step-by-Step Implementation

### Step 1: Config files
Create: `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`, `next-env.d.ts`, `.env.local`, `.gitignore`
Update: `package.json` (add scripts: dev, build, start, lint)

### Step 2: Supabase clients
- `src/lib/supabase/client.ts` — `createBrowserClient` using env vars
- `src/lib/supabase/server.ts` — `createServerClient` using cookies from `next/headers`
- `middleware.ts` — session refresh via `updateSession` pattern

### Step 3: model-viewer types
- `src/types/model-viewer.d.ts` — extend `JSX.IntrinsicElements` with all `<model-viewer>` attributes (src, ios-src, ar, ar-modes, ar-scale, camera-controls, etc.)

### Step 4: Database types
- `src/types/database.ts` — TypeScript interfaces for `Restaurant`, `Dish`, `DishPhoto` matching the SQL schema

### Step 5: Meshy API wrapper
- `src/lib/meshy.ts`
  - `createMultiImageTask(imageUrls: string[])` — POST to `/openapi/v1/multi-image-to-3d`
  - `getTask(taskId: string)` — GET task status + model URLs
  - Config: `ai_model: "meshy-6"`, `should_texture: true`, `enable_pbr: true`, `topology: "triangle"`, `target_polycount: 30000`, `ar_scale: "fixed"`

### Step 6: Storage helpers
- `src/lib/storage.ts`
  - `uploadPhoto(restaurantId, dishId, file)` — uploads to `photos/{restaurantId}/{dishId}/`
  - `uploadModelFromUrl(restaurantId, dishId, url, format)` — downloads from Meshy URL, uploads to `models/{restaurantId}/{dishId}.{glb|usdz}`
  - `getPublicUrl(bucket, path)` — returns public URL

### Step 7: API route — dishes
- `src/app/api/dishes/route.ts`
  - `GET` — list dishes for a restaurant (query param `?restaurantId=`)
  - `POST` — create dish record, receive FormData with photos, upload photos to storage, create dish_photos records

### Step 8: API route — generate
- `src/app/api/meshy/generate/route.ts`
  - `POST { dishId }` — fetch dish photos from DB, call Meshy createTask, update dish `meshy_task_id` + `model_status = 'processing'`

### Step 9: API route — webhook
- `src/app/api/meshy/webhook/route.ts`
  - `POST` — receive Meshy webhook payload
  - On `SUCCEEDED`: download GLB + USDZ from `model_urls`, upload to Supabase Storage, update dish record with URLs + `model_status = 'succeeded'`
  - On `FAILED`: update `model_status = 'failed'`

### Step 10: API route — QR
- `src/app/api/qr/route.ts`
  - `GET ?url=` — generate QR code PNG using `qrcode` library, return as image response

### Step 11: ModelViewer component
- `src/components/ModelViewer.tsx` — dynamic import wrapper with `ssr: false`, loading skeleton
- `src/components/ModelViewerInner.tsx` — `import "@google/model-viewer"`, renders `<model-viewer>` with all AR attributes, custom "View on your table" AR button via slot

### Step 12: PhotoUpload component
- `src/components/PhotoUpload.tsx` — client component, drag-and-drop area, shows previews, enforces 1-4 image limit, accepts jpg/png

### Step 13: DishCard component
- `src/components/DishCard.tsx` — shows dish name, first photo thumbnail, model status badge (pending/processing/succeeded/failed), link to detail page

### Step 14: QRCode component
- `src/components/QRCode.tsx` — client component, renders QR code for a dish URL, download button

### Step 15: Admin pages
- `src/app/admin/layout.tsx` — sidebar nav (Dashboard, Dishes, QR Codes)
- `src/app/admin/page.tsx` — dashboard with dish count, status summary
- `src/app/admin/dishes/page.tsx` — grid of DishCards
- `src/app/admin/dishes/new/page.tsx` — form: dish name, description, price + PhotoUpload + submit → creates dish + kicks off generation
- `src/app/admin/dishes/[id]/page.tsx` — dish detail: info, photos, model status, ModelViewer preview when ready, "Generate 3D Model" button

### Step 16: Admin QR page
- `src/app/admin/qr/page.tsx` — list dishes with QR codes, bulk download option

### Step 17: Customer menu page
- `src/app/r/[restaurantId]/page.tsx` — public page, lists all dishes for restaurant with photos + "View in 3D" links

### Step 18: Customer dish AR page
- `src/app/r/[restaurantId]/dishes/[dishId]/page.tsx` — public page, shows dish info + full ModelViewer with AR, this is what QR codes link to

### Step 19: Root layout + landing
- `src/app/layout.tsx` — html/body, Tailwind globals, Inter font
- `src/app/globals.css` — `@import "tailwindcss"`
- `src/app/page.tsx` — simple landing with links to admin and demo

### Step 20: Build verification
- Run `npm run build` and fix any TypeScript or build errors

## Meshy API Reference (for implementation)
- **Base URL**: `https://api.meshy.ai`
- **Auth**: `Authorization: Bearer {MESHY_API_KEY}`
- **Create task**: `POST /openapi/v1/multi-image-to-3d` with `{ image_urls: string[], ai_model: "meshy-6", should_texture: true, enable_pbr: true, topology: "triangle", target_polycount: 30000 }`
- **Response**: `{ result: "task-id-uuid" }`
- **Get task**: `GET /openapi/v1/multi-image-to-3d/{task_id}`
- **Task statuses**: `PENDING` → `IN_PROGRESS` → `SUCCEEDED` | `FAILED`
- **On success**: `model_urls.glb`, `model_urls.usdz`, `thumbnail_url` — all pre-signed URLs that expire in 3 days
- **Credits**: 30 per dish (Meshy-6 with texture)

## Supabase Client Patterns
- **Browser**: `createBrowserClient(url, anonKey)` from `@supabase/ssr`
- **Server**: `createServerClient(url, anonKey, { cookies: { getAll, setAll } })` using `cookies()` from `next/headers`
- **Storage upload**: `supabase.storage.from('bucket').upload(path, file, { contentType, upsert: true })`
- **Public URL**: `supabase.storage.from('bucket').getPublicUrl(path).data.publicUrl`

## model-viewer Integration
- **MUST use dynamic import with `ssr: false`** — web component crashes in Node.js SSR
- Two-file pattern: outer `ModelViewer.tsx` does `dynamic()`, inner `ModelViewerInner.tsx` does `import "@google/model-viewer"`
- Key attributes: `src` (GLB), `ios-src` (USDZ), `ar`, `ar-modes="scene-viewer quick-look"`, `ar-scale="fixed"`, `camera-controls`, `auto-rotate`
- Custom AR button via `slot="ar-button"` — only visible on AR-capable devices
