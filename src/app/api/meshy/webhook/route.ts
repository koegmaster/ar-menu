import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  uploadModelFromUrl,
  uploadThumbnailFromUrl,
} from "@/lib/storage";
import type { MeshyTask } from "@/lib/meshy";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/meshy/webhook
// Called by Meshy when a task status changes
export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  let body: MeshyTask;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id: taskId, status, model_urls, thumbnail_url } = body;

  // Find the dish with this Meshy task ID
  const { data: dish, error: dishError } = await supabase
    .from("dishes")
    .select("id, restaurant_id")
    .eq("meshy_task_id", taskId)
    .single();

  if (dishError || !dish) {
    // Task not linked to any dish — ignore (could be a test webhook)
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

  // Download GLB + USDZ from Meshy and store in Supabase Storage
  // Meshy URLs expire in 3 days, so we must do this immediately
  const [glbUrl, usdzUrl, posterUrl] = await Promise.all([
    uploadModelFromUrl(dish.restaurant_id, dish.id, model_urls.glb, "glb"),
    uploadModelFromUrl(dish.restaurant_id, dish.id, model_urls.usdz, "usdz"),
    thumbnail_url
      ? uploadThumbnailFromUrl(dish.restaurant_id, dish.id, thumbnail_url)
      : Promise.resolve(null),
  ]);

  const { error: updateError } = await supabase
    .from("dishes")
    .update({
      glb_url: glbUrl,
      usdz_url: usdzUrl,
      poster_url: posterUrl,
      model_status: "succeeded",
    })
    .eq("id", dish.id);

  if (updateError) {
    console.error("Failed to update dish after model generation:", updateError);
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
