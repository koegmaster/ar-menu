import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
// JSON: { name, description?, price?, restaurantId }
// Photos are uploaded directly from the browser — see POST /api/dishes/[id]/photos
export async function POST(request: NextRequest) {
  const supabase = getSupabase();
  const body = await request.json();

  const { name, description, price, restaurantId } = body;

  if (!name || !restaurantId) {
    return NextResponse.json(
      { error: "name and restaurantId are required" },
      { status: 400 }
    );
  }

  const { data: dish, error: dishError } = await supabase
    .from("dishes")
    .insert({
      restaurant_id: restaurantId,
      name,
      description: description || null,
      price: price ?? null,
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

  return NextResponse.json(dish, { status: 201 });
}
