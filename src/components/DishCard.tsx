import Link from "next/link";
import type { DishWithPhotos, ModelStatus } from "@/types/database";

const STATUS_CONFIG: Record<
  ModelStatus,
  { label: string; className: string }
> = {
  pending: {
    label: "No model",
    className: "bg-gray-100 text-gray-600",
  },
  processing: {
    label: "Generating…",
    className: "bg-yellow-100 text-yellow-700 animate-pulse",
  },
  succeeded: {
    label: "3D ready",
    className: "bg-green-100 text-green-700",
  },
  failed: {
    label: "Failed",
    className: "bg-red-100 text-red-600",
  },
};

interface DishCardProps {
  dish: DishWithPhotos;
  href: string;
}

export default function DishCard({ dish, href }: DishCardProps) {
  const status = STATUS_CONFIG[dish.model_status] ?? STATUS_CONFIG.pending;
  const firstPhoto = dish.dish_photos?.[0]?.photo_url;
  const thumbnail = dish.poster_url ?? firstPhoto;

  return (
    <Link
      href={href}
      className="group block rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition-shadow bg-white"
    >
      {/* Thumbnail */}
      <div className="aspect-square bg-gray-50 relative overflow-hidden">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={dish.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-300">
            <svg
              className="w-12 h-12"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
        {/* Status badge */}
        <span
          className={`absolute top-2 right-2 text-xs font-medium px-2 py-0.5 rounded-full ${status.className}`}
        >
          {status.label}
        </span>
      </div>

      {/* Info */}
      <div className="p-3">
        <h3 className="font-medium text-gray-900 truncate">{dish.name}</h3>
        <div className="flex items-center justify-between mt-1">
          {dish.price != null ? (
            <span className="text-sm text-gray-600">
              €{dish.price.toFixed(2)}
            </span>
          ) : (
            <span className="text-sm text-gray-400">No price</span>
          )}
          <span className="text-xs text-gray-400">
            {dish.dish_photos?.length ?? 0} photo
            {dish.dish_photos?.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </Link>
  );
}
