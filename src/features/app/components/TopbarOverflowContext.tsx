import type { ReactNode } from "react";
import { createContext, useContext, useMemo, useState } from "react";

export type TopbarOverflowAction = {
  id: string;
  label: string;
  icon?: ReactNode;
  className?: string;
  onClick: () => void;
};

type TopbarOverflowContextValue = {
  actions: TopbarOverflowAction[];
  setActions: (next: TopbarOverflowAction[]) => void;

  panel: ReactNode | null;
  setPanel: (next: ReactNode | null) => void;
};

const TopbarOverflowContext = createContext<TopbarOverflowContextValue | null>(null);

export function TopbarOverflowProvider(props: { children: ReactNode }) {
  const [actions, setActions] = useState<TopbarOverflowAction[]>([]);
  const [panel, setPanel] = useState<ReactNode | null>(null);

  const value = useMemo<TopbarOverflowContextValue>(
    () => ({ actions, setActions, panel, setPanel }),
    [actions, panel]
  );

  return <TopbarOverflowContext.Provider value={value}>{props.children}</TopbarOverflowContext.Provider>;
}

export function useTopbarOverflow() {
  const ctx = useContext(TopbarOverflowContext);
  if (!ctx) {
    return FALLBACK_OVERFLOW;
  }
  return ctx;
}

const FALLBACK_OVERFLOW = {
  actions: [] as TopbarOverflowAction[],
  setActions: () => {
    // no-op when provider is missing
  },
  panel: null as ReactNode | null,
  setPanel: () => {
    // no-op when provider is missing
  }
};
