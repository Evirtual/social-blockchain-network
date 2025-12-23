import { AppProvider } from "./contexts/AppContext";
import { ContractProvider } from "./contexts/ContractContext";
import { StatusProvider } from "./contexts/StatusContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { TxNotificationsProvider } from "./contexts/TxNotificationsContext";
import { WalletProvider } from "./contexts/WalletContext";
import { AppShell } from "./AppShell";

export default function App() {
  return (
    <TxNotificationsProvider>
      <StatusProvider>
        <ThemeProvider>
          <WalletProvider>
            <ContractProvider>
              <AppProvider>
                <AppShell />
              </AppProvider>
            </ContractProvider>
          </WalletProvider>
        </ThemeProvider>
      </StatusProvider>
    </TxNotificationsProvider>
  );
}