import type { ReactNode } from "react";
import { createContext, useContext } from "react";

export type TopbarSlots = {
  center: ReactNode | null;
  setCenter: (node: ReactNode | null) => void;
};

const TopbarSlotsContext = createContext<TopbarSlots | null>(null);

export function TopbarSlotsProvider(props: { value: TopbarSlots; children: ReactNode }) {
  return <TopbarSlotsContext.Provider value={props.value}>{props.children}</TopbarSlotsContext.Provider>;
}

export function useTopbarSlots() {
  const ctx = useContext(TopbarSlotsContext);
  if (!ctx) throw new Error("useTopbarSlots must be used within TopbarSlotsProvider");
  return ctx;
}
