import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { createStableContext } from "@shared/lib/createStableContext";

export type StatusState = {
  status: string;
};

export type StatusActions = {
  setStatus: (next: string) => void;
  clearStatus: () => void;
};

export type StatusContextValue = StatusState & StatusActions;

const StatusStateContext = createStableContext("__sbnetStatusStateContext", () =>
  createContext<StatusState | null>(null)
);
const StatusActionsContext = createStableContext("__sbnetStatusActionsContext", () =>
  createContext<StatusActions | null>(null)
);
const StatusContext = createStableContext("__sbnetStatusContext", () =>
  createContext<StatusContextValue | null>(null)
);

export function StatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatusState] = useState<string>("Wallet disconnected");

  const clearStatus = useCallback(() => {
    setStatusState("");
  }, []);

  const stateValue = useMemo<StatusState>(() => ({ status }), [status]);
  const actionsValue = useMemo<StatusActions>(
    () => ({
      setStatus: setStatusState,
      clearStatus
    }),
    [clearStatus]
  );
  const value = useMemo<StatusContextValue>(() => ({ ...stateValue, ...actionsValue }), [stateValue, actionsValue]);

  return (
    <StatusStateContext.Provider value={stateValue}>
      <StatusActionsContext.Provider value={actionsValue}>
        <StatusContext.Provider value={value}>{children}</StatusContext.Provider>
      </StatusActionsContext.Provider>
    </StatusStateContext.Provider>
  );
}

export function useStatusState() {
  const ctx = useContext(StatusStateContext);
  if (!ctx) throw new Error("useStatusState must be used within <StatusProvider>");
  return ctx;
}

export function useStatusActions() {
  const ctx = useContext(StatusActionsContext);
  if (!ctx) throw new Error("useStatusActions must be used within <StatusProvider>");
  return ctx;
}
