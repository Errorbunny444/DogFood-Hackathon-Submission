import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Code2,
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Save,
  Send,
  Award,
  ShieldAlert,
  FileCode,
} from 'lucide-react';
import { apiClient } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';

export const ParticipantDashboard: React.FC = () => {
  const { user } = useAuth();
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showCertificate, setShowCertificate] = useState<boolean>(false);

  // Form state
  const [title, setTitle] = useState('My Breakthrough AI Agent');
  const [tagline, setTagline] = useState('Autonomous code review and audit platform');
  const [repoUrl, setRepoUrl] = useState('https://github.com/sample/breakthrough');
  const [demoUrl, setDemoUrl] = useState('https://breakthrough-demo.example.com');
  const [summary, setSummary] = useState(
    'A high-performance system for ensuring verifiable outputs from AI agents in regulated domains.'
  );

  const handleSubmitAttempt = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmissionError(null);

    try {
      // Intentionally call submission endpoint to demonstrate server-side deadline enforcement
      await apiClient.post('/events/evt_01/projects', {
        title,
        tagline,
        summary,
        repositoryUrl: repoUrl,
        demoUrl,
        trackId: 'trk_01',
      });
    } catch (err: any) {
      setSubmissionError(
        err.message || 'Server rejected submission: 409 Conflict - The submission deadline has passed.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Code2 className="w-7 h-7 text-white font-bold" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Participant Workspace
              </h1>
              <p className="text-sm text-slate-400 mt-0.5">
                Logged in as <strong className="text-slate-200">{user?.displayName || 'Lucas Silva'}</strong> ({user?.email || 'lucas.silva@example.org'})
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowCertificate(true)}
            className="px-4 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Award className="w-4 h-4 text-brand-400" />
            <span>My Certificate</span>
          </button>
        </div>
      </div>

      {/* Critical Server Deadline Banner */}
      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
        <Clock className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm text-amber-200/90 leading-relaxed">
          <strong className="text-amber-300 font-bold block sm:inline">
            Submission Deadline Enforced:
          </strong>{' '}
          Competition submissions are authoritatively governed by the backend server clock.
          In accordance with platform integrity rules, any late submissions or edits are strictly refused with HTTP <code className="bg-amber-950/80 px-1 py-0.5 rounded text-amber-300 font-mono">409 Conflict</code>.
        </div>
      </div>

      {submissionError && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3 animate-in fade-in">
          <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          <div className="text-sm text-rose-200">
            <strong className="font-bold text-rose-300">Server Authorization Rejection:</strong>
            <p className="mt-1 font-mono text-xs text-rose-300 bg-rose-950/60 p-2 rounded border border-rose-900/60">
              {submissionError}
            </p>
          </div>
        </div>
      )}

      {/* Certificate Modal */}
      {showCertificate && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-brand-500/40 rounded-2xl max-w-2xl w-full p-8 shadow-2xl space-y-6 text-center relative">
            <button
              onClick={() => setShowCertificate(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white text-lg"
            >
              ✕
            </button>
            <div className="w-16 h-16 rounded-full bg-brand-500/10 border border-brand-500/30 mx-auto flex items-center justify-center">
              <Award className="w-8 h-8 text-brand-400" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-widest text-brand-400 font-mono font-semibold">
                Official Hackathon Certificate
              </span>
              <h2 className="text-2xl font-black text-white mt-1">Certificate of Participation</h2>
              <p className="text-xs text-slate-400 mt-1">Verified Competition — DOGFOOD Platform</p>
            </div>
            <div className="p-6 bg-slate-950 rounded-xl border border-slate-800 space-y-2 text-left">
              <p className="text-sm text-slate-300">
                This certifies that <strong className="text-white">{user?.displayName || 'Lucas Silva'}</strong> actively participated with project submission and judging verification.
              </p>
              <div className="pt-4 border-t border-slate-800/80 flex justify-between text-xs text-slate-400 font-mono">
                <span>Verification ID: CERT-DOGFOOD-2026-0042</span>
                <span>Status: VERIFIED_ON_RECORD</span>
              </div>
            </div>
            <button
              onClick={() => setShowCertificate(false)}
              className="px-6 py-2 bg-brand-500 text-slate-950 font-bold rounded-lg hover:bg-brand-400 text-sm"
            >
              Done
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Team & Event Info */}
        <div className="space-y-6">
          {/* Team Box */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <div className="flex items-center gap-2 text-slate-200 font-bold text-base">
              <Users className="w-5 h-5 text-blue-400" />
              <h3>My Team: Delta Squad</h3>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Collaboration & membership management for active competition.
            </p>
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-300 font-medium">Lucas Silva (You)</span>
                <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded font-mono">
                  Owner
                </span>
              </div>
              <div className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-slate-900 border border-slate-800">
                <span className="text-slate-300 font-medium">Elena Rostova</span>
                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">
                  Member
                </span>
              </div>
            </div>
            <div className="pt-2">
              <div className="text-xs text-slate-400 font-medium">Team Invite Link:</div>
              <div className="mt-1 flex items-center gap-2">
                <input
                  readOnly
                  value="https://dogfood.local/join/tm_07_inv_92a"
                  className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-400 select-all"
                />
              </div>
            </div>
          </div>

          {/* Submission Checklist */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 space-y-4">
            <h4 className="font-bold text-sm text-slate-200">Integrity Checklist</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Open-source repository provided</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Interactive live demo accessible</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Track criteria matched</span>
              </div>
              <div className="flex items-center gap-2 text-amber-300">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Submission window locked</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Project Submission Form */}
        <div className="lg:col-span-2 glass-panel p-6 sm:p-8 rounded-2xl border border-slate-800 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-bold text-white">Project Submission Editor</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Review and inspect your submitted project payload.
              </p>
            </div>
            <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" /> SUBMITTED
            </span>
          </div>

          <form onSubmit={handleSubmitAttempt} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                Project Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors"
                placeholder="Name of your project"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                Short Tagline
              </label>
              <input
                type="text"
                value={tagline}
                onChange={(e) => setTagline(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors"
                placeholder="One-sentence elevator pitch"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                  Repository URL
                </label>
                <input
                  type="url"
                  value={repoUrl}
                  onChange={(e) => setRepoUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 font-mono text-xs transition-colors"
                  placeholder="https://github.com/..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                  Live Demo URL
                </label>
                <input
                  type="url"
                  value={demoUrl}
                  onChange={(e) => setDemoUrl(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 font-mono text-xs transition-colors"
                  placeholder="https://demo.example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                Summary & Technical Highlights
              </label>
              <textarea
                rows={4}
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 transition-colors leading-relaxed"
                placeholder="Describe your architecture, challenges, and implementation details..."
              />
            </div>

            <div className="pt-4 border-t border-slate-800 flex items-center justify-between">
              <div className="text-xs text-slate-500">
                Any changes sent will be validated against server-side submission deadlines.
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-sm transition-all flex items-center gap-2 shadow-lg shadow-brand-500/20 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                <span>{isSubmitting ? 'Testing Server Deadline...' : 'Submit Update'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
