import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Globe, Wifi, WifiOff } from 'lucide-react';
import BrandLogo from '../components/common/BrandLogo';
import Footer from '../components/common/Footer';
import { useUIStore } from '../store/useUIStore';
import { useSessionStore } from '../store/useSessionStore';

const LANGUAGES = [
  { code: 'en', label: 'EN' },
  { code: 'hi', label: 'हिं' },
  { code: 'gu', label: 'ગુ' },
];

export default function CustomerLayout() {
  const { i18n } = useTranslation();
  const { language, setLanguage, socketConnected } = useUIStore();
  const table = useSessionStore((s) => s.table);

  const handleLanguageSwitch = (code) => {
    setLanguage(code);
    i18n.changeLanguage(code);
  };

  return (
    <div className="min-h-screen flex flex-col bg-dotted-grid text-white">
      <header className="sticky top-0 z-30 glass-surface border-b border-border-subtle">
        <div className="mx-auto flex h-14 max-w-xl items-center justify-between px-4">
          <BrandLogo size="sm" />

          <div className="flex items-center gap-2">
            {table?.name && (
              <span className="rounded-xl bg-accent/15 border border-accent/35 px-2.5 py-1 text-xs font-bold text-accent">
                Table {table.name}
              </span>
            )}

            <div
              role="group"
              aria-label="Select Language"
              className="flex items-center rounded-xl bg-surface-2 border border-border-subtle p-0.5"
            >
              <Globe className="h-3.5 w-3.5 text-zinc-400 ml-1.5 mr-1" />
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  aria-label={`Language ${lang.label}`}
                  onClick={() => handleLanguageSwitch(lang.code)}
                  className={`px-2 py-0.5 text-[11px] font-semibold rounded-lg transition cursor-pointer ${
                    language === lang.code
                      ? 'bg-accent text-white'
                      : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  {lang.label}
                </button>
              ))}
            </div>

            <span
              title={socketConnected ? 'Live sync connected' : 'Offline / Connecting'}
              className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2 border border-border-subtle"
            >
              {socketConnected ? (
                <Wifi className="h-3.5 w-3.5 text-emerald-400" />
              ) : (
                <WifiOff className="h-3.5 w-3.5 text-zinc-500" />
              )}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-5">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
