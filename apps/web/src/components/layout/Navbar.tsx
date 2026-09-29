import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  ShieldCheck,
  Award,
  Vote,
  Gavel,
  Code2,
  Layers,
  Building2,
  Home,
  LogOut,
} from 'lucide-react';
import { useAuth, DemoPersona } from '../../context/AuthContext.js';
import { ThemeToggle } from './ThemeToggle.js';
import { AuthModal } from '../../features/auth/AuthModal.js';
import { AccountSettingsModal } from '../../features/auth/AccountSettingsModal.js';

export const Navbar: React.FC = () => {
  const { user, activePersona, switchPersona, appConfig, logout } = useAuth();
  const location = useLocation();
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const navLinks = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/gallery', label: 'Gallery', icon: Layers },
    { to: '/results', label: 'Leaderboard', icon: Award },
    { to: '/voting', label: 'Community Vote', icon: Vote },
    { to: '/organizations', label: 'Organizations', icon: Building2 },
    { to: '/participant', label: 'Participant', icon: Code2 },
    { to: '/judge', label: 'Judge Portal', icon: Gavel },
    { to: '/organizer', label: 'Integrity Center', icon: ShieldCheck, badge: 'Organizer' },
  ];

  const personas: { id: DemoPersona; label: string; role: string }[] = [
    { id: 'VISITOR', label: 'Visitor', role: 'Public' },
    { id: 'ORGANIZER', label: 'Organizer', role: 'Admin' },
    { id: 'JUDGE_A', label: 'Judge A (Tomas)', role: 'Judge' },
    { id: 'JUDGE_B', label: 'Judge B (Wei)', role: 'Judge' },
    { id: 'PARTICIPANT', label: 'Participant (Lucas)', role: 'Team' },
  ];

  return (
    <>
      <header className="sticky top-0 z-50 glass-panel border-b border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/85 transition-colors">
      {/* Top Demo Banner for Persona Switching (Demo Mode Only) */}
      {appConfig.demoEnabled && (
        <div className="bg-slate-100 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800/60 px-4 py-1.5 text-xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">DEMO ENVIRONMENT:</span>
            <span className="hidden sm:inline">Evaluate judge isolation & permissions live:</span>
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {personas.map((p) => {
              const isActive = activePersona === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => switchPersona(p.id)}
                  className={`px-2.5 py-1 rounded-md font-medium text-xs transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-emerald-600 text-white dark:bg-brand-500 dark:text-slate-950 shadow-sm font-semibold'
                      : 'bg-slate-200/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  <span>{p.label}</span>
                  <span
                    className={`text-[10px] px-1 py-0.2 rounded uppercase ${
                      isActive ? 'bg-black/20 text-white dark:text-slate-950' : 'bg-slate-300/80 dark:bg-slate-900/80 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {p.role}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Navigation Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Brand */}
          <Link to="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-5 h-5 text-emerald-400 dark:text-emerald-600" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">DOGFOOD</span>
                <span className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                  2026
                </span>
              </div>
              <p className="text-[10px] text-slate-500 dark:text-slate-400 -mt-0.5">Auditable Hackathon Infrastructure</p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.to === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.to);

              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                    isActive
                      ? 'bg-slate-100 dark:bg-slate-800/90 text-slate-900 dark:text-white font-semibold border border-slate-200 dark:border-slate-700/80 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100/60 dark:hover:bg-slate-800/40'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400 dark:text-slate-500'}`} />
                  <span>{item.label}</span>
                  {item.badge && (
                    <span className="text-[9px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25 px-1 rounded font-mono">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Action Controls: Theme Toggle & User Auth */}
          <div className="flex items-center gap-2.5">
            {/* Minimal Dark/Light Theme Toggle */}
            <ThemeToggle />

            {user ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-900 dark:hover:bg-slate-800/80 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 rounded-lg transition-colors text-left"
                  title="Account Settings & MFA"
                >
                  <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-emerald-400 border border-slate-300 dark:border-slate-700">
                    {user.displayName.charAt(0).toUpperCase()}
                  </div>
                  <div className="text-left hidden sm:block">
                    <div className="text-xs font-semibold text-slate-900 dark:text-slate-200">{user.displayName}</div>
                    <div className="text-[9px] text-slate-500 dark:text-slate-400 font-mono">
                      {user.globalRole === 'ADMIN' ? 'Admin' : user.sourceId || user.email.split('@')[0]}
                    </div>
                  </div>
                </button>
                <button
                  onClick={logout}
                  className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-rose-500 dark:text-slate-400 dark:hover:text-rose-400 transition-colors"
                  title="Sign Out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    setAuthTab('login');
                    setIsAuthOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Sign In
                </button>
                <button
                  onClick={() => {
                    setAuthTab('register');
                    setIsAuthOpen(true);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 transition-colors shadow-sm"
                >
                  Register
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>

    <AuthModal
      isOpen={isAuthOpen}
      onClose={() => setIsAuthOpen(false)}
      defaultTab={authTab}
    />
    <AccountSettingsModal
      isOpen={isSettingsOpen}
      onClose={() => setIsSettingsOpen(false)}
    />
  </>
  );
};
