import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { isChessPath } from "../../shared/src/index.ts";
import { App } from "./App.tsx";
import { ChessApp } from "./chess/ChessApp.tsx";
import "./styles.css";

const ROOT_ID = "root";

const container = document.getElementById(ROOT_ID);
if (container === null) {
  throw new Error(`element #${ROOT_ID} not found`);
}
createRoot(container).render(<StrictMode>{isChessPath(window.location.pathname) ? <ChessApp /> : <App />}</StrictMode>);
