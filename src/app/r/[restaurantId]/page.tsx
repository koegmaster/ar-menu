import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { DishWithPhotos } from "@/types/database";

export default async function MenuPage({
  params,
}: {
  params: Promise<{ restaurantId: string }>;
}) {
  const { restaurantId } = await params;
  const supabase = await createClient();

  // Fetch restaurant
  const { data: restaurant } = await supabase
    .from("restaurants")
    .select("*")
    .eq("id", restaurantId)
    .single();

  if (!restaurant) return notFound();

  // Fetch dishes (only show ones with models)
  const { data: dishes } = await supabase
    .from("dishes")
    .select("*, dish_photos(*)")
    .eq("restaurant_id", restaurantId)
    .order("name");

  const readyDishes = (dishes ?? []).filter(
    (d) => d.model_status === "succeeded"
  ) as DishWithPhotos[];

  const allDishes = (dishes ?? []) as DishWithPhotos[];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <h1 className="text-xl font-bold text-gray-900">{restaurant.name}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Tap any dish to view it in 3D — or place it on your table in AR
          </p>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {allDishes.length === 0 ? (
          <p className="text-center text-gray-500 py-12">
            Menu coming soon…
          </p>
        ) : (
          <div className="space-y-3">
            {allDishes.map((dish) => {
              const thumb =
                dish.poster_url ?? dish.dish_photos?.[0]?.photo_url;
              const has3D = dish.model_status === "succeeded";

              return (
                <Link
                  key={dish.id}
                  href={`/r/${restaurantId}/dishes/${dish.id}`}
                  className="flex items-center gap-4 bg-white rounded-xl border border-gray-100 p-3 hover:shadow-sm transition-shadow"
                >
                  {/* Thumbnail */}
                  <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={dish.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300 text-2xl">
                        ?
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="font-medium text-gray-900 truncate">
                        {dish.name}
                      </h2>
                      {dish.price != null && (
                        <span className="text-sm font-semibold text-gray-900 shrink-0">
                          €{dish.price.toFixed(2)}
                        </span>
                      )}
                    </div>
                    {dish.description && (
                      <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">
                        {dish.description}
                      </p>
                    )}
                    {has3D && (
                      <span className="inline-flex items-center gap-1 mt-1.5 text-xs text-orange-500 font-medium">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        View in AR
                      </span>
                    )}
                  </div>

                  {/* Arrow */}
                  <svg
                    className="w-5 h-5 text-gray-300 shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
