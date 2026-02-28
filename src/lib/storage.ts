import { createClient as createSupabaseClient } from "@supabase/supabase-js";

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
 */
export async function uploadModelFromUrl(
  restaurantId: string,
  dishId: string,
  remoteUrl: string,
  format: "glb" | "usdz"
): Promise<string> {
  const supabase = getAdminClient();

  // Download from Meshy
  const res = await fetch(remoteUrl);
  if (!res.ok) {
    throw new Error(`Failed to download ${format} from Meshy: ${res.status}`);
  }
  const buffer = await res.arrayBuffer();

  const contentType =
    format === "glb" ? "model/gltf-binary" : "model/vnd.usdz+zip";
  const path = `${restaurantId}/${dishId}/model.${format}`;

  const { error } = await supabase.storage
    .from(BUCKETS.MODELS)
    .upload(path, buffer, {
      contentType,
      upsert: true,
    });

  if (error) throw new Error(`Model upload failed: ${error.message}`);

  return getPublicUrl(BUCKETS.MODELS, path);
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
