import { createClient } from "@/lib/supabase/server";
import QRCode from "@/components/QRCode";
import type { DishWithPhotos } from "@/types/database";

const DEMO_RESTAURANT_ID = process.env.NEXT_PUBLIC_DEMO_RESTAURANT_ID ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export default async function QRCodesPage() {
  const supabase = await createClient();

  const { data: dishes } = await supabase
    .from("dishes")
    .select("*, dish_photos(*)")
    .eq("restaurant_id", DEMO_RESTAURANT_ID)
    .eq("model_status", "succeeded")
    .order("name");

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">QR Codes</h1>
        <p className="text-gray-500 mt-1">
          Print these and place them next to each dish on your menu
        </p>
      </div>

      {!dishes || dishes.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-gray-200">
          <p className="text-gray-500">
            No dishes with 3D models yet. Generate some models first.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-6">
          {(dishes as DishWithPhotos[]).map((dish) => {
            const dishUrl = `${APP_URL}/r/${DEMO_RESTAURANT_ID}/dishes/${dish.id}`;
            return (
              <div
                key={dish.id}
                className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col items-center gap-3"
              >
                <QRCode url={dishUrl} size={180} label={dish.name} />
                {dish.price != null && (
                  <p className="text-sm text-gray-500">€{dish.price.toFixed(2)}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
