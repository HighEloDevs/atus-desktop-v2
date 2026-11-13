/**
 * @module
 * Mounts the React application into the document.
 */

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { AppToaster } from "./components/ui/sonner";
import "./styles/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <AppToaster />
  </StrictMode>,
);
