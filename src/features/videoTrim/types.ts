export type VideoTrimRange = {
  startMs: number;
  endMs: number;
};

export type VideoTrimResult = VideoTrimRange & {
  trimmedFile: File;
  thumbnailBlob: Blob;
  durationMs: number;
};

export type VideoTrimOptions = {
  /**
   * Original video File selected by the user.
   */
  originalFile: File;
  /**
   * Optional existing trim to seed the slider (e.g., when editing).
   */
  existingTrim?: VideoTrimRange;
  /**
   * Optional standalone video URL that may be used for informational UI
   * (e.g., reminding the user they are trimming a published clip).
   */
  existingVideoUrl?: string;
  /**
   * Called when the user confirms the trim. The new trimmed File becomes the
   * replacement media for the Compose/Edit flow.
   */
  onConfirm: (result: VideoTrimResult) => void;
  /**
   * Optional callback when the trim modal is dismissed without confirming.
  */
  onCancel?: () => void;
};

export type VideoTrimSession = VideoTrimOptions & {
  id: string;
};
