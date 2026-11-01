import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Layout from "./components/layout";
import Overview from "./pages/Overview";
import Agents from "./pages/Agents";
import AgentDetail from "./pages/AgentDetail";
import AttackLab from "./pages/AttackLab";
import Policies from "./pages/Policies";
import Runs from "./pages/Runs";
import RunDetail from "./pages/RunDetail";
import Evidence from "./pages/Evidence";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";

const qc = new QueryClient();

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Overview />} />
            <Route path="agents" element={<Agents />} />
            <Route path="agents/:id" element={<AgentDetail />} />
            <Route path="lab" element={<AttackLab />} />
            <Route path="policies" element={<Policies />} />
            <Route path="runs" element={<Runs />} />
            <Route path="runs/:id" element={<RunDetail />} />
            <Route path="evidence" element={<Evidence />} />
            <Route path="reports" element={<Reports />} />
            <Route path="settings" element={<Settings />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
