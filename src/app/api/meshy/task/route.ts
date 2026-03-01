import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getTask } from "@/lib/meshy";
import { uploadBothModelsFromUrls, uploadThumbnailFromUrl, getPublicUrl, BUCKETS } from "@/lib/storage";
import { requireAuth } from "@/lib/auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/meshy/task?dishId=xxx
// Polls Meshy for task status. When SUCCEEDED, immediately marks the dish
// as succeeded with Meshy's temporary URLs, then migrates files to Supabase
// Storage in the background (via after()) so the response is never blocked.
export async function GET(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const dishId = searchParams.get("dishId");

  if (!dishId) {
    return NextResponse.json({ error: "dishId is required" }, { status: 400 });
  }

  const { data: dish, error } = await supabase
    .from("dishes")
    .select("id, restaurant_id, meshy_task_id, model_status")
    .eq("id", dishId)
    .single();

  if (error || !dish) {
    return NextResponse.json({ error: "Dish not found" }, { status: 404 });
  }

  if (!dish.meshy_task_id) {
    return NextResponse.json({ error: "No Meshy task ID on this dish" }, { status: 400 });
  }

  // Poll Meshy
  const task = await getTask(dish.meshy_task_id);

  if (task.status === "FAILED" || task.status === "CANCELED") {
    await supabase.from("dishes").update({ model_status: "failed" }).eq("id", dish.id);
    return NextResponse.json({ meshyStatus: task.status, dishStatus: "failed" });
  }

  if (task.status === "SUCCEEDED" && dish.model_status !== "succeeded") {
    // Immediately write Meshy's own CDN URLs + mark succeeded so the UI
    // can show the model right away (Meshy URLs are valid for 3 days).
    const meshyGlbUrl = task.model_urls.glb;
    const meshyUsdzUrl = task.model_urls.usdz;
    const meshyThumbnailUrl = task.thumbnail_url ?? null;

    // Compute the final Supabase Storage public URLs ahead of time so we
    // can write them to the DB once the background upload finishes.
    const finalGlbUrl = getPublicUrl(BUCKETS.MODELS, `${dish.restaurant_id}/${dish.id}/model.glb`);
    const finalUsdzUrl = getPublicUrl(BUCKETS.MODELS, `${dish.restaurant_id}/${dish.id}/model.usdz`);
    const finalThumbnailUrl = meshyThumbnailUrl
      ? getPublicUrl(BUCKETS.PHOTOS, `${dish.restaurant_id}/${dish.id}/thumbnail.png`)
      : null;

    // Mark succeeded immediately with Meshy URLs so the UI doesn't wait
    await supabase
      .from("dishes")
      .update({
        glb_url: meshyGlbUrl,
        usdz_url: meshyUsdzUrl,
        poster_url: meshyThumbnailUrl,
        model_status: "succeeded",
      })
      .eq("id", dish.id);

    // Background: migrate files from Meshy CDN → Supabase Storage.
    // This runs after the response is sent so it never blocks the client.
    after(async () => {
      try {
        await Promise.all([
          uploadBothModelsFromUrls(dish.restaurant_id, dish.id, meshyGlbUrl, meshyUsdzUrl),
          meshyThumbnailUrl
            ? uploadThumbnailFromUrl(dish.restaurant_id, dish.id, meshyThumbnailUrl)
            : Promise.resolve(null),
        ]);
        // Update DB with permanent Supabase URLs once uploads are done
        await supabase
          .from("dishes")
          .update({
            glb_url: finalGlbUrl,
            usdz_url: finalUsdzUrl,
            ...(finalThumbnailUrl ? { poster_url: finalThumbnailUrl } : {}),
          })
          .eq("id", dish.id);
      } catch (err) {
        console.error("[meshy/task] Background upload failed:", err);
        // Non-fatal — Meshy URLs still work for 3 days, webhook may retry
      }
    });

    return NextResponse.json({ status: "succeeded", processed: true });
  }

  // Still in progress
  return NextResponse.json({
    meshyStatus: task.status,
    meshyProgress: task.progress,
    dishStatus: dish.model_status,
    taskId: dish.meshy_task_id,
  });
}
