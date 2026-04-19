"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";

type Props = {
  message: string | null;
  variant: "success" | "error";
  onDismiss: () => void;
};

export function KaihatsuToast({ message, variant, onDismiss }: Props) {
  useEffect(() => {
    if (!message) return;
    const t = window.setTimeout(onDismiss, 3000);
    return () => window.clearTimeout(t);
  }, [message, onDismiss]);

  return (
    <AnimatePresence>
      {message ? (
        <motion.div
          role="status"
          initial={{ x: 120, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: 120, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 28 }}
          className={`fixed bottom-6 right-6 z-[100] max-w-sm rounded-xl border px-4 py-3 text-sm shadow-xl ${
            variant === "error"
              ? "border-red-800/80 bg-red-950/95 text-red-100"
              : "border-slate-600 bg-slate-900/95 text-slate-100"
          }`}
        >
          {message}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
