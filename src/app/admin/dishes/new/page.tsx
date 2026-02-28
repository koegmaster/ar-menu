"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import PhotoUpload from "@/components/PhotoUpload";

const DEMO_RESTAURANT_ID = process.env.NEXT_PUBLIC_DEMO_RESTAURANT_ID ?? "";

export default function NewDishPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Dish name is required");
    if (photos.length === 0) return setError("At least 1 photo is required");

    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.set("name", name.trim());
      formData.set("restaurantId", DEMO_RESTAURANT_ID);
      if (description.trim()) formData.set("description", description.trim());
      if (price) formData.set("price", price);
      photos.forEach((f) => formData.append("photos", f));

      // Create dish + upload photos
      const res = await fetch("/api/dishes", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to create dish");
      }

      const dish = await res.json();

      // Kick off 3D generation
      const genRes = await fetch("/api/meshy/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dishId: dish.id }),
      });

      if (!genRes.ok) {
        // Don't block navigation — generation failure is recoverable from the detail page
        console.warn("3D generation failed to start:", await genRes.text());
      }

      router.push(`/admin/dishes/${dish.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Add dish</h1>
        <p className="text-gray-500 mt-1">
          Upload 2–4 photos from different angles for best 3D results
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Dish name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Spaghetti Carbonara"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            required
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description{" "}
            <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Ingredients, allergens, etc."
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
          />
        </div>

        {/* Price */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Price{" "}
            <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
              €
            </span>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              step="0.01"
              min="0"
              className="w-full border border-gray-200 rounded-lg pl-7 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-300"
            />
          </div>
        </div>

        {/* Photos */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Photos <span className="text-red-400">*</span>
          </label>
          <PhotoUpload onChange={setPhotos} maxPhotos={4} />
        </div>

        {error && (
          <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || photos.length === 0}
          className="w-full bg-orange-500 text-white py-3 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? "Creating dish & starting 3D generation…" : "Add dish & generate 3D model"}
        </button>
      </form>
    </div>
  );
}
