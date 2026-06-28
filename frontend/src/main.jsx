// main.jsx — Punto de entrada de React
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";

// Reset CSS mínimo (sin frameworks externos)
const style = document.createElement("style");
style.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  input[type="number"]::-webkit-inner-spin-button,
  input[type="number"]::-webkit-outer-spin-button { opacity: 1; }
  ::-webkit-scrollbar { width: 6px; height: 6px; }
  ::-webkit-scrollbar-track { background: #F0F0F0; }
  ::-webkit-scrollbar-thumb { background: #CCCCCC; border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: #AAAAAA; }
`;
document.head.appendChild(style);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);