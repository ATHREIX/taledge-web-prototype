import { useState, useEffect, useCallback } from 'react';

export interface Violation {
  type: string;
  timestamp: Date;
  details?: string;
}

// The number of integrity violations tolerated before the candidate is flagged.
// Exported so the UI's "(n/THRESHOLD)" label and the isCheating gate stay in sync.
export const VIOLATION_THRESHOLD = 3;

export const useProctoring = (active: boolean = true) => {
  const [violations, setViolations] = useState<Violation[]>([]);

  const addViolation = useCallback((type: string, details?: string) => {
    setViolations(prev => [...prev, { type, timestamp: new Date(), details }]);
  }, []);

  useEffect(() => {
    // Only track once the session is active, so benign interactions on the
    // standby/pre-interview screen don't accumulate toward the strike count.
    if (!active) return;

    // 1. Tab switching detection
    const handleVisibilityChange = () => {
      if (document.hidden || document.visibilityState === 'hidden') {
        addViolation('tab_switch', 'User switched tabs or minimized the window');
      }
    };

    // 2. Disable copy, paste, cut
    const handleCopyPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      addViolation('clipboard', `User attempted to ${e.type}`);
    };

    // 3. Disable right-click context menu
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      addViolation('context_menu', 'User attempted to open context menu (right-click)');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('copy', handleCopyPaste);
    document.addEventListener('paste', handleCopyPaste);
    document.addEventListener('cut', handleCopyPaste);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('copy', handleCopyPaste);
      document.removeEventListener('paste', handleCopyPaste);
      document.removeEventListener('cut', handleCopyPaste);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [addViolation, active]);

  return {
    violations,
    // Only flag once the advertised threshold is reached, so a single benign
    // right-click / accidental Ctrl+C no longer trips the "/3" integrity badge.
    isCheating: violations.length >= VIOLATION_THRESHOLD,
  };
};
