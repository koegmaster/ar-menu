const MESHY_BASE_URL = "https://api.meshy.ai";

function getHeaders() {
  return {
    Authorization: `Bearer ${process.env.MESHY_API_KEY}`,
    "Content-Type": "application/json",
  };
}

export interface MeshyTaskInput {
  imageUrls: string[]; // 1–4 public image URLs
  targetPolycount?: number;
  enablePbr?: boolean;
}

export interface MeshyModelUrls {
  glb: string;
  fbx?: string;
  obj?: string;
  usdz: string;
  mtl?: string;
}

export type MeshyTaskStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "SUCCEEDED"
  | "FAILED"
  | "CANCELED";

export interface MeshyTask {
  id: string;
  type: string;
  status: MeshyTaskStatus;
  progress: number;
  model_urls: MeshyModelUrls;
  thumbnail_url: string;
  created_at: number;
  started_at: number | null;
  finished_at: number | null;
  expires_at: number | null;
  task_error: { message: string } | null;
}

/**
 * Submit photos for 3D model generation.
 * Returns the Meshy task ID.
 */
export async function createMultiImageTask(
  input: MeshyTaskInput
): Promise<string> {
  if (input.imageUrls.length < 1 || input.imageUrls.length > 4) {
    throw new Error("Meshy multi-image requires 1–4 image URLs");
  }

  const body = {
    image_urls: input.imageUrls,
    ai_model: "meshy-6",
    should_texture: true,
    enable_pbr: input.enablePbr ?? true,
    topology: "triangle",
    target_polycount: input.targetPolycount ?? 30000,
    symmetry_mode: "auto",
    style_enhancement: false, // preserve photorealism for food
  };

  const res = await fetch(`${MESHY_BASE_URL}/openapi/v1/multi-image-to-3d`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Meshy create task failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  return data.result as string;
}

/**
 * Retrieve the current status + model URLs for a task.
 */
export async function getTask(taskId: string): Promise<MeshyTask> {
  const res = await fetch(
    `${MESHY_BASE_URL}/openapi/v1/multi-image-to-3d/${taskId}`,
    {
      headers: getHeaders(),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Meshy get task failed (${res.status}): ${err}`);
  }

  return res.json() as Promise<MeshyTask>;
}
