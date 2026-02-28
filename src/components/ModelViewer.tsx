"use client";

import dynamic from "next/dynamic";

const ModelViewerInner = dynamic(() => import("./ModelViewerInner"), {
  ssr: false,
  loading: () => (
    <div className="flex aspect-square w-full items-center justify-center rounded-xl bg-gray-100 animate-pulse">
      <span className="text-sm text-gray-400">Loading 3D viewer…</span>
    </div>
  ),
});

interface ModelViewerProps {
  glbUrl: string;
  usdzUrl?: string;
  posterUrl?: string;
  dishName: string;
  className?: string;
}

export default function ModelViewer(props: ModelViewerProps) {
  return <ModelViewerInner {...props} />;
}
