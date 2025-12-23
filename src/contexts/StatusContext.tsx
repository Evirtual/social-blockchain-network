import { createContext, useCallback, useContext, useMemo, useState } from "react";

export type StatusContextValue = {
  status: string;
  setStatus: (next: string) => void;
  clearStatus: () => void;
};

const StatusContext = createContext<StatusContextValue | null>(null);

export function StatusProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatusState] = useState<string>("Wallet disconnected");

  const setStatus = useCallback((next: string) => {
    setStatusState(next);
  }, []);

  const clearStatus = useCallback(() => {
    setStatusState("");
  }, []);

  const value = useMemo<StatusContextValue>(
    () => ({
      status,
      setStatus,
      clearStatus
    }),
    [status, setStatus, clearStatus]
  );

  return <StatusContext.Provider value={value}>{children}</StatusContext.Provider>;
}

export function useStatus() {
  const ctx = useContext(StatusContext);
  if (!ctx) throw new Error("useStatus must be used within <StatusProvider>");
  return ctx;
}
