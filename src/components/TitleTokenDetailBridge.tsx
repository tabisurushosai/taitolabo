"use client";

import { createContext, useCallback, useContext, useMemo, useRef, type ReactNode } from "react";

type OpenHandler = (token: string) => void;

type TitleTokenDetailBridgeValue = {
  /**
   * トークンクラウド（TitleAnatomy）と同じモーダルを開く。
   * ハンドラ未登録時（クラウド非表示など）は false。
   */
  requestOpenTitleTokenDetail: (token: string) => boolean;
  /** TitleAnatomy がマウント時に登録する */
  registerOpenHandler: (fn: OpenHandler) => () => void;
};

const TitleTokenDetailBridgeContext = createContext<TitleTokenDetailBridgeValue | null>(null);

export function TitleTokenDetailBridgeProvider({ children }: { children: ReactNode }) {
  const handlerRef = useRef<OpenHandler | null>(null);

  const registerOpenHandler = useCallback((fn: OpenHandler) => {
    handlerRef.current = fn;
    return () => {
      if (handlerRef.current === fn) handlerRef.current = null;
    };
  }, []);

  const requestOpenTitleTokenDetail = useCallback((token: string) => {
    const h = handlerRef.current;
    if (h == null) return false;
    h(token);
    return true;
  }, []);

  const value = useMemo(
    () => ({ requestOpenTitleTokenDetail, registerOpenHandler }),
    [requestOpenTitleTokenDetail, registerOpenHandler]
  );

  return (
    <TitleTokenDetailBridgeContext.Provider value={value}>{children}</TitleTokenDetailBridgeContext.Provider>
  );
}

export function useTitleTokenDetailBridge(): TitleTokenDetailBridgeValue {
  const v = useContext(TitleTokenDetailBridgeContext);
  if (v == null) {
    throw new Error("useTitleTokenDetailBridge は TitleTokenDetailBridgeProvider 内で使ってください");
  }
  return v;
}

export function useOptionalTitleTokenDetailBridge(): TitleTokenDetailBridgeValue | null {
  return useContext(TitleTokenDetailBridgeContext);
}
