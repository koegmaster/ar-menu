"use client";

// Side-effect import — registers the <model-viewer> custom element in the browser
import "@google/model-viewer";

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
  return (
    <model-viewer
      src={glbUrl}
      ios-src={usdzUrl}
      poster={posterUrl}
      alt={`3D model of ${dishName}`}
      ar
      ar-modes="scene-viewer quick-look"
      ar-scale="fixed"
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
