import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import "./styles.css";

const ROOT_ID = "root";

const container = document.getElementById(ROOT_ID);
if (container === null) {
  throw new Error(`element #${ROOT_ID} not found`);
}
createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
