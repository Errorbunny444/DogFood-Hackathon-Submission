import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  User,
  Shield,
  Key,
  LogOut,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Laptop,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import { apiClient } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';

interface AccountSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AccountSettingsModal: React.FC<AccountSettingsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user, refreshUser, logout } = useAuth();
  const [tab, setTab] = useState<'profile' | 'security' | 'sessions'>('profile');

  // Profile form
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');

  // Password form
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // MFA state
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaSetupData, setMfaSetupData] = useState<{ secret: string; otpauthUrl: string } | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [backupCodes, setBackupCodes] = useState<string[]>([]);

  // Statuses
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    if (isOpen) {
      checkMfaStatus();
    }
  }, [isOpen]);

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

  const checkMfaStatus = async () => {
    try {
      const res = await apiClient.get<{ mfaEnabled: boolean }>('/auth/mfa/status');
      setMfaEnabled(res.mfaEnabled);
    } catch {}
  };

  if (!isOpen || !user) return null;

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg(null);
    try {
      await apiClient.patch('/auth/profile', { displayName, bio });
      await refreshUser();
      setStatusMsg({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg(null);
    try {
      await apiClient.post('/auth/change-password', { currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setStatusMsg({ type: 'success', text: 'Password changed successfully.' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to change password.' });
    } finally {
      setLoading(false);
    }
  };

  const handleStartMfaSetup = async () => {
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await apiClient.post<{ secret: string; otpauthUrl: string }>('/auth/mfa/setup');
      setMfaSetupData(res);
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to initialize MFA.' });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setStatusMsg(null);
    try {
      const res = await apiClient.post<{ success: boolean; backupCodes: string[] }>('/auth/mfa/verify', {
        code: mfaCode,
      });
      setMfaEnabled(true);
      setBackupCodes(res.backupCodes || []);
      setMfaSetupData(null);
      setMfaCode('');
      setStatusMsg({ type: 'success', text: 'Two-Factor Authentication successfully enabled!' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Invalid 6-digit TOTP code.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDisableMfa = async () => {
    if (!confirm('Are you sure you want to disable Two-Factor Authentication?')) return;
    setLoading(true);
    setStatusMsg(null);
    try {
      await apiClient.post('/auth/mfa/disable');
      setMfaEnabled(false);
      setBackupCodes([]);
      setStatusMsg({ type: 'success', text: 'Two-Factor Authentication disabled.' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to disable MFA.' });
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!confirm('Are you sure you want to sign out from all other devices?')) return;
    setLoading(true);
    try {
      await apiClient.post('/auth/sessions/revoke-all');
      setStatusMsg({ type: 'success', text: 'All other sessions have been revoked.' });
    } catch (err: any) {
      setStatusMsg({ type: 'error', text: err.message || 'Failed to revoke sessions.' });
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
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative my-8 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Close"
          >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="w-11 h-11 rounded-xl bg-slate-900 dark:bg-white text-white dark:text-slate-950 flex items-center justify-center font-bold text-base shadow-sm">
            {user.displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">{user.displayName}</h2>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              <span>{user.email}</span>
              {mfaEnabled && (
                <span className="text-[10px] bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-500/30 px-1.5 py-0.2 rounded-full font-medium flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> MFA Active
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex bg-slate-100 dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 mb-6 text-xs font-semibold">
          <button
            onClick={() => {
              setTab('profile');
              setStatusMsg(null);
            }}
            className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              tab === 'profile'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Profile</span>
          </button>
          <button
            onClick={() => {
              setTab('security');
              setStatusMsg(null);
            }}
            className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              tab === 'security'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Security</span>
          </button>
          <button
            onClick={() => {
              setTab('sessions');
              setStatusMsg(null);
            }}
            className={`flex-1 py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-all ${
              tab === 'sessions'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
            }`}
          >
            <Laptop className="w-3.5 h-3.5" />
            <span>Sessions</span>
          </button>
        </div>

        {/* Alert feedback */}
        {statusMsg && (
          <div
            className={`p-3 mb-4 rounded-xl text-xs flex items-center gap-2 ${
              statusMsg.type === 'success'
                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-300'
            }`}
          >
            {statusMsg.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Profile Tab */}
        {tab === 'profile' && (
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Display Name
              </label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-slate-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-700 dark:text-slate-300 mb-1">
                Bio / Headline
              </label>
              <textarea
                rows={3}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Hackathon organizer, university club lead, or developer..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-slate-600"
              />
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-semibold text-xs rounded-xl transition-colors disabled:opacity-50 shadow-sm"
              >
                {loading ? 'Saving...' : 'Save Profile Changes'}
              </button>
            </div>
          </form>
        )}

        {/* Security Tab */}
        {tab === 'security' && (
          <div className="space-y-6">
            {/* Password Change Form */}
            <form onSubmit={handleChangePassword} className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Change Password</h3>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Current Password
                </label>
                <input
                  type="password"
                  required
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-slate-600"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  New Password
                </label>
                <input
                  type="password"
                  required
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-400 dark:focus:border-slate-600"
                />
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-semibold text-xs rounded-xl transition-colors disabled:opacity-50 shadow-sm"
                >
                  {loading ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>

            {/* Two-Factor Authentication Section */}
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">Two-Factor Authentication (TOTP)</h4>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Protect your organizer account with Google Authenticator or 1Password.
                  </p>
                </div>
                {mfaEnabled ? (
                  <button
                    type="button"
                    onClick={handleDisableMfa}
                    disabled={loading}
                    className="px-3 py-1.5 text-xs text-rose-600 dark:text-rose-400 border border-rose-300 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                  >
                    Disable MFA
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleStartMfaSetup}
                    disabled={loading}
                    className="px-3 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition-colors shadow-sm"
                  >
                    Enable 2FA
                  </button>
                )}
              </div>

              {/* MFA Setup Box */}
              {mfaSetupData && (
                <div className="p-4 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 space-y-3">
                  <div className="text-xs text-slate-700 dark:text-slate-300">
                    Scan this QR code or enter the Base32 secret key into your authenticator app:
                  </div>
                  <div className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-mono text-xs text-center select-all">
                    {mfaSetupData.secret}
                  </div>
                  <form onSubmit={handleVerifyMfa} className="flex gap-2">
                    <input
                      type="text"
                      maxLength={6}
                      required
                      placeholder="000000"
                      value={mfaCode}
                      onChange={(e) => setMfaCode(e.target.value.trim())}
                      className="flex-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg px-3 py-1.5 text-xs font-mono text-center tracking-widest text-slate-900 dark:text-white"
                    />
                    <button
                      type="submit"
                      disabled={loading || mfaCode.length < 6}
                      className="px-4 py-1.5 bg-slate-900 text-white dark:bg-white dark:text-slate-950 text-xs font-semibold rounded-lg hover:opacity-90 disabled:opacity-50"
                    >
                      Verify & Activate
                    </button>
                  </form>
                </div>
              )}

              {/* Backup Codes Display */}
              {backupCodes.length > 0 && (
                <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl space-y-2">
                  <div className="text-xs font-bold text-amber-800 dark:text-amber-300">
                    Important: Save Your Recovery Backup Codes
                  </div>
                  <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                    Store these single-use recovery codes in a safe place. If you lose access to your device, each code can be used once to recover your account:
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 font-mono text-xs text-amber-900 dark:text-amber-200 bg-amber-100/50 dark:bg-amber-950/60 p-2.5 rounded-lg border border-amber-200 dark:border-amber-900/30">
                    {backupCodes.map((code, idx) => (
                      <span key={idx} className="select-all">{code}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sessions Tab */}
        {tab === 'sessions' && (
          <div className="space-y-4 text-xs">
            <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Laptop className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">Current Browser Session</div>
                  <div className="text-[11px] text-slate-500">Server-side PostgreSQL session</div>
                </div>
              </div>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-mono">
                Active
              </span>
            </div>

            <div className="p-4 rounded-xl bg-rose-500/5 border border-rose-500/20 space-y-3">
              <div>
                <h4 className="font-bold text-slate-900 dark:text-white text-xs">Sign Out All Devices</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Revokes all active sessions across all browsers and devices immediately.
                </p>
              </div>
              <button
                type="button"
                onClick={handleRevokeAllSessions}
                disabled={loading}
                className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Revoke All Other Sessions</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>,
  document.body
);
};
