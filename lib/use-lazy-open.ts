"use client";

import { useState } from "react";

/**
 * For a dialog or menu whose code loads lazily (`React.lazy` in `Suspense`, with a copy of its
 * trigger as the fallback). Until the code arrives that copy has no click handler, so on a slow
 * connection a click on it would be lost. Spread `placeholderProps` on the copy: a click marks it
 * busy and is remembered, and `defaultOpen`, passed to the dialog, opens it as soon as it loads.
 */
export function useLazyOpen() {
  const [requested, setRequested] = useState(false);
  return {
    defaultOpen: requested,
    placeholderProps: {
      "aria-busy": requested || undefined,
      onClick: () => setRequested(true),
    },
  };
}
