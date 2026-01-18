import { useContext } from "react";
import { ImageCropContext } from "../providers/imageCropStateContext";

export function useImageCrop() {
  const context = useContext(ImageCropContext);
  if (!context) {
    throw new Error("useImageCrop must be used within an ImageCropProvider");
  }
  return context;
}

