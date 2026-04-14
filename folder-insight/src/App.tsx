import "./App.css";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Shell from "./components/layout/Shell";
import OverviewPage from "./pages/OverviewPage";
import FindProblemsPage from "./pages/FindProblemsPage";
import FileTypesPage from "./pages/FileTypesPage";
import SettingsPage from "./pages/SettingsPage";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Shell />}>
          <Route index element={<Navigate to="/overview" replace />} />
          <Route path="overview" element={<OverviewPage />} />
          <Route path="problems" element={<FindProblemsPage />} />
          <Route path="types" element={<FileTypesPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
