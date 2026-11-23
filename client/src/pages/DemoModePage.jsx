import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/axios';
import { useAuthStore } from '../store/useAuthStore';
import { Button, Card, Badge, Spinner } from '../components/ui';

export default function DemoModePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAdmin = ['admin', 'superadmin'].includes(user?.role);

  const [demoInfo, setDemoInfo] = useState(null);
  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    api
      .get('/public/demo/info')
      .then((res) => setDemoInfo(res.data.data))
      .catch(() => {});
  }, []);

  const handleSimulateOrder = async () => {
    setSimulating(true);
    try {
      const res = await api.post('/demo/simulate-customer');
      toast.success(res.data.data.message);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Admin login required to simulate orders');
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="min-h-screen bg-dotted-grid text-white p-6 flex items-center justify-center">
      <Card glow className="max-w-lg w-full p-6 space-y-5 text-center">
        <Badge tone="orange">
          <Sparkles className="h-3.5 w-3.5" />
          Interactive Sandbox Demo Mode
        </Badge>

        <h1 className="text-2xl font-extrabold text-white">Aapka Waiter Live Demo</h1>
        <p className="text-xs text-zinc-400 leading-relaxed">
          Explore the customer QR menu on <strong>Table {demoInfo?.tableName || 'T1'}</strong> at{' '}
          <strong>{demoInfo?.branchName || 'The Saffron Roast - Demo Cafe'}</strong>.
        </p>

        {!demoInfo ? (
          <div className="py-4 flex justify-center">
            <Spinner label="Loading demo table..." />
          </div>
        ) : (
          <div className="space-y-3">
            <Button
              size="lg"
              className="w-full"
              onClick={() =>
                navigate(`/t/${demoInfo.branchSlug}/${demoInfo.qrToken}`)
              }
            >
              Launch Demo Customer Menu (Table {demoInfo.tableName})
            </Button>

            {isAdmin && (
              <Button
                variant="secondary"
                size="md"
                loading={simulating}
                onClick={handleSimulateOrder}
                className="w-full"
              >
                <Zap className="h-4 w-4 text-accent" />
                Simulate Customer (Place Random Order)
              </Button>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
