import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  uploadModelFromUrl,
  uploadThumbnailFromUrl,
  getPublicUrl,
  BUCKETS,
} from "@/lib/storage";
import type { MeshyTask } from "@/lib/meshy";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/meshy/webhook
// Called by Meshy when a task status changes. Responds immediately and
// migrates model files to Supabase Storage in the background via after().
export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  let body: MeshyTask;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id: taskId, status, model_urls, thumbnail_url } = body;

  // Find the dish linked to this Meshy task
  const { data: dish, error: dishError } = await supabase
    .from("dishes")
    .select("id, restaurant_id")
    .eq("meshy_task_id", taskId)
    .single();

  if (dishError || !dish) {
    // Task not linked to any dish — ignore
    return NextResponse.json({ ok: true });
  }

  if (status === "FAILED" || status === "CANCELED") {
    await supabase
      .from("dishes")
      .update({ model_status: "failed" })
      .eq("id", dish.id);
    return NextResponse.json({ ok: true });
  }

  if (status !== "SUCCEEDED") {
    // Still in progress — nothing to do yet
    return NextResponse.json({ ok: true });
  }

  const meshyGlbUrl = model_urls.glb;
  const meshyUsdzUrl = model_urls.usdz;
  const meshyThumbnailUrl = thumbnail_url ?? null;

  const finalGlbUrl = getPublicUrl(BUCKETS.MODELS, `${dish.restaurant_id}/${dish.id}/model.glb`);
  const finalUsdzUrl = getPublicUrl(BUCKETS.MODELS, `${dish.restaurant_id}/${dish.id}/model.usdz`);
  const finalThumbnailUrl = meshyThumbnailUrl
    ? getPublicUrl(BUCKETS.PHOTOS, `${dish.restaurant_id}/${dish.id}/thumbnail.png`)
    : null;

  // Mark succeeded immediately with Meshy's CDN URLs — don't block on upload
  await supabase
    .from("dishes")
    .update({
      glb_url: meshyGlbUrl,
      usdz_url: meshyUsdzUrl,
      poster_url: meshyThumbnailUrl,
      model_status: "succeeded",
    })
    .eq("id", dish.id);

  // Background: migrate files from Meshy CDN → Supabase Storage
  after(async () => {
    try {
      await Promise.all([
        uploadModelFromUrl(dish.restaurant_id, dish.id, meshyGlbUrl, "glb"),
        uploadModelFromUrl(dish.restaurant_id, dish.id, meshyUsdzUrl, "usdz"),
        meshyThumbnailUrl
          ? uploadThumbnailFromUrl(dish.restaurant_id, dish.id, meshyThumbnailUrl)
          : Promise.resolve(null),
      ]);
      await supabase
        .from("dishes")
        .update({
          glb_url: finalGlbUrl,
          usdz_url: finalUsdzUrl,
          ...(finalThumbnailUrl ? { poster_url: finalThumbnailUrl } : {}),
        })
        .eq("id", dish.id);
    } catch (err) {
      console.error("[meshy/webhook] Background upload failed:", err);
    }
  });

  return NextResponse.json({ ok: true });
}
