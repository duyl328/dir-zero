import { useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import ScanConfigModal from "../scan/ScanConfigModal";
import ScanProgressOverlay from "../scan/ScanProgressOverlay";
import { useAppStore } from "../../store/appStore";
import OverviewPage from "../../pages/OverviewPage";
import FindProblemsPage from "../../pages/FindProblemsPage";
import FileTypesPage from "../../pages/FileTypesPage";
import SettingsPage from "../../pages/SettingsPage";

export default function Shell() {
  const status = useAppStore((s) => s.session.status);
  const { pathname } = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar />

      <div className="flex-1 flex flex-col ml-60 min-w-0">
        <main className="flex-1 overflow-hidden relative">
          {/* All pages stay mounted; CSS controls visibility to preserve in-progress state */}
          <div className={["h-full overflow-y-auto", pathname === "/overview" ? "" : "hidden"].join(" ")}>
            <OverviewPage />
          </div>
          <div className={["h-full overflow-hidden", pathname === "/problems" ? "" : "hidden"].join(" ")}>
            <FindProblemsPage />
          </div>
          <div className={["h-full overflow-y-auto", pathname === "/types" ? "" : "hidden"].join(" ")}>
            <FileTypesPage />
          </div>
          <div className={["h-full overflow-y-auto", pathname === "/settings" ? "" : "hidden"].join(" ")}>
            <SettingsPage />
          </div>
        </main>
      </div>

      {/* Modals / overlays */}
      {status === "configuring" && <ScanConfigModal />}
      {status === "scanning" && <ScanProgressOverlay />}

      {/* Background ambient glow */}
      <div className="fixed top-0 right-0 w-1/3 h-1/2 bg-primary/5 blur-[120px] rounded-full -z-10 pointer-events-none" />
      <div className="fixed bottom-0 left-1/4 w-1/4 h-1/3 bg-tertiary/5 blur-[100px] rounded-full -z-10 pointer-events-none" />
    </div>
  );
}
