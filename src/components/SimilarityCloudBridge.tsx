"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type BridgeValue = {
  /** 類似検索が完了したあと、API の tokens を入れる。クリア時は null。 */
  cloudMatchTokens: ReadonlySet<string> | null;
  setCloudMatchTokens: (tokens: readonly string[] | null) => void;
};

const SimilarityCloudBridgeContext = createContext<BridgeValue | null>(null);

export function SimilarityCloudBridgeProvider({ children }: { children: ReactNode }) {
  const [cloudMatchTokens, setTokens] = useState<ReadonlySet<string> | null>(null);

  const setCloudMatchTokens = useCallback((tokens: readonly string[] | null) => {
    setTokens(tokens === null || tokens.length === 0 ? null : new Set(tokens));
  }, []);

  const value = useMemo(
    () => ({ cloudMatchTokens, setCloudMatchTokens }),
    [cloudMatchTokens, setCloudMatchTokens]
  );

  return (
    <SimilarityCloudBridgeContext.Provider value={value}>{children}</SimilarityCloudBridgeContext.Provider>
  );
}

export function useSimilarityCloudBridge(): BridgeValue {
  const ctx = useContext(SimilarityCloudBridgeContext);
  if (ctx === null) {
    return {
      cloudMatchTokens: null,
      setCloudMatchTokens: () => {
        /* no-op outside provider */
      },
    };
  }
  return ctx;
}
