import { AppProvider } from "./contexts/AppContext";
import { TxNotificationsProvider } from "./contexts/TxNotificationsContext";
import { AppShell } from "./AppShell";

export default function App() {
  return (
    <TxNotificationsProvider>
      <AppProvider>
        <AppShell />
      </AppProvider>
    </TxNotificationsProvider>
  );
}