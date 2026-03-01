import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "@/lib/auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/dishes/[id]/photos
// JSON: { photoUrls: string[] }
// Called after the browser has uploaded photos directly to Supabase Storage
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id: dishId } = await params;
  const supabase = getSupabase();
  const body = await request.json();
  const { photoUrls } = body as { photoUrls: string[] };

  if (!Array.isArray(photoUrls) || photoUrls.length === 0) {
    return NextResponse.json(
      { error: "photoUrls array is required" },
      { status: 400 }
    );
  }

  const inserts = photoUrls.map((url: string, i: number) => ({
    dish_id: dishId,
    photo_url: url,
    sort_order: i,
  }));

  const { error } = await supabase.from("dish_photos").insert(inserts);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
