import type { DetailedHTMLProps, HTMLAttributes } from "react";

type ModelViewerAttributes = DetailedHTMLProps<
  HTMLAttributes<HTMLElement>,
  HTMLElement
> & {
  // Source files
  src?: string;
  "ios-src"?: string;
  poster?: string;
  alt?: string;

  // Loading
  loading?: "auto" | "lazy" | "eager";
  reveal?: "auto" | "manual";

  // AR
  ar?: boolean | string;
  "ar-modes"?: string;
  "ar-scale"?: "auto" | "fixed";
  "ar-placement"?: "floor" | "wall";
  "ar-status"?: string;
  "xr-environment"?: boolean | string;

  // Camera / Controls
  "camera-controls"?: boolean | string;
  "touch-action"?: string;
  "disable-zoom"?: boolean | string;
  "disable-pan"?: boolean | string;
  "camera-orbit"?: string;
  "camera-target"?: string;
  "field-of-view"?: string;
  "max-camera-orbit"?: string;
  "min-camera-orbit"?: string;
  "interpolation-decay"?: number | string;

  // Staging / Environment
  "shadow-intensity"?: number | string;
  "shadow-softness"?: number | string;
  "environment-image"?: string;
  "skybox-image"?: string;
  exposure?: number | string;

  // Animation
  "auto-rotate"?: boolean | string;
  "auto-rotate-delay"?: number | string;
  "rotation-per-second"?: string;
  "animation-name"?: string;
  autoplay?: boolean | string;

  // Interaction prompt
  "interaction-prompt"?: "auto" | "none";
  "interaction-prompt-threshold"?: number | string;
};

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": ModelViewerAttributes;
    }
  }
}

export type { ModelViewerAttributes };
