import { useCallback, useMemo, useState, type ReactNode } from "react";
import { ImageCropContext, type ImageCropContextValue } from "./imageCropStateContext";
import { type ImageCropOptions, type ImageCropSession } from "../types";
import { ImageCropDialog } from "../components/ImageCropDialog";

export function ImageCropProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<ImageCropSession | null>(null);

  const openImageCrop = useCallback((options: ImageCropOptions) => {
    setSession((prev) => {
      if (prev) return prev;
      return {
        id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        ...options
      };
    });
  }, []);

  const dialog = useMemo(() => {
    if (!session) return null;
    const handleClose = (reason: "cancel" | "completed") => {
      if (reason === "cancel" && session.onCancel) {
        session.onCancel();
      }
      setSession(null);
    };
    return <ImageCropDialog key={session.id} session={session} onClose={handleClose} />;
  }, [session]);

  const contextValue = useMemo<ImageCropContextValue>(() => ({ openImageCrop }), [openImageCrop]);

  return (
    <ImageCropContext.Provider value={contextValue}>
      {children}
      {dialog}
    </ImageCropContext.Provider>
  );
}

