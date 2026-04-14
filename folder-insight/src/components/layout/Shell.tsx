import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import ScanConfigModal from "../scan/ScanConfigModal";
import ScanProgressOverlay from "../scan/ScanProgressOverlay";
import { useAppStore } from "../../store/appStore";

export default function Shell() {
  const status = useAppStore((s) => s.session.status);

  return (
    <div className="flex h-screen overflow-hidden bg-surface">
      <Sidebar />

      <div className="flex-1 flex flex-col ml-60 min-w-0">
        <main className="flex-1 overflow-y-auto">
          <Outlet />
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
