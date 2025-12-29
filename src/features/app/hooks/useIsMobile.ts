import { useEffect, useState } from "react";

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(max-width: 32.5rem)").matches;
  });

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 32.5rem)");
    const onChange = () => setIsMobile(mq.matches);

    if (typeof mq.addEventListener === "function") mq.addEventListener("change", onChange);
    // eslint-disable-next-line deprecation/deprecation
    else mq.addListener(onChange);

    return () => {
      if (typeof mq.removeEventListener === "function") mq.removeEventListener("change", onChange);
      // eslint-disable-next-line deprecation/deprecation
      else mq.removeListener(onChange);
    };
  }, []);

  return isMobile;
}
