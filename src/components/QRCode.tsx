"use client";

import { useEffect, useRef } from "react";
import QRCodeLib from "qrcode";

interface QRCodeProps {
  url: string;
  size?: number;
  label?: string;
}

export default function QRCode({ url, size = 200, label }: QRCodeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    QRCodeLib.toCanvas(canvasRef.current, url, {
      width: size,
      margin: 2,
      color: { dark: "#000000", light: "#ffffff" },
    });
  }, [url, size]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${label ?? "qr-code"}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="rounded-xl overflow-hidden border border-gray-200 p-3 bg-white shadow-sm">
        <canvas ref={canvasRef} />
      </div>
      {label && (
        <p className="text-sm text-gray-600 text-center font-medium">{label}</p>
      )}
      <button
        onClick={handleDownload}
        className="text-sm text-orange-500 hover:text-orange-600 font-medium flex items-center gap-1"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
          />
        </svg>
        Download PNG
      </button>
    </div>
  );
}
