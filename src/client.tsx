// Instrumentação do Sentry precisa ser o primeiro import, antes de qualquer
// outro código do client entry, conforme padrão @sentry/tanstackstart-react.
import "./instrument.client";

import { StrictMode, startTransition } from "react";
import { hydrateRoot } from "react-dom/client";
import { StartClient } from "@tanstack/react-start/client";

startTransition(() => {
  hydrateRoot(
    document,
    <StrictMode>
      <StartClient />
    </StrictMode>,
  );
});
