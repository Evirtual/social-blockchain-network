import type { ReactNode } from "react";
import { useEffect } from "react";
import { useTopbarSlots } from "../components/TopbarSlotsContext";

export function useTopbarCenter(node: ReactNode | null) {
  const { setCenter } = useTopbarSlots();

  useEffect(() => {
    setCenter(node);
    return () => setCenter(null);
  }, [node, setCenter]);
}
