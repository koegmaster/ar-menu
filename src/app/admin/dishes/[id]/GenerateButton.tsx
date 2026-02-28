"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface GenerateButtonProps {
  dishId: string;
  hasFailed?: boolean;
}

export default function GenerateButton({ dishId, hasFailed }: GenerateButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);

    const res = await fetch("/api/meshy/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dishId }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to start generation");
      setLoading(false);
      return;
    }

    router.refresh();
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        onClick={handleGenerate}
        disabled={loading}
        className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {loading
          ? "Starting…"
          : hasFailed
          ? "Retry 3D generation"
          : "Generate 3D model"}
      </button>
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  );
}
