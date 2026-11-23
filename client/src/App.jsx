import { useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import ToastProvider from './components/ui/ToastProvider';
import PwaUpdatePrompt from './components/common/PwaUpdatePrompt';
import ProtectedRoute from './components/common/ProtectedRoute';
import CustomerLayout from './layouts/CustomerLayout';
import DashboardLayout from './layouts/DashboardLayout';
import LandingPage from './pages/LandingPage';
import DemoModePage from './pages/DemoModePage';
import LoginPage from './pages/LoginPage';
import CustomerMenuPage from './pages/CustomerMenuPage';
import WaiterDashboardPage from './pages/WaiterDashboardPage';
import KitchenDashboardPage from './pages/KitchenDashboardPage';
import CashierDashboardPage from './pages/CashierDashboardPage';
import AdminDashboardPage from './pages/AdminDashboardPage';
import AdminFloorEditorPage from './pages/AdminFloorEditorPage';
import AdminMenuPage from './pages/AdminMenuPage';
import AdminTablesPage from './pages/AdminTablesPage';
import AdminStaffPage from './pages/AdminStaffPage';
import AdminSettingsPage from './pages/AdminSettingsPage';
import AdminCouponsPage from './pages/AdminCouponsPage';
import AdminActivityLogsPage from './pages/AdminActivityLogsPage';
import AdminAnalyticsPage from './pages/AdminAnalyticsPage';
import AdminInventoryPage from './pages/AdminInventoryPage';
import AdminFeedbackPage from './pages/AdminFeedbackPage';
import AdminCustomersPage from './pages/AdminCustomersPage';
import SuperAdminPage from './pages/SuperAdminPage';
import { initAudioUnlockListener } from './utils/sound';
import { useAuthStore } from './store/useAuthStore';

export default function App() {
  const fetchMe = useAuthStore((s) => s.fetchMe);

  useEffect(() => {
    const cleanupAudio = initAudioUnlockListener();
    fetchMe();
    return cleanupAudio;
  }, [fetchMe]);

  return (
    <BrowserRouter>
      <ToastProvider />
      <PwaUpdatePrompt />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/demo" element={<DemoModePage />} />
        <Route path="/login" element={<LoginPage />} />

        <Route element={<CustomerLayout />}>
          <Route path="/t/:branchSlug/:token" element={<CustomerMenuPage />} />
        </Route>

        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['superadmin', 'admin', 'waiter', 'kitchen', 'cashier']}>
              <DashboardLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Navigate to="/login" replace />} />

          <Route
            path="super"
            element={
              <ProtectedRoute allowedRoles={['superadmin']}>
                <SuperAdminPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="waiter"
            element={
              <ProtectedRoute allowedRoles={['waiter', 'admin', 'superadmin']}>
                <WaiterDashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="kitchen"
            element={
              <ProtectedRoute allowedRoles={['kitchen', 'admin', 'superadmin']}>
                <KitchenDashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="cashier"
            element={
              <ProtectedRoute allowedRoles={['cashier', 'admin', 'superadmin']}>
                <CashierDashboardPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="admin"
            element={
              <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                <AdminDashboardPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/analytics"
            element={
              <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                <AdminAnalyticsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/floor"
            element={
              <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                <AdminFloorEditorPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/menu"
            element={
              <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                <AdminMenuPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/inventory"
            element={
              <ProtectedRoute allowedRoles={['admin', 'kitchen', 'superadmin']}>
                <AdminInventoryPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/tables"
            element={
              <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                <AdminTablesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/staff"
            element={
              <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                <AdminStaffPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/coupons"
            element={
              <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                <AdminCouponsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/customers"
            element={
              <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                <AdminCustomersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/feedback"
            element={
              <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                <AdminFeedbackPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/settings"
            element={
              <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                <AdminSettingsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="admin/logs"
            element={
              <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
                <AdminActivityLogsPage />
              </ProtectedRoute>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
