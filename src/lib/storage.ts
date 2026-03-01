import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { rescaleGlb } from "./rescale-glb";
import { rescaleUsdz } from "./rescale-usdz";

// Use service role for server-side storage operations
function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export const BUCKETS = {
  PHOTOS: "photos",
  MODELS: "models",
} as const;

/**
 * Upload a photo file to Supabase Storage.
 * Returns the public URL.
 */
export async function uploadPhoto(
  restaurantId: string,
  dishId: string,
  file: File,
  sortOrder: number
): Promise<string> {
  const supabase = getAdminClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${restaurantId}/${dishId}/${sortOrder}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKETS.PHOTOS)
    .upload(path, file, {
      contentType: file.type,
      upsert: true,
    });

  if (error) throw new Error(`Photo upload failed: ${error.message}`);

  return getPublicUrl(BUCKETS.PHOTOS, path);
}

/**
 * Download a model file from a remote URL (e.g. Meshy presigned URL)
 * and upload it to Supabase Storage.
 * Returns the public URL.
 *
 * @param scaleFactor - If provided, rescale the USDZ with this factor instead
 *   of skipping it. Pass the factor returned by rescaleGlb for the companion
 *   GLB file so both formats use identical scale values.
 */
export async function uploadModelFromUrl(
  restaurantId: string,
  dishId: string,
  remoteUrl: string,
  format: "glb" | "usdz",
  scaleFactor?: number | null
): Promise<string> {
  const supabase = getAdminClient();

  // Download from Meshy
  const res = await fetch(remoteUrl);
  if (!res.ok) {
    throw new Error(`Failed to download ${format} from Meshy: ${res.status}`);
  }
  const rawBuffer = await res.arrayBuffer();
  let data: Uint8Array | ArrayBuffer = new Uint8Array(rawBuffer);

  if (format === "glb") {
    // Rescale GLB to plate-sized (~30cm) so AR viewers display the correct size.
    // We bake the scale into vertex data so Scene Viewer (Android) respects it.
    try {
      const rescaled = await rescaleGlb(data as Uint8Array);
      data = rescaled.buffer;
    } catch (err) {
      console.error("[storage] GLB rescale failed, uploading original:", err);
    }
  } else if (format === "usdz" && scaleFactor != null) {
    // Apply the same scale factor to the USDZ by injecting a root.usda wrapper.
    // This ensures iOS AR Quick Look also renders at the correct ~30cm size.
    try {
      data = rescaleUsdz(data as Uint8Array, scaleFactor);
    } catch (err) {
      console.error("[storage] USDZ rescale failed, uploading original:", err);
    }
  }

  const contentType =
    format === "glb" ? "model/gltf-binary" : "model/vnd.usdz+zip";
  const path = `${restaurantId}/${dishId}/model.${format}`;

  const { error } = await supabase.storage
    .from(BUCKETS.MODELS)
    .upload(path, data, {
      contentType,
      upsert: true,
    });

  if (error) throw new Error(`Model upload failed: ${error.message}`);

  return getPublicUrl(BUCKETS.MODELS, path);
}

/**
 * Download and upload both GLB and USDZ models from Meshy CDN to Supabase
 * Storage. The GLB is rescaled first to ~30cm; the same scale factor is then
 * applied to the USDZ so both AR viewers get the correct physical size.
 *
 * Returns [glbPublicUrl, usdzPublicUrl].
 */
export async function uploadBothModelsFromUrls(
  restaurantId: string,
  dishId: string,
  glbRemoteUrl: string,
  usdzRemoteUrl: string
): Promise<[string, string]> {
  // Download both in parallel
  const [glbRes, usdzRes] = await Promise.all([
    fetch(glbRemoteUrl),
    fetch(usdzRemoteUrl),
  ]);
  if (!glbRes.ok)
    throw new Error(`Failed to download GLB from Meshy: ${glbRes.status}`);
  if (!usdzRes.ok)
    throw new Error(`Failed to download USDZ from Meshy: ${usdzRes.status}`);

  const [glbRaw, usdzRaw] = await Promise.all([
    glbRes.arrayBuffer(),
    usdzRes.arrayBuffer(),
  ]);

  const supabase = getAdminClient();

  // --- GLB: rescale, upload ---
  let glbData: Uint8Array = new Uint8Array(glbRaw);
  let scaleFactor: number | null = null;
  try {
    const rescaled = await rescaleGlb(glbData);
    glbData = rescaled.buffer;
    scaleFactor = rescaled.scaleFactor;
  } catch (err) {
    console.error("[storage] GLB rescale failed, uploading original:", err);
  }

  const glbPath = `${restaurantId}/${dishId}/model.glb`;
  const { error: glbErr } = await supabase.storage
    .from(BUCKETS.MODELS)
    .upload(glbPath, glbData, { contentType: "model/gltf-binary", upsert: true });
  if (glbErr) throw new Error(`GLB upload failed: ${glbErr.message}`);

  // --- USDZ: apply same scale factor, upload ---
  let usdzData: Uint8Array = new Uint8Array(usdzRaw);
  if (scaleFactor != null) {
    try {
      usdzData = rescaleUsdz(usdzData, scaleFactor);
    } catch (err) {
      console.error("[storage] USDZ rescale failed, uploading original:", err);
    }
  }

  const usdzPath = `${restaurantId}/${dishId}/model.usdz`;
  const { error: usdzErr } = await supabase.storage
    .from(BUCKETS.MODELS)
    .upload(usdzPath, usdzData, { contentType: "model/vnd.usdz+zip", upsert: true });
  if (usdzErr) throw new Error(`USDZ upload failed: ${usdzErr.message}`);

  return [
    getPublicUrl(BUCKETS.MODELS, glbPath),
    getPublicUrl(BUCKETS.MODELS, usdzPath),
  ];
}

/**
 * Download a thumbnail from a remote URL and upload to Supabase Storage.
 * Returns the public URL.
 */
export async function uploadThumbnailFromUrl(
  restaurantId: string,
  dishId: string,
  remoteUrl: string
): Promise<string> {
  const supabase = getAdminClient();

  const res = await fetch(remoteUrl);
  if (!res.ok) {
    throw new Error(`Failed to download thumbnail: ${res.status}`);
  }
  const buffer = await res.arrayBuffer();
  const path = `${restaurantId}/${dishId}/thumbnail.png`;

  const { error } = await supabase.storage
    .from(BUCKETS.PHOTOS)
    .upload(path, buffer, {
      contentType: "image/png",
      upsert: true,
    });

  if (error) throw new Error(`Thumbnail upload failed: ${error.message}`);

  return getPublicUrl(BUCKETS.PHOTOS, path);
}

/**
 * Get the public URL for a file in Supabase Storage.
 */
export function getPublicUrl(bucket: string, path: string): string {
  const supabase = getAdminClient();
  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  return data.publicUrl;
}
