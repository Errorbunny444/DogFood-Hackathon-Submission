import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck,
  AlertTriangle,
  Download,
  Play,
  CheckCircle2,
  AlertCircle,
  Copy,
  Layers,
  Users,
  Award,
  FileText,
  Activity,
  Sliders,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
} from 'lucide-react';
import { apiRequest } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { Link } from 'react-router-dom';
import { EventStatusController } from './EventStatusController.js';
import { JudgeRosterManager } from './JudgeRosterManager.js';
import { Plus, Gavel } from 'lucide-react';

export const OrganizerDashboard: React.FC = () => {
  const { user, activePersona, switchPersona } = useAuth();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<
    'integrity' | 'proof' | 'duplicates' | 'judges' | 'audit' | 'exports'
  >('integrity');
  const [shrinkageK, setShrinkageK] = useState(5);
  const [expandedProjectProof, setExpandedProjectProof] = useState<string | null>(null);

  // 1. Fetch Event Info
  const { data: eventInfo } = useQuery({
    queryKey: ['event-info', 'evt_01'],
    queryFn: () => apiRequest('/events/evt_01'),
  });

  // 2. Fetch Integrity Metrics
  const { data: integrityData, isLoading: loadingIntegrity } = useQuery({
    queryKey: ['judging-integrity', 'evt_01'],
    queryFn: () => apiRequest('/events/evt_01/judging/integrity'),
  });

  // 3. Fetch Normalization Proof
  const { data: proofData, isLoading: loadingProof } = useQuery({
    queryKey: ['normalization-proof', 'evt_01'],
    queryFn: () => apiRequest('/events/evt_01/normalization/latest'),
  });

  // 4. Fetch Audit Logs
  const { data: auditLogs = [] } = useQuery({
    queryKey: ['audit-logs', 'evt_01'],
    queryFn: () => apiRequest('/events/evt_01/audit-logs'),
    enabled: activeTab === 'audit',
  });

  // Mutation: Run Normalization
  const runNormMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/events/evt_01/normalization/runs', {
        method: 'POST',
        body: JSON.stringify({ shrinkageK }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judging-integrity'] });
      queryClient.invalidateQueries({ queryKey: ['normalization-proof'] });
      queryClient.invalidateQueries({ queryKey: ['event-results'] });
      alert('Normalization completed successfully.');
    },
  });

  // Mutation: Toggle Results Publishing
  const publishMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/events/evt_01/results/publish', {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-info'] });
      queryClient.invalidateQueries({ queryKey: ['event-results'] });
    },
  });

  // Mutation: Auto-assign judges
  const autoAssignMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/events/evt_01/judging/auto-assign', {
        method: 'POST',
        body: JSON.stringify({
          targetReviewsPerProject: 3,
          maxWorkloadPerJudge: 15,
          respectTrackPreferences: true,
          preventConflicts: true,
        }),
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['judging-integrity'] });
      alert(`Auto-assigned ${data.assignedCount} new reviews across eligible judges.`);
    },
  });

  // Mutation: Resolve duplicate
  const resolveDuplicateMutation = useMutation({
    mutationFn: async ({
      projectId,
      status,
      originalId,
    }: {
      projectId: string;
      status: string;
      originalId?: string;
    }) => {
      return await apiRequest(`/projects/${projectId}/resolve-duplicate`, {
        method: 'POST',
        body: JSON.stringify({
          duplicateStatus: status,
          duplicateOf: originalId,
          reason: 'Organizer review in integrity center',
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judging-integrity'] });
      alert('Duplicate status updated.');
    },
  });

  // Check Organizer Permission: authenticated user, platform admin, or organizer persona
  const isOrganizer = !!user || activePersona === 'ORGANIZER';

  if (!isOrganizer) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 mx-auto mb-4">
          <ShieldAlert className="w-6 h-6 text-amber-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Organizer Access Required</h2>
        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm max-w-sm mx-auto mb-6">
          The Integrity Center contains confidential judging audits, Bayesian score normalization proofs, and publication controls. Please sign in or register to access this workspace.
        </p>
        <Link
          to="/"
          className="inline-flex px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-semibold text-xs transition-colors shadow-sm"
        >
          Return to Home
        </Link>
      </div>
    );
  }

  const isPublished = eventInfo?.resultsPublished;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Organizer Header */}
      <div className="glass-panel rounded-2xl p-6 mb-8 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-400 uppercase tracking-wider mb-1">
            <ShieldCheck className="w-4 h-4" />
            <span>Judging Integrity Center & Operational Control</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white">
            {eventInfo?.name || 'Sample Hack 2026'}
          </h1>
          <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-2">
            <span>Deadline: March 1, 2026 18:00 UTC (Closed)</span>
            <span>•</span>
            <span className="flex items-center gap-1.5">
              <span
                className={`w-2 h-2 rounded-full ${
                  isPublished ? 'bg-emerald-400' : 'bg-amber-400'
                }`}
              ></span>
              <span className="font-semibold text-white">
                {isPublished ? 'Results Published' : 'Results Hidden / Draft'}
              </span>
            </span>
          </div>
        </div>

        {/* Global Action Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <Link
            to="/events/new"
            className="px-3.5 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 text-xs font-bold flex items-center gap-1.5 transition-colors shadow-lg shadow-brand-500/20"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Launch Hackathon</span>
          </Link>

          <button
            onClick={() => autoAssignMutation.mutate()}
            disabled={autoAssignMutation.isPending}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoAssignMutation.isPending ? 'animate-spin' : ''}`} />
            <span>Auto-Assign</span>
          </button>

          <button
            onClick={() => runNormMutation.mutate()}
            disabled={runNormMutation.isPending}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
          >
            <Sliders className="w-3.5 h-3.5 text-brand-400" />
            <span>Re-run Normalization</span>
          </button>

          <button
            onClick={() => publishMutation.mutate()}
            disabled={publishMutation.isPending}
            className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shadow-md ${
              isPublished
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                : 'bg-brand-500 hover:bg-brand-600 text-slate-950 shadow-brand-500/20'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>{isPublished ? 'Unpublish Results' : 'Publish Results to Public'}</span>
          </button>
        </div>
      </div>

      {/* Event State Machine Lifecycle Controller */}
      {eventInfo && (
        <EventStatusController
          eventId={eventInfo.id || 'evt_01'}
          currentStatus={eventInfo.status || 'SUBMISSIONS_CLOSED'}
          submissionDeadline={eventInfo.submissionDeadline}
          resultsPublished={!!eventInfo.resultsPublished}
          onStatusChanged={() => queryClient.invalidateQueries({ queryKey: ['event-info'] })}
        />
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-3 mb-8 overflow-x-auto">
        {[
          { id: 'integrity', label: 'Judging Health & Calibration', icon: Activity },
          { id: 'proof', label: 'Normalization Proof', icon: Sliders },
          {
            id: 'duplicates',
            label: 'Duplicate Inspector',
            icon: AlertTriangle,
            badge: integrityData?.duplicates?.length || 0,
          },
          { id: 'judges', label: 'Judge Roster', icon: Gavel },
          { id: 'audit', label: 'Audit Trail', icon: FileText },
          { id: 'exports', label: 'Exports & Archives', icon: Download },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all ${
                isActive
                  ? 'bg-brand-500/10 text-brand-400 border border-brand-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-900 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-slate-950 font-extrabold">
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* TAB 1: JUDGING HEALTH & INTEGRITY */}
      {activeTab === 'integrity' && (
        <div className="space-y-8">
          {/* Coverage Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="glass-panel p-4 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 font-medium block mb-1">Projects Complete</span>
              <span className="text-2xl font-bold text-emerald-400">
                {integrityData?.coverageSummary?.complete ?? 0}
              </span>
              <span className="text-[11px] text-slate-500 block mt-1">Target 3+ reviews reached</span>
            </div>
            <div className="glass-panel p-4 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 font-medium block mb-1">Under-Reviewed</span>
              <span className="text-2xl font-bold text-amber-400">
                {integrityData?.coverageSummary?.underReviewed ?? 0}
              </span>
              <span className="text-[11px] text-slate-500 block mt-1">Needs additional reviews</span>
            </div>
            <div className="glass-panel p-4 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 font-medium block mb-1">High Disagreement</span>
              <span className="text-2xl font-bold text-rose-400">
                {integrityData?.coverageSummary?.highDisagreementCount ?? 0}
              </span>
              <span className="text-[11px] text-slate-500 block mt-1">Review score range ≥ 1.5</span>
            </div>
            <div className="glass-panel p-4 rounded-xl border border-slate-800">
              <span className="text-xs text-slate-400 font-medium block mb-1">Suspected Duplicates</span>
              <span className="text-2xl font-bold text-cyan-400">
                {integrityData?.duplicates?.length ?? 0}
              </span>
              <span className="text-[11px] text-slate-500 block mt-1">Flagged for inspection</span>
            </div>
          </div>

          {/* Judge Calibration Matrix Table */}
          <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white">Judge Calibration & Bias Statistics</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Calculated using completed reviews, empirical variance, observed bias $b_j$, and shrinkage $\lambda_j$.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900/80 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 font-semibold">Judge</th>
                    <th className="py-3 px-3 font-semibold">Reviews</th>
                    <th className="py-3 px-3 font-semibold">Mean Score</th>
                    <th className="py-3 px-3 font-semibold">Variance</th>
                    <th className="py-3 px-3 font-semibold">Std Dev</th>
                    <th className="py-3 px-3 font-semibold">Observed Bias</th>
                    <th className="py-3 px-3 font-semibold">Shrinkage (λ)</th>
                    <th className="py-3 px-3 font-semibold">Adjusted Bias</th>
                    <th className="py-3 px-4 font-semibold">Calibration Flags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {integrityData?.judgeCalibration?.map((j: any) => {
                    const isConstant = j.flags?.includes('CONSTANT_SCORER');
                    const isHighBias = j.flags?.includes('HIGH_BIAS');
                    const isStrict = j.observedBias < -0.4;
                    const isGenerous = j.observedBias > 0.4;

                    return (
                      <tr key={j.judgeUserId} className="hover:bg-slate-900/50 transition-colors">
                        <td className="py-3 px-4 font-medium text-white">
                          <div className="font-semibold text-slate-200">{j.displayName}</div>
                          <div className="text-[10px] font-mono text-slate-500">{j.sourceId}</div>
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-300">{j.reviewCount}</td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-200">{j.mean.toFixed(2)}</td>
                        <td className="py-3 px-3 font-mono text-slate-400">{j.variance.toFixed(2)}</td>
                        <td className="py-3 px-3 font-mono text-slate-400">{j.standardDeviation.toFixed(2)}</td>
                        <td
                          className={`py-3 px-3 font-mono font-bold ${
                            isGenerous ? 'text-emerald-400' : isStrict ? 'text-rose-400' : 'text-slate-300'
                          }`}
                        >
                          {j.observedBias > 0 ? `+${j.observedBias.toFixed(2)}` : j.observedBias.toFixed(2)}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-400">{j.shrinkageFactor.toFixed(2)}</td>
                        <td className="py-3 px-3 font-mono font-semibold text-brand-400">
                          {j.adjustedBias > 0 ? `+${j.adjustedBias.toFixed(2)}` : j.adjustedBias.toFixed(2)}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {isConstant && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                <span>Constant Scorer (σ = 0)</span>
                              </span>
                            )}
                            {isHighBias && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                {isGenerous ? 'Generous Scorer' : 'Strict Scorer'}
                              </span>
                            )}
                            {j.flags?.includes('LOW_COMPLETION') && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800 text-slate-400">
                                Low Completion
                              </span>
                            )}
                            {!isConstant && !isHighBias && (
                              <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-800/80 text-emerald-400">
                                Balanced
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Project Disagreement & Coverage Alerts */}
          {integrityData?.projectWarnings?.length > 0 && (
            <div className="glass-panel rounded-2xl border border-slate-800 p-5">
              <h3 className="text-base font-bold text-white mb-1 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                <span>Project Disagreement & Review Coverage Warnings</span>
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Projects with fewer than 3 reviews or unusually large judge score dispersion for organizer inspection.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {integrityData.projectWarnings.map((pw: any) => (
                  <div
                    key={pw.projectId}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                          {pw.sourceId || 'PRJ'}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {pw.isHighDisagreement && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                              High Disagreement (Δ {pw.scoreRange?.toFixed(1)})
                            </span>
                          )}
                          {pw.coverageStatus === 'UNDER_REVIEWED' && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                              Only {pw.actualReviews}/3 Reviews
                            </span>
                          )}
                        </div>
                      </div>
                      <h4 className="text-sm font-bold text-white mb-1">{pw.title}</h4>
                      <div className="text-xs text-slate-400">Track: {pw.trackName}</div>
                    </div>

                    <div className="pt-3 border-t border-slate-800 mt-3 flex items-center justify-between text-xs text-slate-400">
                      <span>Normalized: {pw.normalizedAverage ? pw.normalizedAverage.toFixed(2) : 'N/A'}</span>
                      <span className="font-semibold text-slate-300">{pw.actualReviews} reviews collected</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: NORMALIZATION PROOF */}
      {activeTab === 'proof' && (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 bg-gradient-to-r from-slate-900 to-slate-900/90">
            <h3 className="text-lg font-bold text-white mb-1">
              Deterministic Mean-Centering with Shrinkage Proof
            </h3>
            <p className="text-xs text-slate-300 max-w-2xl leading-relaxed mb-4">
              Raw averages inherently reward projects reviewed by lenient judges and penalize those reviewed by harsh judges. Our judging engine calibrates each review:
              <br />
              <code className="text-brand-400 font-mono text-[11px] block mt-1">
                N_{'{jp}'} = R_{'{jp}'} - \lambda_j ( \mu_j - \mu_g ), \quad \lambda_j = \frac{'{n_j}'}{'{n_j + k}'}
              </code>
            </p>

            <div className="flex flex-wrap items-center gap-6 pt-4 border-t border-slate-800 text-xs">
              <div>
                <span className="text-slate-500 block mb-0.5">Shrinkage Parameter (k)</span>
                <span className="text-sm font-bold text-white">{proofData?.run?.parameters?.shrinkageK ?? 5}</span>
              </div>
              <div>
                <span className="text-slate-500 block mb-0.5">Global Mean Review Score (μ_g)</span>
                <span className="text-sm font-bold text-brand-400 font-mono">
                  {proofData?.proof?.[0]?.reviews?.[0]?.globalMean?.toFixed(3) ?? '3.500'}
                </span>
              </div>
            </div>
          </div>

          {/* Normalization Proof Table */}
          <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-800 font-bold text-sm text-white flex items-center justify-between">
              <span>Full Project Mathematical Breakdown ({proofData?.proof?.length ?? 0} Submissions)</span>
              <span className="text-xs font-normal text-slate-400">Click any project to inspect review-level calibration</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4 font-semibold">Rank</th>
                    <th className="py-3 px-4 font-semibold">Project Title</th>
                    <th className="py-3 px-3 font-semibold">Track</th>
                    <th className="py-3 px-3 font-semibold">Raw Avg</th>
                    <th className="py-3 px-3 font-semibold">Normalized Avg</th>
                    <th className="py-3 px-3 font-semibold">Rank Shift</th>
                    <th className="py-3 px-3 font-semibold">Reviews</th>
                    <th className="py-3 px-4 font-semibold">Inspect</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {proofData?.proof?.map((item: any) => {
                    const isExpanded = expandedProjectProof === item.projectId;
                    const shift = item.rankShift;

                    return (
                      <React.Fragment key={item.projectId}>
                        <tr
                          onClick={() => setExpandedProjectProof(isExpanded ? null : item.projectId)}
                          className={`hover:bg-slate-900/70 cursor-pointer transition-colors ${
                            isExpanded ? 'bg-slate-900/90' : ''
                          }`}
                        >
                          <td className="py-3 px-4 font-extrabold text-sm text-white">#{item.normalizedRank}</td>
                          <td className="py-3 px-4 font-bold text-slate-100">
                            <div className="line-clamp-1">{item.title}</div>
                            <span className="text-[10px] font-mono text-slate-500">{item.projectSourceId}</span>
                          </td>
                          <td className="py-3 px-3 text-slate-400">{item.trackName}</td>
                          <td className="py-3 px-3 font-mono text-slate-400">{item.rawAverage.toFixed(2)}</td>
                          <td className="py-3 px-3 font-mono font-bold text-brand-400 text-sm">
                            {item.normalizedAverage.toFixed(2)}
                          </td>
                          <td className="py-3 px-3 font-mono font-bold">
                            {shift > 0 ? (
                              <span className="text-emerald-400">+{shift} ↑</span>
                            ) : shift < 0 ? (
                              <span className="text-rose-400">{shift} ↓</span>
                            ) : (
                              <span className="text-slate-500">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-300">{item.reviewCount}</td>
                          <td className="py-3 px-4 text-slate-400">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </td>
                        </tr>

                        {/* Expanded Mathematical Review Breakdown */}
                        {isExpanded && (
                          <tr className="bg-slate-950/80">
                            <td colSpan={8} className="p-4 border-b border-slate-800">
                              <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                                <h4 className="text-xs font-bold text-brand-400 uppercase tracking-wider mb-2">
                                  Review Calibration Details for "{item.title}"
                                </h4>
                                <table className="w-full text-left border-collapse text-xs">
                                  <thead>
                                    <tr className="border-b border-slate-800 text-[10px] text-slate-400 uppercase">
                                      <th className="py-2">Judge</th>
                                      <th className="py-2">Raw Review</th>
                                      <th className="py-2">Judge Mean (μ_j)</th>
                                      <th className="py-2">Observed Bias (b_j)</th>
                                      <th className="py-2">Shrinkage (λ_j)</th>
                                      <th className="py-2">Adjusted Bias (b̂_j)</th>
                                      <th className="py-2">Normalized Review (N_jp)</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-800/40">
                                    {item.reviews?.map((r: any) => (
                                      <tr key={r.reviewId}>
                                        <td className="py-2 font-medium text-slate-200">
                                          {r.judgeName} <span className="text-slate-500 font-mono">({r.judgeSourceId})</span>
                                        </td>
                                        <td className="py-2 font-mono text-slate-300">{r.rawScore.toFixed(2)}</td>
                                        <td className="py-2 font-mono text-slate-400">{r.judgeMean.toFixed(2)}</td>
                                        <td className="py-2 font-mono text-slate-400">
                                          {r.observedBias > 0 ? `+${r.observedBias.toFixed(2)}` : r.observedBias.toFixed(2)}
                                        </td>
                                        <td className="py-2 font-mono text-slate-400">{r.shrinkageFactor.toFixed(2)}</td>
                                        <td className="py-2 font-mono text-slate-300">
                                          {r.adjustedBias > 0 ? `+${r.adjustedBias.toFixed(2)}` : r.adjustedBias.toFixed(2)}
                                        </td>
                                        <td className="py-2 font-mono font-bold text-brand-400">
                                          {r.normalizedScore.toFixed(2)}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DUPLICATE SUBMISSION INSPECTOR */}
      {activeTab === 'duplicates' && (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800">
            <h3 className="text-lg font-bold text-white mb-1">Duplicate Submission Inspector</h3>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              Our automated heuristics detect projects with identical teams, identical repository URLs, and matching titles. Organizers can inspect and resolve duplicates without deleting audit records.
            </p>

            {integrityData?.duplicates?.length === 0 ? (
              <div className="text-center py-12 text-slate-500 text-xs">No duplicate submissions detected.</div>
            ) : (
              <div className="space-y-4">
                {integrityData?.duplicates?.map((dup: any) => (
                  <div
                    key={dup.id}
                    className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                          {dup.sourceId}
                        </span>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                            dup.duplicateStatus === 'CONFIRMED'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                          }`}
                        >
                          Status: {dup.duplicateStatus}
                        </span>
                      </div>
                      <h4 className="text-base font-bold text-white">{dup.title}</h4>
                      <div className="text-xs text-slate-400 mt-1 space-y-0.5">
                        <div>Team: <span className="text-slate-200">{dup.teamName}</span></div>
                        <div>Repo: <span className="text-brand-400 font-mono">{dup.repositoryUrl}</span></div>
                        {dup.originalProject && (
                          <div className="text-amber-400 font-medium mt-1">
                            Matches earlier submission: {dup.originalProject.title} ({dup.originalProject.sourceId})
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          resolveDuplicateMutation.mutate({
                            projectId: dup.id,
                            status: 'CONFIRMED',
                            originalId: dup.duplicateOf,
                          })
                        }
                        className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-xs font-semibold border border-rose-500/30 transition-colors"
                      >
                        Confirm Duplicate
                      </button>
                      <button
                        onClick={() =>
                          resolveDuplicateMutation.mutate({
                            projectId: dup.id,
                            status: 'NONE',
                          })
                        }
                        className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                      >
                        Allow Both
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: JUDGE ROSTER & WORKLOAD */}
      {activeTab === 'judges' && (
        <JudgeRosterManager eventId={eventInfo?.id || 'evt_01'} />
      )}

      {/* TAB 4: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="glass-panel rounded-2xl border border-slate-800 overflow-hidden">
          <div className="p-5 border-b border-slate-800">
            <h3 className="text-base font-bold text-white">Immutable Event Audit Trail</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Cryptographically timestamped log of all sensitive operations, deadlines, and score changes.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 border-b border-slate-800 text-slate-400 uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4 font-semibold">Timestamp</th>
                  <th className="py-3 px-4 font-semibold">Action</th>
                  <th className="py-3 px-3 font-semibold">Actor</th>
                  <th className="py-3 px-3 font-semibold">Resource</th>
                  <th className="py-3 px-4 font-semibold">Metadata</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono text-[11px]">
                {auditLogs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-900/50">
                    <td className="py-2.5 px-4 text-slate-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-brand-400">{log.action}</td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {log.actorDisplayName || log.actorEmail || 'System'}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400">{log.resourceType}</td>
                    <td className="py-2.5 px-4 text-slate-500 truncate max-w-xs">
                      {log.metadata ? JSON.stringify(log.metadata) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: EXPORTS & ARCHIVES */}
      {activeTab === 'exports' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-white mb-1">Results Leaderboard CSV</h3>
              <p className="text-xs text-slate-400 mb-4">
                Full final ranking, raw score, normalized score, review count, and track for all submissions.
              </p>
            </div>
            <a
              href="/api/v1/events/evt_01/export/results.csv"
              download
              className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-lg shadow-brand-500/20"
            >
              <Download className="w-4 h-4" />
              <span>Download results.csv</span>
            </a>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-white mb-1">Projects Directory CSV</h3>
              <p className="text-xs text-slate-400 mb-4">
                Metadata, submission dates, team members, and code repository URLs for all projects.
              </p>
            </div>
            <a
              href="/api/v1/events/evt_01/export/projects.csv"
              download
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download projects.csv</span>
            </a>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-bold text-white mb-1">Complete Event JSON Archive</h3>
              <p className="text-xs text-slate-400 mb-4">
                Full standalone JSON dump including event config, tracks, teams, projects, rubric, and review scores.
              </p>
            </div>
            <a
              href="/api/v1/events/evt_01/export/full.json"
              download
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center justify-center gap-2 transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download full.json</span>
            </a>
          </div>
        </div>
      )}
    </div>
  );
};
