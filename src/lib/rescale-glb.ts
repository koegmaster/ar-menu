import { NodeIO } from "@gltf-transform/core";
import { getBounds, transformMesh } from "@gltf-transform/functions";
import { mat4 } from "gl-matrix";

/**
 * Target real-world size: 30cm — a typical dinner plate diameter.
 * We normalize the largest horizontal (X or Z) dimension to this value.
 */
const TARGET_SIZE_METERS = 0.3;

/**
 * Compute the uniform scale factor needed to normalise a GLB's largest
 * horizontal dimension to TARGET_SIZE_METERS.  Returns null if the model has
 * no scene or zero extent (caller should skip rescaling).
 */
export async function getGlbScaleFactor(glbBuffer: Uint8Array): Promise<number | null> {
  const io = new NodeIO();
  const document = await io.readBinary(glbBuffer);

  const scene =
    document.getRoot().getDefaultScene() ??
    document.getRoot().listScenes()[0];

  if (!scene) return null;

  const { min, max } = getBounds(scene);
  const sizeX = max[0] - min[0];
  const sizeZ = max[2] - min[2];
  const largestHorizontal = Math.max(sizeX, sizeZ);

  if (largestHorizontal <= 0) return null;

  return TARGET_SIZE_METERS / largestHorizontal;
}

/**
 * Rescale a GLB binary so the largest horizontal dimension (X or Z) of its
 * bounding box is exactly TARGET_SIZE_METERS.  The scale is applied uniformly
 * to all three axes so proportions are preserved.
 *
 * The transform is baked into vertex positions (not node transforms), so every
 * viewer — including AR Quick Look and Scene Viewer — will see the correct size
 * without needing any runtime scale adjustments.
 *
 * Returns `{ buffer, scaleFactor }` so the caller can reuse the factor (e.g.
 * to apply the same scale to the companion USDZ file).
 */
export async function rescaleGlb(
  glbBuffer: Uint8Array
): Promise<{ buffer: Uint8Array; scaleFactor: number | null }> {
  const io = new NodeIO();
  const document = await io.readBinary(glbBuffer);

  const scene =
    document.getRoot().getDefaultScene() ??
    document.getRoot().listScenes()[0];

  if (!scene) {
    console.warn("[rescaleGlb] GLB has no scene; skipping rescale");
    return { buffer: glbBuffer, scaleFactor: null };
  }

  const { min, max } = getBounds(scene);
  const sizeX = max[0] - min[0];
  const sizeZ = max[2] - min[2];
  const largestHorizontal = Math.max(sizeX, sizeZ);

  if (largestHorizontal <= 0) {
    console.warn("[rescaleGlb] Model has zero horizontal extent; skipping");
    return { buffer: glbBuffer, scaleFactor: null };
  }

  const factor = TARGET_SIZE_METERS / largestHorizontal;

  // Build a uniform scale matrix (gl-matrix mat4 is a Float32Array of 16)
  const matrix = mat4.fromScaling(mat4.create(), [factor, factor, factor]);

  // Bake the scale into every mesh's vertex data
  for (const mesh of document.getRoot().listMeshes()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transformMesh(mesh, matrix as any);
  }

  return { buffer: await io.writeBinary(document), scaleFactor: factor };
}
