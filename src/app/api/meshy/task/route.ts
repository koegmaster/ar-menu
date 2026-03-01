import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getTask } from "@/lib/meshy";
import { uploadModelFromUrl, uploadThumbnailFromUrl } from "@/lib/storage";
import { requireAuth } from "@/lib/auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/meshy/task?dishId=xxx
// Polls Meshy directly for the task status and processes it if done
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

  // Poll Meshy directly
  const task = await getTask(dish.meshy_task_id);

  // If succeeded, process it now (manual webhook trigger)
  if (task.status === "SUCCEEDED" && dish.model_status !== "succeeded") {
    const [glbUrl, usdzUrl, posterUrl] = await Promise.all([
      uploadModelFromUrl(dish.restaurant_id, dish.id, task.model_urls.glb, "glb"),
      uploadModelFromUrl(dish.restaurant_id, dish.id, task.model_urls.usdz, "usdz"),
      task.thumbnail_url
        ? uploadThumbnailFromUrl(dish.restaurant_id, dish.id, task.thumbnail_url)
        : Promise.resolve(null),
    ]);

    await supabase
      .from("dishes")
      .update({ glb_url: glbUrl, usdz_url: usdzUrl, poster_url: posterUrl, model_status: "succeeded" })
      .eq("id", dish.id);

    return NextResponse.json({ status: "succeeded", processed: true });
  }

  if (task.status === "FAILED" || task.status === "CANCELED") {
    await supabase.from("dishes").update({ model_status: "failed" }).eq("id", dish.id);
  }

  return NextResponse.json({
    meshyStatus: task.status,
    meshyProgress: task.progress,
    dishStatus: dish.model_status,
    taskId: dish.meshy_task_id,
  });
}
