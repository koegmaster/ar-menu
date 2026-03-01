"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type DishStatus = "pending" | "processing" | "succeeded" | "failed";

interface ModelStatusPollerProps {
  dishId: string;
  initialStatus: DishStatus;
}

const POLL_INTERVAL_MS = 3000;

function progressKey(dishId: string) {
  return `meshy_progress_${dishId}`;
}

function readSavedProgress(dishId: string): number {
  try {
    return parseInt(sessionStorage.getItem(progressKey(dishId)) ?? "0", 10) || 0;
  } catch {
    return 0;
  }
}

function saveProgress(dishId: string, value: number) {
  try {
    sessionStorage.setItem(progressKey(dishId), String(value));
  } catch {}
}

function clearProgress(dishId: string) {
  try {
    sessionStorage.removeItem(progressKey(dishId));
  } catch {}
}

export default function ModelStatusPoller({
  dishId,
  initialStatus,
}: ModelStatusPollerProps) {
  const router = useRouter();

  // Initialise progress from sessionStorage so refreshes don't reset to 0
  const [progress, setProgress] = useState(() =>
    initialStatus === "processing" ? readSavedProgress(dishId) : 0
  );
  const [displayProgress, setDisplayProgress] = useState(() =>
    initialStatus === "processing" ? readSavedProgress(dishId) : 0
  );
  const [status, setStatus] = useState<DishStatus>(initialStatus);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Smooth animation — step toward `progress` a few points at a time
  useEffect(() => {
    const diff = progress - displayProgress;
    if (diff <= 0) return;
    const step = Math.max(1, Math.round(diff / 5));
    const id = setTimeout(
      () => setDisplayProgress((p) => Math.min(progress, p + step)),
      60
    );
    return () => clearTimeout(id);
  }, [progress, displayProgress]);

  // Polling loop — only active while processing
  useEffect(() => {
    if (status !== "processing") return;

    async function poll() {
      try {
        const res = await fetch(`/api/meshy/task?dishId=${dishId}`);

        if (!res.ok) {
          scheduleNext();
          return;
        }

        const data = await res.json();

        const isDone =
          data.status === "succeeded" ||
          data.meshyStatus === "SUCCEEDED";

        if (isDone) {
          saveProgress(dishId, 100);
          setProgress(100);
          setDisplayProgress(100);
          setStatus("succeeded");
          // Brief pause so the bar visually fills before navigating
          setTimeout(() => {
            clearProgress(dishId);
            router.refresh();
          }, 800);
          return;
        }

        if (data.meshyStatus === "FAILED" || data.meshyStatus === "CANCELED") {
          clearProgress(dishId);
          setStatus("failed");
          return;
        }

        if (typeof data.meshyProgress === "number" && data.meshyProgress > 0) {
          saveProgress(dishId, data.meshyProgress);
          setProgress(data.meshyProgress);
        }

        scheduleNext();
      } catch {
        // Transient network error — keep trying
        scheduleNext();
      }
    }

    function scheduleNext() {
      timerRef.current = setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dishId, status, router]);

  async function handleGenerate() {
    setError(null);
    clearProgress(dishId);
    setProgress(0);
    setDisplayProgress(0);

    const res = await fetch("/api/meshy/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ dishId }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to start generation");
      return;
    }

    setStatus("processing");
  }

  // ── Rendering ────────────────────────────────────────────────────────────

  if (status === "processing") {
    return (
      <div className="aspect-square rounded-xl bg-orange-50 border border-orange-100 flex flex-col items-center justify-center gap-5 px-8">
        {/* Ring with % in the centre */}
        <div className="relative flex items-center justify-center">
          <div className="w-12 h-12 rounded-full border-[3px] border-orange-200" />
          <div className="absolute w-12 h-12 rounded-full border-[3px] border-orange-500 border-t-transparent animate-spin" />
          <span className="absolute text-xs font-semibold text-orange-600">
            {displayProgress}%
          </span>
        </div>

        {/* Progress bar */}
        <div className="w-full">
          <div className="flex justify-between text-xs text-orange-500 mb-1.5">
            <span>Generating 3D model…</span>
            <span>{displayProgress}%</span>
          </div>
          <div className="w-full h-2 bg-orange-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${displayProgress}%` }}
            />
          </div>
          <p className="text-xs text-orange-400 mt-2 text-center">
            Usually takes 2–5 minutes
          </p>
        </div>
      </div>
    );
  }

  if (status === "succeeded") {
    return (
      <div className="aspect-square rounded-xl bg-green-50 border border-green-100 flex flex-col items-center justify-center gap-3">
        <svg className="w-10 h-10 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        <p className="text-sm text-green-700 font-medium">Model ready! Loading…</p>
        <div className="w-32 h-1.5 bg-green-200 rounded-full overflow-hidden">
          <div className="h-full w-full bg-green-500 rounded-full" />
        </div>
      </div>
    );
  }

  // pending or failed → show generate button
  return (
    <div className="aspect-square rounded-xl bg-gray-50 border border-dashed border-gray-200 flex flex-col items-center justify-center gap-3">
      <p className="text-sm text-gray-500 text-center px-4">
        {status === "failed"
          ? "Generation failed. Try again?"
          : "No 3D model yet."}
      </p>
      <button
        onClick={handleGenerate}
        className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600 transition-colors"
      >
        {status === "failed" ? "Retry 3D generation" : "Generate 3D model"}
      </button>
      {error && (
        <p className="text-xs text-red-500 text-center px-4">{error}</p>
      )}
    </div>
  );
}
