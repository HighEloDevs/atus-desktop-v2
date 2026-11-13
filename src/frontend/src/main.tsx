/**
 * @module
 * Mounts the React application into the document. The quick analysis window runs the same
 * bundle and is told apart by its window label (or `?window=quick` in a plain browser).
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import App from "./App";
import { AppToaster } from "./components/ui/sonner";
import { QuickAnalysisWindow } from "./features/quick-analysis/QuickAnalysisWindow";
import { QUICK_WINDOW_LABEL } from "./features/quick-analysis/quick-analysis-client";
import "./styles/globals.css";

const label = isTauri()
  ? getCurrentWindow().label
  : new URLSearchParams(window.location.search).get("window");

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {label === QUICK_WINDOW_LABEL ? (
      <QuickAnalysisWindow />
    ) : (
      <>
        <App />
        <AppToaster />
      </>
    )}
  </StrictMode>,
);
