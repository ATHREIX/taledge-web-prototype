import { useState, useEffect, useCallback } from 'react';

export interface Violation {
  type: string;
  timestamp: Date;
  details?: string;
}

export const useProctoring = () => {
  const [violations, setViolations] = useState<Violation[]>([]);

  const addViolation = useCallback((type: string, details?: string) => {
    setViolations(prev => [...prev, { type, timestamp: new Date(), details }]);
  }, []);

  useEffect(() => {
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
  }, [addViolation]);

  return {
    violations,
    isCheating: violations.length > 0,
  };
};
