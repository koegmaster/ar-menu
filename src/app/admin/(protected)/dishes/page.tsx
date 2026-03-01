import { createClient } from "@/lib/supabase/server";
import DishCard from "@/components/DishCard";
import Link from "next/link";
import type { DishWithPhotos } from "@/types/database";

const DEMO_RESTAURANT_ID = process.env.NEXT_PUBLIC_DEMO_RESTAURANT_ID ?? "";

export default async function DishesPage() {
  const supabase = await createClient();

  const { data: dishes, error } = await supabase
    .from("dishes")
    .select("*, dish_photos(*)")
    .eq("restaurant_id", DEMO_RESTAURANT_ID)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <div className="p-8">
        <p className="text-red-500">Failed to load dishes: {error.message}</p>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dishes</h1>
          <p className="text-gray-500 mt-1">{dishes?.length ?? 0} dishes total</p>
        </div>
        <Link
          href="/admin/dishes/new"
          className="inline-flex items-center gap-2 bg-orange-500 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add dish
        </Link>
      </div>

      {!dishes || dishes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-200">
          <p className="text-gray-500 mb-4">No dishes yet</p>
          <Link
            href="/admin/dishes/new"
            className="text-orange-500 font-medium hover:underline"
          >
            Add your first dish
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {(dishes as DishWithPhotos[]).map((dish) => (
            <DishCard
              key={dish.id}
              dish={dish}
              href={`/admin/dishes/${dish.id}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
