import { useEffect, useRef, useState } from 'react';

export function useWakeLock(enabled = true) {
  const wakeLockRef = useRef(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return;
    }

    let cancelled = false;

    const requestLock = async () => {
      try {
        if (document.visibilityState !== 'visible') return;
        const sentinel = await navigator.wakeLock.request('screen');
        if (cancelled) {
          await sentinel.release();
          return;
        }
        wakeLockRef.current = sentinel;
        setIsActive(true);
        sentinel.addEventListener('release', () => {
          setIsActive(false);
        });
      } catch {
        setIsActive(false);
      }
    };

    requestLock();

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        requestLock();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', handleVisibility);
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
      setIsActive(false);
    };
  }, [enabled]);

  return isActive;
}
