import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import ModelViewer from "@/components/ModelViewer";
import GenerateButton from "./GenerateButton";
import type { DishWithPhotos } from "@/types/database";

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  pending: { label: "No model yet", color: "text-gray-500" },
  processing: { label: "Generating 3D model…", color: "text-yellow-600" },
  succeeded: { label: "3D model ready", color: "text-green-600" },
  failed: { label: "Generation failed", color: "text-red-600" },
};

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
  const status = STATUS_LABELS[d.model_status] ?? STATUS_LABELS.pending;

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
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-medium text-gray-700">3D Model</h2>
            <span className={`text-xs font-medium ${status.color}`}>
              {status.label}
            </span>
          </div>

          {d.model_status === "succeeded" && d.glb_url ? (
            <ModelViewer
              glbUrl={d.glb_url}
              usdzUrl={d.usdz_url ?? undefined}
              posterUrl={d.poster_url ?? undefined}
              dishName={d.name}
            />
          ) : d.model_status === "processing" ? (
            <div className="aspect-square rounded-xl bg-yellow-50 border border-yellow-100 flex flex-col items-center justify-center gap-3">
              <div className="w-8 h-8 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-yellow-700 text-center px-4">
                Generating 3D model…<br />
                <span className="text-yellow-500 text-xs">This usually takes 2–5 minutes</span>
              </p>
            </div>
          ) : (
            <div className="aspect-square rounded-xl bg-gray-50 border border-dashed border-gray-200 flex flex-col items-center justify-center gap-3">
              <p className="text-sm text-gray-500 text-center px-4">
                {d.model_status === "failed"
                  ? "Generation failed. Try again below."
                  : "No 3D model yet."}
              </p>
              <GenerateButton dishId={d.id} hasFailed={d.model_status === "failed"} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
