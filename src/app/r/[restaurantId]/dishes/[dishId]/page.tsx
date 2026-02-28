import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ModelViewer from "@/components/ModelViewer";
import Link from "next/link";
import type { DishWithPhotos } from "@/types/database";

export default async function DishARPage({
  params,
}: {
  params: Promise<{ restaurantId: string; dishId: string }>;
}) {
  const { restaurantId, dishId } = await params;
  const supabase = await createClient();

  const { data: dish, error } = await supabase
    .from("dishes")
    .select("*, dish_photos(*)")
    .eq("id", dishId)
    .eq("restaurant_id", restaurantId)
    .single();

  if (error || !dish) return notFound();

  const d = dish as DishWithPhotos;
  const thumb = d.poster_url ?? d.dish_photos?.[0]?.photo_url;
  const has3D = d.model_status === "succeeded" && d.glb_url;

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Back nav */}
      <header className="px-4 pt-4 pb-2">
        <Link
          href={`/r/${restaurantId}`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Menu
        </Link>
      </header>

      {/* 3D Viewer / Photo */}
      <div className="w-full max-w-sm mx-auto px-4">
        {has3D ? (
          <ModelViewer
            glbUrl={d.glb_url!}
            usdzUrl={d.usdz_url ?? undefined}
            posterUrl={d.poster_url ?? undefined}
            dishName={d.name}
          />
        ) : thumb ? (
          <div className="aspect-square rounded-2xl overflow-hidden bg-gray-100">
            <img
              src={thumb}
              alt={d.name}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="aspect-square rounded-2xl bg-gray-100 flex items-center justify-center">
            <span className="text-gray-400 text-4xl">?</span>
          </div>
        )}
      </div>

      {/* Dish info */}
      <div className="flex-1 px-6 pt-5 pb-8 max-w-sm mx-auto w-full">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold text-gray-900">{d.name}</h1>
          {d.price != null && (
            <span className="text-xl font-bold text-gray-900 shrink-0">
              €{d.price.toFixed(2)}
            </span>
          )}
        </div>

        {d.description && (
          <p className="text-gray-600 mt-3 leading-relaxed">{d.description}</p>
        )}

        {/* AR hint */}
        {has3D && (
          <div className="mt-6 rounded-xl bg-orange-50 border border-orange-100 p-4">
            <p className="text-sm text-orange-700 font-medium">
              Tap &quot;View on your table&quot; above to see this dish in your space
            </p>
            <p className="text-xs text-orange-500 mt-1">
              Works on iPhone and Android — no app needed
            </p>
          </div>
        )}

        {d.model_status === "processing" && (
          <div className="mt-6 rounded-xl bg-yellow-50 border border-yellow-100 p-4">
            <p className="text-sm text-yellow-700">
              3D model is being generated — check back soon
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
