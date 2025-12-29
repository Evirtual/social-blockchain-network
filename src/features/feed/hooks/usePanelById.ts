import { useCallback, useState } from "react";

export type PanelState<TPanel extends string> = TPanel | null;

export function usePanelById<TPanel extends string>() {
  const [panelById, setPanelById] = useState<Record<string, PanelState<TPanel>>>({});

  const getPanel = useCallback((id: string): PanelState<TPanel> => panelById[id] ?? null, [panelById]);

  const setPanel = useCallback((id: string, next: PanelState<TPanel>) => {
    setPanelById((prev) => ({ ...prev, [id]: next }));
  }, []);

  const togglePanel = useCallback((id: string, panel: TPanel) => {
    setPanelById((prev) => ({ ...prev, [id]: prev[id] === panel ? null : panel }));
  }, []);

  const closePanel = useCallback((id: string) => {
    setPanelById((prev) => ({ ...prev, [id]: null }));
  }, []);

  return { panelById, getPanel, setPanel, togglePanel, closePanel };
}
