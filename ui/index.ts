// Public surface of our UI layer. Feature code imports from here (or "@/ui/*"),
// never from "@base-ui/react/*" directly — keeps the primitive library swappable.

export { cn } from "./cn";
export * from "./button-styles";
export { Button, type ButtonProps } from "./button";
export * from "./back-link";
export * from "./input";
export * from "./card";
export * from "./dialog";
export * from "./tooltip";
export * from "./popover";
export * from "./tabs";
export * from "./select-pill";
export * from "./progress";
export * from "./progress-ring";
export * from "./badge";
export * from "./avatar";
export { Mascot, type MascotProps, type MascotRegister, type MascotState } from "./mascot";
export {
  CelebrationOverlay,
  CelebrationOverlayHost,
  type CelebrationOverlayHostProps,
  type CelebrationOverlayProps,
} from "./celebration-overlay";
export {
  CollectibleToast,
  CollectibleToastHost,
  type CollectibleToastHostProps,
  type CollectibleToastProps,
} from "./collectible-toast";
export { CollectibleCard, type CollectibleCardProps } from "./collectible-card";
export * from "./stat";
export * from "./tts-button";
export * from "./skeleton";
export * from "./passage-library-client";
