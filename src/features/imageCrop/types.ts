export type ImageCropRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export type ImageCropResult = {
  crop: ImageCropRect;
};

export type ImageCropOptions = {
  originalFile: File;
  existingCrop?: ImageCropRect;
  existingImageUrl?: string;
  onConfirm: (result: ImageCropResult) => void;
  onCancel?: () => void;
};

export type ImageCropSession = ImageCropOptions & {
  id: string;
};

