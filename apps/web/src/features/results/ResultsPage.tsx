import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Award,
  TrendingUp,
  TrendingDown,
  Minus,
  Download,
  Info,
  Layers,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Lock,
} from 'lucide-react';
import { apiClient } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';

interface ResultItem {
  projectId: string;
  projectSourceId: string;
  title: string;
  tagline: string | null;
  summary: string | null;
  repositoryUrl: string | null;
  demoUrl: string | null;
  trackId: string | null;
  trackName: string | null;
  teamId: string | null;
  teamName: string | null;
  rawAverage: string | number;
  normalizedAverage: string | number;
  reviewCount: number;
  rawRank: number;
  normalizedRank: number;
  rankShift: number;
  isTied: boolean;
}

interface ResultsResponse {
  published: boolean;
  runId?: string;
  algorithm?: string;
  results: ResultItem[];
  error?: { code: string; message: string };
}

export const ResultsPage: React.FC = () => {
  const { user } = useAuth();
  const [selectedTrack, setSelectedTrack] = useState<string>('ALL');
  const [showFormula, setShowFormula] = useState<boolean>(false);

  const { data, isLoading, error, refetch } = useQuery<ResultsResponse>({
    queryKey: ['results', 'evt_01'],
    queryFn: async () => {
      return apiClient.get<ResultsResponse>('/events/evt_01/results');
    },
    retry: false,
  });

  const isOrganizer =
    user?.globalRole === 'ADMIN' ||
    user?.displayName?.toLowerCase().includes('organizer');

  const results = data?.results || [];

  const uniqueTracks = Array.from(
    new Set(results.map((r) => r.trackName).filter(Boolean))
  ) as string[];

  const filteredResults =
    selectedTrack === 'ALL'
      ? results
      : results.filter((r) => r.trackName === selectedTrack);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Award className="w-7 h-7 text-slate-950 font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Final Event Leaderboard
                </h1>
                {data?.published ? (
                  <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-0.5 rounded-full border border-emerald-500/30 font-semibold flex items-center gap-1">
                    <ShieldCheck className="w-3.5 h-3.5" /> Published & Defended
                  </span>
                ) : (
                  <span className="bg-amber-500/10 text-amber-400 text-xs px-2.5 py-0.5 rounded-full border border-amber-500/30 font-semibold flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5" /> Draft Preview
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Calibrated rankings powered by Empirical Bayes shrinkage and mean-centering normalization.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFormula(!showFormula)}
            className="px-3.5 py-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Info className="w-4 h-4 text-brand-400" />
            <span>Explain Algorithm</span>
          </button>
          <a
            href="/api/v1/events/evt_01/export/results.csv"
            download="dogfood-results.csv"
            className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-950 font-semibold text-sm transition-colors flex items-center gap-2 shadow-sm"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* Algorithm Explanation Drawer */}
      {showFormula && (
        <div className="glass-panel p-6 rounded-2xl border border-brand-500/30 bg-slate-900/90 shadow-xl space-y-4 animate-in fade-in duration-200">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-brand-400" />
              <h3 className="font-bold text-base text-white">
                How Judging Integrity is Mathematically Defended
              </h3>
            </div>
            <button
              onClick={() => setShowFormula(false)}
              className="text-xs text-slate-400 hover:text-white"
            >
              ✕ Close
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-300">
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="font-semibold text-brand-400">1. Observed Judge Bias</div>
              <p className="text-slate-400">
                Calculates each judge's divergence from the global population mean score:
              </p>
              <div className="font-mono bg-slate-900 p-2 rounded text-slate-200 text-center">
                b_j = μ_j - μ_g
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="font-semibold text-brand-400">2. Empirical Bayes Shrinkage</div>
              <p className="text-slate-400">
                Prevents penalizing judges with few reviews; shrinks bias estimate toward zero:
              </p>
              <div className="font-mono bg-slate-900 p-2 rounded text-slate-200 text-center">
                λ_j = n_j / (n_j + 5)
              </div>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
              <div className="font-semibold text-brand-400">3. Normalized Review & Final Score</div>
              <p className="text-slate-400">
                Clamps adjusted scores and averages normalized reviews per project:
              </p>
              <div className="font-mono bg-slate-900 p-2 rounded text-slate-200 text-center">
                N_jp = clamp(R_jp - λ_j · b_j, 1, 5)
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Unpublished Notice for Visitors */}
      {error && (
        <div className="glass-panel p-8 rounded-2xl border border-amber-500/30 bg-amber-500/5 text-center max-w-xl mx-auto space-y-3">
          <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Results Under Review</h2>
          <p className="text-sm text-slate-400">
            Official results for this event have not yet been published by the organizers.
            Organizers can review calibrated rankings and publish official outcomes from the Organizer Integrity Center.
          </p>
        </div>
      )}

      {/* Leaderboard Table */}
      {!error && (
        <div className="space-y-4">
          {/* Track Filters */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            <button
              onClick={() => setSelectedTrack('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                selectedTrack === 'ALL'
                  ? 'bg-brand-500 text-slate-950 font-bold'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              All Tracks ({results.length})
            </button>
            {uniqueTracks.map((t) => (
              <button
                key={t}
                onClick={() => setSelectedTrack(t)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                  selectedTrack === t
                    ? 'bg-brand-500 text-slate-950 font-bold'
                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="glass-panel rounded-2xl border border-slate-800/80 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-900/80 text-xs uppercase tracking-wider text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-3.5 px-4 font-semibold text-center w-16">Rank</th>
                    <th className="py-3.5 px-4 font-semibold">Project</th>
                    <th className="py-3.5 px-4 font-semibold">Track & Team</th>
                    <th className="py-3.5 px-4 font-semibold text-center">Reviews</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Raw Avg</th>
                    <th className="py-3.5 px-4 font-semibold text-right">Normalized</th>
                    <th className="py-3.5 px-4 font-semibold text-center w-24">Rank Shift</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {filteredResults.map((item) => {
                    const normScore = Number(item.normalizedAverage).toFixed(2);
                    const rawScore = Number(item.rawAverage).toFixed(2);
                    const isPodium = item.normalizedRank <= 3;

                    return (
                      <tr
                        key={item.projectId}
                        className={`hover:bg-slate-900/50 transition-colors ${
                          isPodium ? 'bg-amber-500/[0.02]' : ''
                        }`}
                      >
                        {/* Rank Badge */}
                        <td className="py-4 px-4 text-center">
                          {item.normalizedRank === 1 && (
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-500/20 text-amber-300 font-extrabold text-sm border border-amber-500/40">
                              🥇 1
                            </span>
                          )}
                          {item.normalizedRank === 2 && (
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-300/20 text-slate-200 font-extrabold text-sm border border-slate-300/40">
                              🥈 2
                            </span>
                          )}
                          {item.normalizedRank === 3 && (
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-amber-700/20 text-amber-500 font-extrabold text-sm border border-amber-700/40">
                              🥉 3
                            </span>
                          )}
                          {item.normalizedRank > 3 && (
                            <span className="text-slate-400 font-mono font-medium">
                              #{item.normalizedRank}
                            </span>
                          )}
                        </td>

                        {/* Project Info */}
                        <td className="py-4 px-4">
                          <div className="font-bold text-white text-base">
                            {item.title}
                          </div>
                          {item.tagline && (
                            <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">
                              {item.tagline}
                            </p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-500">
                            {item.repositoryUrl && (
                              <a
                                href={item.repositoryUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="hover:text-brand-400 flex items-center gap-1"
                              >
                                <span>Code</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                            {item.demoUrl && (
                              <a
                                href={item.demoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="hover:text-brand-400 flex items-center gap-1"
                              >
                                <span>Demo</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                            <span className="font-mono text-[10px] text-slate-600">
                              ID: {item.projectSourceId || item.projectId.slice(0, 8)}
                            </span>
                          </div>
                        </td>

                        {/* Track & Team */}
                        <td className="py-4 px-4">
                          <div className="text-xs font-semibold text-slate-300">
                            {item.trackName || 'General'}
                          </div>
                          <div className="text-xs text-slate-500">
                            Team: {item.teamName || 'Independent'}
                          </div>
                        </td>

                        {/* Review Count */}
                        <td className="py-4 px-4 text-center">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-mono font-semibold ${
                              item.reviewCount >= 3
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {item.reviewCount}
                          </span>
                        </td>

                        {/* Raw Average */}
                        <td className="py-4 px-4 text-right font-mono text-slate-400">
                          {rawScore}
                        </td>

                        {/* Normalized Average */}
                        <td className="py-4 px-4 text-right font-mono font-bold text-brand-400 text-base">
                          {normScore}
                        </td>

                        {/* Rank Shift Indicator */}
                        <td className="py-4 px-4 text-center font-mono">
                          {item.rankShift > 0 && (
                            <span className="inline-flex items-center gap-1 text-emerald-400 text-xs font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                              <TrendingUp className="w-3 h-3" />+{item.rankShift}
                            </span>
                          )}
                          {item.rankShift < 0 && (
                            <span className="inline-flex items-center gap-1 text-rose-400 text-xs font-bold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                              <TrendingDown className="w-3 h-3" />
                              {item.rankShift}
                            </span>
                          )}
                          {item.rankShift === 0 && (
                            <span className="inline-flex items-center gap-0.5 text-slate-500 text-xs">
                              <Minus className="w-3 h-3" /> 0
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
