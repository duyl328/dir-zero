import "./App.css";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import Shell from "./components/layout/Shell";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/overview" replace />} />
        <Route path="/*" element={<Shell />} />
      </Routes>
    </HashRouter>
  );
}
