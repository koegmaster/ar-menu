# Plan: AR Scaling Fix + Minimum 2 Photos

## Overview
Two changes:
1. **Fix AR scaling** — rescale GLB files server-side to 30cm so AR viewers display correct size
2. **Enforce minimum 2 photos** — prevent single-photo generation (bad color quality)

---

## Part 1: Server-side GLB Rescaling

### 1.1 New file: `src/lib/rescale-glb.ts`

Uses `@gltf-transform/core` + `@gltf-transform/functions` + `gl-matrix` (already installed).

```typescript
import { NodeIO } from "@gltf-transform/core";
import { getBounds, transformMesh } from "@gltf-transform/functions";
import { fromScaling } from "gl-matrix/mat4";

const TARGET_SIZE_METERS = 0.3;

export async function rescaleGlb(glbBuffer: Uint8Array): Promise<Uint8Array> {
  const io = new NodeIO();
  const document = await io.readBinary(glbBuffer);

  const scene =
    document.getRoot().getDefaultScene() ??
    document.getRoot().listScenes()[0];

  if (!scene) {
    console.warn("[rescaleGlb] GLB has no scene; skipping rescale");
    return glbBuffer;
  }

  const { min, max } = getBounds(scene);
  const sizeX = max[0] - min[0];
  const sizeZ = max[2] - min[2];
  const largestHorizontal = Math.max(sizeX, sizeZ);

  if (largestHorizontal <= 0) {
    console.warn("[rescaleGlb] Model has zero horizontal extent; skipping");
    return glbBuffer;
  }

  const factor = TARGET_SIZE_METERS / largestHorizontal;

  const matrix = fromScaling(
    new Float32Array(16) as unknown as Parameters<typeof fromScaling>[0],
    [factor, factor, factor]
  );

  for (const mesh of document.getRoot().listMeshes()) {
    transformMesh(mesh, matrix as unknown as Parameters<typeof transformMesh>[1]);
  }

  return io.writeBinary(document);
}
```

### 1.2 Modify `src/lib/storage.ts` — `uploadModelFromUrl()`

After downloading the GLB buffer from Meshy, run it through `rescaleGlb()` before uploading to Supabase.

**Change in `uploadModelFromUrl()`:**
```typescript
import { rescaleGlb } from "./rescale-glb";

// Inside uploadModelFromUrl, after downloading:
let buffer = await res.arrayBuffer();

// Rescale GLB to plate-sized (~30cm) for correct AR display
if (format === "glb") {
  try {
    const rescaled = await rescaleGlb(new Uint8Array(buffer));
    buffer = rescaled.buffer;
  } catch (err) {
    console.error("[storage] GLB rescale failed, uploading original:", err);
  }
}
```

### 1.3 Modify `src/components/ModelViewerInner.tsx`

- **Remove** the entire `useEffect` with `getDimensions()` / `scale` logic
- **Remove** the `useRef` typed with `getDimensions`/`scale`
- **Change** `ar-scale` from `"auto"` to `"fixed"` — the GLB is now authored at correct size
- **Remove** `ios-src={usdzUrl}` — let model-viewer convert the rescaled GLB to USDZ on the fly for iOS (since we can't rescale USDZ server-side)
- **Keep** the `usdzUrl` prop in the interface for now (no breaking change)

Simplified component:
```tsx
"use client";
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
  posterUrl,
  dishName,
  className,
}: ModelViewerInnerProps) {
  return (
    <model-viewer
      src={glbUrl}
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
      {/* AR button */}
      <button slot="ar-button" style={/* ... existing styles ... */}>
        View on your table
      </button>
    </model-viewer>
  );
}
```

---

## Part 2: Enforce Minimum 2 Photos

### 2.1 Modify `src/app/admin/(protected)/dishes/new/page.tsx`

**Line 42**: Change validation:
```typescript
// Before:
if (photos.length === 0) return setError("At least 1 photo is required");
// After:
if (photos.length < 2) return setError("At least 2 photos are required for good 3D results");
```

**Line 185**: Update disabled check:
```typescript
// Before:
disabled={loading || photos.length === 0}
// After:
disabled={loading || photos.length < 2}
```

### 2.2 Modify `src/app/api/meshy/generate/route.ts`

**After line 40**: Update server-side validation:
```typescript
// Before:
if (photos.length === 0) {
  return NextResponse.json({ error: "Dish has no photos" }, { status: 400 });
}
// After:
if (photos.length < 2) {
  return NextResponse.json(
    { error: "At least 2 photos are required for good 3D results" },
    { status: 400 }
  );
}
```

### 2.3 Modify `src/components/PhotoUpload.tsx`

Update the guidance text (line 137-138):
```tsx
// Before:
<p className="text-xs text-gray-400">
  Best results: shoot from front, side, 45°, and top
</p>
// After:
<p className="text-xs text-gray-400">
  Minimum 2 photos required — shoot from front, side, 45°, and top
</p>
```

---

## Files Modified
| File | Change |
|---|---|
| `src/lib/rescale-glb.ts` | **NEW** — GLB rescaling utility |
| `src/lib/storage.ts` | Rescale GLB in `uploadModelFromUrl()` before uploading |
| `src/components/ModelViewerInner.tsx` | Remove JS scaling, ar-scale="fixed", drop ios-src |
| `src/app/admin/(protected)/dishes/new/page.tsx` | Require 2+ photos |
| `src/app/api/meshy/generate/route.ts` | Server-side 2-photo minimum |
| `src/components/PhotoUpload.tsx` | Updated guidance text |

## Dependencies Installed
- `@gltf-transform/core` — GLB parsing/writing
- `@gltf-transform/functions` — getBounds, transformMesh
- `gl-matrix` — mat4 for scale matrix

## Risks / Notes
- **USDZ on iOS**: By omitting `ios-src`, model-viewer will convert the rescaled GLB to USDZ on the fly. This should work but may be slightly slower than a pre-built USDZ. If iOS AR doesn't work, we may need to investigate further.
- **Existing models**: Already-uploaded models in Supabase won't be rescaled. Would need a one-time migration script if needed, or just re-generate affected dishes.
- **Vercel timeout**: The rescaling runs inside `after()` (background), so it won't block the response. `gltf-transform` is fast (~50ms for typical models) so this shouldn't push past Vercel's timeout.
