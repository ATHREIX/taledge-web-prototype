"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * App-wide toast system. Mount <ToastProvider> once (in the root layout); call
 * `useToast().toast(message, tone)` anywhere. Safe no-op if used without the
 * provider. Auto-dismisses; also dismissable by click.
 */
type Tone = "success" | "error" | "info";
type ToastItem = { id: number; message: string; tone: Tone };

const ToastContext = createContext<{ toast: (message: string, tone?: Tone) => void }>({
  toast: () => {},
});

export const useToast = () => useContext(ToastContext);

let counter = 0;

const toneStyles: Record<Tone, { ring: string; icon: string; mark: string }> = {
  success: { ring: "border-emerald-200", icon: "bg-emerald-500", mark: "✓" },
  error: { ring: "border-rose-200", icon: "bg-rose-500", mark: "!" },
  info: { ring: "border-brand-200", icon: "bg-brand-600", mark: "i" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, tone: Tone = "info") => {
      const id = ++counter;
      setToasts((t) => [...t, { id, message, tone }]);
      // Auto-dismiss after 4s.
      setTimeout(() => dismiss(id), 4000);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-full max-w-sm flex-col gap-2.5"
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const s = toneStyles[t.tone];
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, scale: 0.98 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                role={t.tone === "error" ? "alert" : "status"}
                aria-live={t.tone === "error" ? "assertive" : "polite"}
                onClick={() => dismiss(t.id)}
                className={cn(
                  "pointer-events-auto flex cursor-pointer items-start gap-3 rounded-xl border bg-white px-4 py-3 shadow-[0_16px_44px_-18px_rgba(16,24,40,0.3)]",
                  s.ring
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white", s.icon)}
                >
                  {s.mark}
                </span>
                <p className="text-[13.5px] font-medium leading-snug text-ink-800">{t.message}</p>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
