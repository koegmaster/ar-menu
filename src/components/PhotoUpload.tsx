"use client";

import { useRef, useState, useCallback } from "react";

interface PhotoUploadProps {
  onChange: (files: File[]) => void;
  maxPhotos?: number;
}

export default function PhotoUpload({
  onChange,
  maxPhotos = 4,
}: PhotoUploadProps) {
  const [previews, setPreviews] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const accepted = Array.from(newFiles)
        .filter((f) => f.type.startsWith("image/"))
        .slice(0, maxPhotos - files.length);

      if (accepted.length === 0) return;

      const updated = [...files, ...accepted].slice(0, maxPhotos);
      setFiles(updated);
      onChange(updated);

      // Generate previews
      accepted.forEach((file) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPreviews((prev) =>
            [...prev, e.target?.result as string].slice(0, maxPhotos)
          );
        };
        reader.readAsDataURL(file);
      });
    },
    [files, maxPhotos, onChange]
  );

  const removePhoto = (index: number) => {
    const updated = files.filter((_, i) => i !== index);
    const updatedPreviews = previews.filter((_, i) => i !== index);
    setFiles(updated);
    setPreviews(updatedPreviews);
    onChange(updated);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const canAddMore = files.length < maxPhotos;

  return (
    <div className="space-y-3">
      {/* Preview grid */}
      {previews.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {previews.map((src, i) => (
            <div key={i} className="relative aspect-square group">
              <img
                src={src}
                alt={`Photo ${i + 1}`}
                className="w-full h-full object-cover rounded-lg border border-gray-200"
              />
              <button
                type="button"
                onClick={() => removePhoto(i)}
                className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ×
              </button>
            </div>
          ))}
          {/* Empty slots */}
          {canAddMore &&
            Array.from({ length: maxPhotos - previews.length }).map((_, i) => (
              <div
                key={`empty-${i}`}
                className="aspect-square rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 text-xl"
              >
                +
              </div>
            ))}
        </div>
      )}

      {/* Drop zone */}
      {canAddMore && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => inputRef.current?.click()}
          className={`
            border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors
            ${
              dragging
                ? "border-orange-400 bg-orange-50"
                : "border-gray-200 hover:border-orange-300 hover:bg-gray-50"
            }
          `}
        >
          <div className="flex flex-col items-center gap-2">
            <svg
              className="w-8 h-8 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <p className="text-sm text-gray-600">
              <span className="font-medium text-orange-500">
                Click to upload
              </span>{" "}
              or drag and drop
            </p>
            <p className="text-xs text-gray-400">
              {files.length}/{maxPhotos} photos — JPG or PNG
            </p>
            <p className="text-xs text-gray-400">
              Minimum 2 photos required — front, side, 45°, and top
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={(e) => e.target.files && addFiles(e.target.files)}
          />
        </div>
      )}
    </div>
  );
}
