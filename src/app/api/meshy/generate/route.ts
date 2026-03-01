import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createMultiImageTask } from "@/lib/meshy";
import { requireAuth } from "@/lib/auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// POST /api/meshy/generate
// Body: { dishId: string }
export async function POST(request: NextRequest) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const supabase = getSupabase();
  const { dishId } = await request.json();

  if (!dishId) {
    return NextResponse.json({ error: "dishId is required" }, { status: 400 });
  }

  // Fetch the dish and its photos
  const { data: dish, error: dishError } = await supabase
    .from("dishes")
    .select("*, dish_photos(*)")
    .eq("id", dishId)
    .single();

  if (dishError || !dish) {
    return NextResponse.json({ error: "Dish not found" }, { status: 404 });
  }

  const photos: { photo_url: string; sort_order: number }[] =
    dish.dish_photos ?? [];

  if (photos.length < 2) {
    return NextResponse.json(
      { error: "At least 2 photos are required for good 3D results" },
      { status: 400 }
    );
  }

  // Sort photos by sort_order and extract URLs
  const imageUrls = photos
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((p) => p.photo_url);

  // Submit to Meshy
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const webhookUrl = appUrl ? `${appUrl}/api/meshy/webhook` : undefined;
  const taskId = await createMultiImageTask({ imageUrls, webhookUrl });

  // Update dish record
  const { error: updateError } = await supabase
    .from("dishes")
    .update({
      meshy_task_id: taskId,
      model_status: "processing",
    })
    .eq("id", dishId);

  if (updateError) {
    return NextResponse.json(
      { error: `Task created but dish update failed: ${updateError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ taskId, status: "processing" });
}
