import { useEffect, useRef } from "react";

type UseSessionTimeoutOptions = {
  enabled: boolean;
  timeoutMs?: number;
  onTimeout: () => void;
};

const DEFAULT_TIMEOUT_MS = 15 * 60 * 1000;
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "mousemove",
  "mousedown",
  "keydown",
  "scroll",
  "touchstart",
  "click",
];

export function useSessionTimeout({
  enabled,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  onTimeout,
}: UseSessionTimeoutOptions) {
  const timerRef = useRef<number | null>(null);
  const onTimeoutRef = useRef(onTimeout);

  useEffect(() => {
    onTimeoutRef.current = onTimeout;
  }, [onTimeout]);

  useEffect(() => {
    if (!enabled) {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    function resetTimer() {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }

      timerRef.current = window.setTimeout(() => {
        onTimeoutRef.current();
      }, timeoutMs);
    }

    ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, resetTimer, { passive: true });
    });

    resetTimer();

    return () => {
      ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, resetTimer);
      });

      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [enabled, timeoutMs]);
}
