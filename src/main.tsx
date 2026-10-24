import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/rajdhani/600.css";
import "@fontsource/rajdhani/700.css";
import "@fontsource/sora/400.css";
import "@fontsource/sora/600.css";
import "./styles.css";
import "./fluid.css";
import "./premium.css";
import { initPerf } from "./lib/perf";
import { loadTheme } from "./lib/util";
import { App } from "./App";

initPerf();
loadTheme();
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
