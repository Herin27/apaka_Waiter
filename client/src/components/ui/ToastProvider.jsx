import { Toaster } from 'react-hot-toast';

export default function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3500,
        style: {
          background: '#1C1C1F',
          color: '#FFFFFF',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '14px',
          fontSize: '13px',
          boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        },
        success: {
          iconTheme: {
            primary: '#10B981',
            secondary: '#1C1C1F',
          },
        },
        error: {
          iconTheme: {
            primary: '#EF4444',
            secondary: '#1C1C1F',
          },
        },
      }}
    />
  );
}
