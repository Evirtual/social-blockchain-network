import { createContext } from "react";
import type { ImageCropOptions } from "../types";

export type ImageCropContextValue = {
  openImageCrop: (options: ImageCropOptions) => void;
};

export const ImageCropContext = createContext<ImageCropContextValue | null>(null);

