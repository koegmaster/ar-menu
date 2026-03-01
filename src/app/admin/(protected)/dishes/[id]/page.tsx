import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ModelViewer from "@/components/ModelViewer";
import ModelStatusPoller from "@/components/ModelStatusPoller";
import type { DishWithPhotos } from "@/types/database";

export default async function DishDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: dish, error } = await supabase
    .from("dishes")
    .select("*, dish_photos(*)")
    .eq("id", id)
    .single();

  if (error || !dish) return notFound();

  const d = dish as DishWithPhotos;

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">{d.name}</h1>
        {d.description && (
          <p className="text-gray-500 mt-1">{d.description}</p>
        )}
        {d.price != null && (
          <p className="text-lg font-semibold text-gray-900 mt-2">
            €{d.price.toFixed(2)}
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Photos */}
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-3">
            Source photos ({d.dish_photos?.length ?? 0})
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {d.dish_photos
              ?.sort((a, b) => a.sort_order - b.sort_order)
              .map((photo) => (
                <div key={photo.id} className="aspect-square rounded-lg overflow-hidden bg-gray-100">
                  <img
                    src={photo.photo_url}
                    alt={`Photo ${photo.sort_order + 1}`}
                    className="w-full h-full object-cover"
                  />
                </div>
              ))}
          </div>
        </div>

        {/* 3D Model */}
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-3">3D Model</h2>

          {d.model_status === "succeeded" && d.glb_url ? (
            <ModelViewer
              glbUrl={d.glb_url}
              usdzUrl={d.usdz_url ?? undefined}
              posterUrl={d.poster_url ?? undefined}
              dishName={d.name}
            />
          ) : (
            <ModelStatusPoller
              dishId={d.id}
              initialStatus={d.model_status}
            />
          )}
        </div>
      </div>
    </div>
  );
}
