import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { requireAuth } from "@/lib/auth";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// PATCH /api/dishes/[id]
// Body: { name?, description?, price? }
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const supabase = getSupabase();
  const body = await request.json();

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description || null;
  if (body.price !== undefined) updates.price = body.price ?? null;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { data: dish, error } = await supabase
    .from("dishes")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error || !dish) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to update dish" },
      { status: 500 }
    );
  }

  return NextResponse.json(dish);
}

// DELETE /api/dishes/[id]
// Removes the dish row (cascades to dish_photos) and cleans up Storage files.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth instanceof NextResponse) return auth;

  const { id } = await params;
  const supabase = getSupabase();

  // Fetch the dish to get restaurant_id (needed for storage paths)
  const { data: dish, error: fetchError } = await supabase
    .from("dishes")
    .select("id, restaurant_id")
    .eq("id", id)
    .single();

  if (fetchError || !dish) {
    return NextResponse.json({ error: "Dish not found" }, { status: 404 });
  }

  const { restaurant_id, id: dishId } = dish;

  // Delete storage files — best-effort, don't fail the whole request if this errors
  try {
    const [photoFiles, modelFiles] = await Promise.all([
      supabase.storage.from("photos").list(`${restaurant_id}/${dishId}`),
      supabase.storage.from("models").list(`${restaurant_id}/${dishId}`),
    ]);

    const removeOps: Promise<unknown>[] = [];

    if (photoFiles.data?.length) {
      removeOps.push(
        supabase.storage
          .from("photos")
          .remove(
            photoFiles.data.map((f) => `${restaurant_id}/${dishId}/${f.name}`)
          )
      );
    }
    if (modelFiles.data?.length) {
      removeOps.push(
        supabase.storage
          .from("models")
          .remove(
            modelFiles.data.map((f) => `${restaurant_id}/${dishId}/${f.name}`)
          )
      );
    }

    await Promise.all(removeOps);
  } catch (err) {
    console.error("[dishes/delete] Storage cleanup failed:", err);
  }

  // Delete the dish row — dish_photos cascade automatically
  const { error: deleteError } = await supabase
    .from("dishes")
    .delete()
    .eq("id", id);

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
