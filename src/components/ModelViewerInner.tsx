"use client";

// Side-effect import — registers the <model-viewer> custom element in the browser
import "@google/model-viewer";
import { useEffect, useRef } from "react";

// Target real-world size for a dish in AR: ~30cm (a typical dinner plate diameter)
const TARGET_SIZE_METERS = 0.30;

interface ModelViewerInnerProps {
  glbUrl: string;
  usdzUrl?: string;
  posterUrl?: string;
  dishName: string;
  className?: string;
}

export default function ModelViewerInner({
  glbUrl,
  usdzUrl,
  posterUrl,
  dishName,
  className,
}: ModelViewerInnerProps) {
  const ref = useRef<HTMLElement & {
    getBoundingBoxCenter: () => { x: number; y: number; z: number };
    getDimensions: () => { x: number; y: number; z: number };
    scale: string;
  }>(null);

  useEffect(() => {
    const mv = ref.current;
    if (!mv) return;

    function onLoad() {
      if (!mv) return;
      try {
        const dimensions = mv.getDimensions();
        // Use the largest horizontal/depth dimension — ignore height (y) so a
        // tall garnish doesn't shrink the whole plate to a postage stamp.
        const maxDim = Math.max(dimensions.x, dimensions.z);
        if (maxDim <= 0) return;
        const factor = TARGET_SIZE_METERS / maxDim;
        mv.scale = `${factor} ${factor} ${factor}`;
      } catch {
        // getDimensions() may not be available in all model-viewer versions;
        // fail silently and fall back to the default ar-scale="auto" behaviour.
      }
    }

    mv.addEventListener("load", onLoad);
    return () => mv.removeEventListener("load", onLoad);
  }, [glbUrl]);

  return (
    <model-viewer
      ref={ref as React.Ref<HTMLElement>}
      src={glbUrl}
      ios-src={usdzUrl}
      poster={posterUrl}
      alt={`3D model of ${dishName}`}
      ar
      ar-modes="scene-viewer quick-look"
      ar-scale="auto"
      ar-placement="floor"
      camera-controls
      touch-action="pan-y"
      shadow-intensity="1"
      shadow-softness="0.8"
      auto-rotate
      auto-rotate-delay="1000"
      interaction-prompt="auto"
      style={{
        width: "100%",
        aspectRatio: "1",
        backgroundColor: "transparent",
      }}
      className={className}
    >
      {/* AR button — only visible on AR-capable devices */}
      <button
        slot="ar-button"
        style={{
          backgroundColor: "white",
          borderRadius: "999px",
          border: "1px solid #e5e7eb",
          position: "absolute",
          bottom: "16px",
          left: "50%",
          transform: "translateX(-50%)",
          padding: "10px 20px",
          fontSize: "14px",
          fontWeight: 500,
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          cursor: "pointer",
          whiteSpace: "nowrap",
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        View on your table
      </button>
    </model-viewer>
  );
}
