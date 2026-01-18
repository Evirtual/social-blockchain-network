import { useEffect, useRef, useState } from "react";

export function useObjectUrl(value: Blob | MediaSource | null | undefined) {
  const currentUrlRef = useRef<string | null>(null);
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    if (!value) {
      if (currentUrlRef.current) {
        URL.revokeObjectURL(currentUrlRef.current);
        currentUrlRef.current = null;
      }
      setUrl("");
      return;
    }

    const next = URL.createObjectURL(value);
    if (currentUrlRef.current) {
      URL.revokeObjectURL(currentUrlRef.current);
    }
    currentUrlRef.current = next;
    setUrl(next);

    return () => {
      if (currentUrlRef.current === next) {
        URL.revokeObjectURL(next);
        currentUrlRef.current = null;
      } else {
        URL.revokeObjectURL(next);
      }
    };
  }, [value]);

  return url;
}

