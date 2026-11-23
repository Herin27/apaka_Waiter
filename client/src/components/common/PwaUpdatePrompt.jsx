import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '../ui';

export default function PwaUpdatePrompt() {
  const [needsRefresh, setNeedsRefresh] = useState(false);

  useEffect(() => {
    const onNeedRefresh = () => setNeedsRefresh(true);
    window.addEventListener('aw:pwa-update-available', onNeedRefresh);
    return () => window.removeEventListener('aw:pwa-update-available', onNeedRefresh);
  }, []);

  if (!needsRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 rounded-2xl bg-surface-2 border border-accent px-4 py-3 shadow-orange-glow">
      <span className="text-xs font-bold text-white">New app update ready!</span>
      <Button size="sm" variant="primary" onClick={() => window.location.reload()}>
        <RefreshCw className="h-3.5 w-3.5" />
        Reload
      </Button>
    </div>
  );
}
