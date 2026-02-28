import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { uploadPhoto } from "@/lib/storage";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// GET /api/dishes?restaurantId=xxx
export async function GET(request: NextRequest) {
  const supabase = getSupabase();
  const { searchParams } = new URL(request.url);
  const restaurantId = searchParams.get("restaurantId");

  if (!restaurantId) {
    return NextResponse.json(
      { error: "restaurantId is required" },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("dishes")
    .select("*, dish_photos(*)")
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

// POST /api/dishes
// FormData: name, description?, price?, restaurantId, photos (1-4 files)
export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  const formData = await request.formData();

  const name = formData.get("name") as string;
  const description = formData.get("description") as string | null;
  const price = formData.get("price") as string | null;
  const restaurantId = formData.get("restaurantId") as string;
  const photos = formData.getAll("photos") as File[];

  if (!name || !restaurantId) {
    return NextResponse.json(
      { error: "name and restaurantId are required" },
      { status: 400 }
    );
  }

  if (photos.length < 1 || photos.length > 4) {
    return NextResponse.json(
      { error: "1–4 photos are required" },
      { status: 400 }
    );
  }

  // Create the dish record
  const { data: dish, error: dishError } = await supabase
    .from("dishes")
    .insert({
      restaurant_id: restaurantId,
      name,
      description: description || null,
      price: price ? parseFloat(price) : null,
      model_status: "pending",
    })
    .select()
    .single();

  if (dishError || !dish) {
    return NextResponse.json(
      { error: dishError?.message ?? "Failed to create dish" },
      { status: 500 }
    );
  }

  // Upload photos and create dish_photo records
  const photoInserts = await Promise.all(
    photos.map(async (file, i) => {
      const url = await uploadPhoto(restaurantId, dish.id, file, i);
      return { dish_id: dish.id, photo_url: url, sort_order: i };
    })
  );

  const { error: photosError } = await supabase
    .from("dish_photos")
    .insert(photoInserts);

  if (photosError) {
    return NextResponse.json(
      { error: `Photos saved but metadata failed: ${photosError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json(dish, { status: 201 });
}
