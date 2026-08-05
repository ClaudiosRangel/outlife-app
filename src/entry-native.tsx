// Ponto de entrada client-only usado exclusivamente pelo SPA_Build_Target
// (Outlife_Native_Shell/Capacitor). Diferente de `src/client.tsx`
// (hidratação SSR via `StartClient`, usado pelo SSR_Build_Target), este
// entry monta a árvore de rotas do zero no navegador/WebView via
// `RouterProvider`, sem depender de nenhum HTML pré-renderizado no
// servidor — consistente com a ausência de server functions em tempo de
// execução no SPA_Build_Target (Requirement 1.2, 1.6).
import "./instrument.client";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import "./styles.css";

const router = getRouter();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Elemento #root não encontrado em index.html.");
}

createRoot(rootElement).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
