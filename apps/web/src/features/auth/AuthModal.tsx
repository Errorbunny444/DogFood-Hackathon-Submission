import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, Mail, Lock, User, ArrowRight, CheckCircle2, AlertTriangle, ShieldCheck } from 'lucide-react';
import { apiClient } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, defaultTab = 'login' }) => {
  const { login, register, appConfig } = useAuth();
  const [mode, setMode] = useState<'login' | 'register' | 'forgot' | 'reset'>(defaultTab);

  // Form states
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    setMode(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      if (mode === 'login') {
        await login(email, password);
        onClose();
      } else if (mode === 'register') {
        const res = await register(email, password, displayName);
        if (res.verificationToken && appConfig.demoEnabled) {
          setSuccessMsg(
            `Account created! (Demo token: ${res.verificationToken.slice(0, 16)}...)`
          );
        } else {
          setSuccessMsg('Account created successfully! Welcome to DOGFOOD.');
        }
        setTimeout(() => onClose(), 1200);
      } else if (mode === 'forgot') {
        const res = await apiClient.post('/auth/forgot-password', { email });
        setSuccessMsg(res.message);
        if (res.resetToken) {
          setResetToken(res.resetToken);
          setMode('reset');
        }
      } else if (mode === 'reset') {
        const res = await apiClient.post('/auth/reset-password', { token: resetToken, newPassword });
        setSuccessMsg(res.message);
        setTimeout(() => setMode('login'), 2000);
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/60 dark:bg-black/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div className="min-h-full flex items-center justify-center p-4">
        <div
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative my-8 animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>

        {/* Modal Header */}
        <div className="text-center mb-6">
          <div className="w-11 h-11 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center mx-auto mb-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            {mode === 'login' && 'Welcome to DOGFOOD'}
            {mode === 'register' && 'Create Your Account'}
            {mode === 'forgot' && 'Reset Your Password'}
            {mode === 'reset' && 'Enter New Password'}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {mode === 'login' && 'Sign in to manage hackathons, submit projects, and review'}
            {mode === 'register' && 'Join as an organizer, participant, or judge'}
            {mode === 'forgot' && 'Enter your email to receive recovery instructions'}
            {mode === 'reset' && 'Choose a strong password with at least 8 characters'}
          </p>
        </div>

        {/* Tab Switcher for Login/Register */}
        {(mode === 'login' || mode === 'register') && (
          <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 mb-6">
            <button
              onClick={() => {
                setMode('login');
                setError(null);
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'login'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setMode('register');
                setError(null);
              }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                mode === 'register'
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              Register
            </button>
          </div>
        )}

        {/* Feedback alerts */}
        {error && (
          <div className="p-3 mb-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 mb-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Elena Rostova"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-slate-400 dark:focus:border-slate-600"
                />
              </div>
            </div>
          )}

          {(mode === 'login' || mode === 'register' || mode === 'forgot') && (
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="organizer@example.com"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-slate-400 dark:focus:border-slate-600"
                />
              </div>
            </div>
          )}

          {(mode === 'login' || mode === 'register') && (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold uppercase text-slate-700 dark:text-slate-300">Password</label>
                {mode === 'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot');
                      setError(null);
                    }}
                    className="text-[11px] text-emerald-700 dark:text-emerald-400 hover:underline"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === 'register' ? 'Minimum 8 characters' : '••••••••'}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-slate-400 dark:focus:border-slate-600"
                />
              </div>
            </div>
          )}

          {mode === 'reset' && (
            <>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                  Reset Token
                </label>
                <input
                  type="text"
                  required
                  value={resetToken}
                  onChange={(e) => setResetToken(e.target.value)}
                  placeholder="Paste recovery token"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs font-mono text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-slate-400 dark:focus:border-slate-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-2 text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-slate-400 dark:focus:border-slate-600"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-semibold text-xs transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 mt-2"
          >
            <span>
              {loading
                ? 'Processing...'
                : mode === 'login'
                ? 'Sign In'
                : mode === 'register'
                ? 'Create Account'
                : mode === 'forgot'
                ? 'Send Recovery Instructions'
                : 'Set New Password'}
            </span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </form>

        {(mode === 'forgot' || mode === 'reset') && (
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setMode('login');
                setError(null);
                setSuccessMsg(null);
              }}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
            >
              ← Back to Sign In
            </button>
          </div>
        )}
      </div>
    </div>
  </div>,
  document.body
);
};
