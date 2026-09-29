import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Gavel,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  Save,
  Send,
  ExternalLink,
  Github,
  AlertCircle,
  ShieldAlert,
  Sliders,
  AlertTriangle,
  Layers,
} from 'lucide-react';
import { apiRequest } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { Link } from 'react-router-dom';
import { TrackPreferencesModal } from './TrackPreferencesModal.js';
import { ConflictDeclarationModal } from './ConflictDeclarationModal.js';

interface JudgeAssignment {
  assignmentId: string;
  projectId: string;
  projectSourceId: string | null;
  title: string;
  tagline: string;
  summary: string;
  repositoryUrl: string | null;
  demoUrl: string | null;
  videoUrl: string | null;
  trackName: string | null;
  reviewId: string | null;
  reviewStatus: string;
  rawScore: number | null;
}

interface ReviewCriterion {
  id: string;
  name: string;
  description: string;
  weight: number;
  minScore: number;
  maxScore: number;
  currentScore: number | null;
  comment: string;
}

interface ReviewDetailResponse {
  review: {
    id: string;
    projectId: string;
    judgeUserId: string;
    rawScore: number | null;
    overallComment: string | null;
    status: string;
    projectTitle: string;
    projectSummary: string;
    projectDescription: string;
    repositoryUrl: string | null;
    demoUrl: string | null;
  };
  criteria: ReviewCriterion[];
}

export const JudgeDashboard: React.FC = () => {
  const { user, activePersona, switchPersona } = useAuth();
  const queryClient = useQueryClient();

  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [criterionComments, setCriterionComments] = useState<Record<string, string>>({});
  const [overallComment, setOverallComment] = useState('');
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [showTrackModal, setShowTrackModal] = useState<boolean>(false);
  const [conflictTarget, setConflictTarget] = useState<{ id: string; title: string } | null>(null);

  // Fetch Judge's assigned projects
  const { data: assignments = [], isLoading, error: assignmentError } = useQuery<JudgeAssignment[]>({
    queryKey: ['judge-assignments', user?.id],
    queryFn: () => apiRequest<JudgeAssignment[]>('/judge/assignments'),
    enabled: !!user,
  });

  // Fetch Review Details when a review is active
  const { data: reviewDetail, isLoading: loadingReview } = useQuery<ReviewDetailResponse>({
    queryKey: ['judge-review', selectedReviewId],
    queryFn: async () => {
      const res = await apiRequest<ReviewDetailResponse>(`/judge/reviews/${selectedReviewId}`);
      // Populate state
      const initialScores: Record<string, number> = {};
      const initialComments: Record<string, string> = {};
      for (const c of res.criteria) {
        if (c.currentScore !== null) initialScores[c.id] = c.currentScore;
        if (c.comment) initialComments[c.id] = c.comment;
      }
      setScores(initialScores);
      setCriterionComments(initialComments);
      setOverallComment(res.review.overallComment || '');
      return res;
    },
    enabled: !!selectedReviewId,
  });

  // Autosave Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedReviewId || !reviewDetail) return;
      const scorePayload = reviewDetail.criteria.map((c) => ({
        criterionId: c.id,
        score: scores[c.id] || 3,
        comment: criterionComments[c.id] || '',
      }));

      await apiRequest(`/judge/reviews/${selectedReviewId}`, {
        method: 'PUT',
        body: JSON.stringify({
          scores: scorePayload,
          overallComment,
        }),
      });
    },
    onSuccess: () => {
      setSaveStatus(`Draft saved at ${new Date().toLocaleTimeString()}`);
      queryClient.invalidateQueries({ queryKey: ['judge-assignments'] });
    },
    onError: (err: any) => {
      setSaveStatus(`Failed to save: ${err.message}`);
    },
  });

  // Final Submit Mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedReviewId) return;
      await saveMutation.mutateAsync();
      await apiRequest(`/judge/reviews/${selectedReviewId}/submit`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judge-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['judge-review', selectedReviewId] });
      setSelectedReviewId(null);
    },
  });

  // Check if current user is a judge or has assigned projects
  const isJudge =
    activePersona === 'JUDGE_A' ||
    activePersona === 'JUDGE_B' ||
    user?.globalRole === 'ADMIN' ||
    user?.globalRole === 'JUDGE' ||
    assignments.length > 0 ||
    !!user;

  if (!isJudge) {
    return (
      <div className="max-w-md mx-auto px-4 py-20 text-center">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300 mx-auto mb-4">
          <ShieldAlert className="w-6 h-6 text-amber-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Judge Sign-In Required</h2>
        <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm max-w-sm mx-auto mb-6">
          The Judge Portal evaluates submissions with strict peer isolation. Please sign in or register with your reviewer invitation to access your queue.
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

  const completedCount = assignments.filter((a) => a.reviewStatus === 'SUBMITTED').length;
  const progressPercent = assignments.length > 0 ? Math.round((completedCount / assignments.length) * 100) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 glass-panel rounded-2xl p-6 mb-8 border border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-400 uppercase tracking-wider mb-1">
            <Gavel className="w-4 h-4" />
            <span>Judge Portal — Server-Side Isolated Scoring</span>
          </div>
          <h1 className="text-2xl font-bold text-white">
            Assigned Queue: {user?.displayName}
          </h1>
          <p className="text-slate-400 text-xs mt-1">
            Judge ID: <span className="font-mono text-slate-300">{user?.sourceId || user?.id}</span> — You can only inspect and evaluate your assigned submissions.
          </p>
        </div>

        {/* Workload Progress & Preferences */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowTrackModal(true)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 text-xs font-semibold transition-colors flex items-center gap-2"
          >
            <Layers className="w-4 h-4 text-brand-400" />
            <span>Track Preferences</span>
          </button>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 min-w-[220px]">
            <div className="flex items-center justify-between text-xs mb-1.5">
              <span className="text-slate-400">Review Completion</span>
              <span className="font-bold text-brand-400">
                {completedCount} / {assignments.length} ({progressPercent}%)
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-brand-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Review Queue or Active Scoring Form */}
      {!selectedReviewId ? (
        <div>
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <span>Assigned Projects Queue</span>
            <span className="text-xs font-normal text-slate-500">({assignments.length} total)</span>
          </h2>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-48 rounded-xl bg-slate-900 animate-pulse border border-slate-800"></div>
              ))}
            </div>
          ) : assignments.length === 0 ? (
            <div className="text-center py-12 glass-panel rounded-xl border border-slate-800">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
              <h3 className="text-base font-semibold text-white">No pending assignments</h3>
              <p className="text-xs text-slate-400 mt-1">You have evaluated all currently assigned submissions.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {assignments.map((item, index) => {
                const isSubmitted = item.reviewStatus === 'SUBMITTED';

                return (
                  <div
                    key={item.assignmentId}
                    className="glass-panel glass-panel-hover rounded-xl p-5 border border-slate-800 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                          #{index + 1} • {item.projectSourceId || 'PRJ'}
                        </span>
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                            isSubmitted
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {isSubmitted ? (
                            <>
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Completed</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3 h-3" />
                              <span>Pending Score</span>
                            </>
                          )}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-white mb-1 line-clamp-1">{item.title}</h3>
                      {item.trackName && (
                        <span className="text-[11px] text-brand-400 font-medium block mb-2">{item.trackName}</span>
                      )}
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-4">{item.summary}</p>
                    </div>

                    <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2">
                      <div className="text-xs font-semibold text-slate-300">
                        {item.rawScore ? `Score: ${item.rawScore.toFixed(2)} / 5.0` : 'Not scored'}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConflictTarget({ id: item.projectId, title: item.title });
                          }}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-800 hover:border-amber-500/40 text-slate-400 hover:text-amber-400 text-xs flex items-center gap-1 transition-colors"
                          title="Declare Conflict of Interest"
                        >
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                          <span className="hidden sm:inline">Conflict</span>
                        </button>
                        <button
                          onClick={() => {
                            if (item.reviewId) {
                              setSelectedReviewId(item.reviewId);
                            } else {
                              alert('Review record for this assignment is being generated.');
                            }
                          }}
                          disabled={!item.reviewId}
                          className="px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 text-xs font-semibold transition-colors"
                        >
                          {isSubmitted ? 'Edit Review' : 'Start Scoring'}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* Distraction-Free Scoring Interface */
        <div className="glass-panel rounded-2xl border border-slate-800 p-6 max-w-4xl mx-auto animate-in fade-in duration-150">
          <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
            <button
              onClick={() => setSelectedReviewId(null)}
              className="text-xs font-medium text-slate-400 hover:text-white flex items-center gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Back to Queue</span>
            </button>
            <div className="flex items-center gap-3">
              {saveStatus && <span className="text-xs text-slate-400 italic">{saveStatus}</span>}
              <button
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 flex items-center gap-1.5 transition-colors"
              >
                <Save className="w-3.5 h-3.5 text-slate-400" />
                <span>Save Draft</span>
              </button>
            </div>
          </div>

          {loadingReview || !reviewDetail ? (
            <div className="py-16 text-center text-slate-500">Loading evaluation rubric...</div>
          ) : (
            <div>
              {/* Project Overview */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 mb-8">
                <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                  <h2 className="text-xl font-bold text-white">{reviewDetail.review.projectTitle}</h2>
                  <div className="flex items-center gap-2">
                    {reviewDetail.review.repositoryUrl && (
                      <a
                        href={reviewDetail.review.repositoryUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 hover:text-white text-xs flex items-center gap-1.5"
                      >
                        <Github className="w-3.5 h-3.5" />
                        <span>Code Repo</span>
                      </a>
                    )}
                    {reviewDetail.review.demoUrl && (
                      <a
                        href={reviewDetail.review.demoUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2.5 py-1 rounded bg-slate-800 text-brand-400 hover:text-brand-300 text-xs flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Live Demo</span>
                      </a>
                    )}
                  </div>
                </div>
                <p className="text-sm text-slate-300 leading-relaxed mb-3">
                  {reviewDetail.review.projectSummary}
                </p>
                {reviewDetail.review.projectDescription && (
                  <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-line border-t border-slate-800/80 pt-3">
                    {reviewDetail.review.projectDescription}
                  </p>
                )}
              </div>

              {/* Rubric Criteria Form */}
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <Sliders className="w-4 h-4 text-brand-400" />
                <span>Weighted Scoring Criteria (Scale 1 – 5)</span>
              </h3>

              <div className="space-y-6 mb-8">
                {reviewDetail.criteria.map((c) => {
                  const currentVal = scores[c.id] || 3;
                  return (
                    <div
                      key={c.id}
                      className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 hover:border-slate-700 transition-colors"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div>
                          <span className="text-sm font-bold text-white">{c.name}</span>
                          <span className="text-xs text-slate-400 ml-2 font-mono">
                            (Weight: {(c.weight * 100).toFixed(0)}%)
                          </span>
                        </div>
                        <span className="text-xs text-brand-400 font-semibold bg-brand-500/10 border border-brand-500/20 px-2 py-0.5 rounded">
                          Current: {currentVal} / 5
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mb-4">{c.description}</p>

                      {/* Score Selector Buttons (1 to 5) */}
                      <div className="flex items-center gap-2 mb-3">
                        {[1, 2, 3, 4, 5].map((val) => {
                          const isSelected = currentVal === val;
                          return (
                            <button
                              key={val}
                              type="button"
                              onClick={() => {
                                setScores((prev) => ({ ...prev, [c.id]: val }));
                              }}
                              className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${
                                isSelected
                                  ? 'bg-brand-500 text-slate-950 shadow-md font-extrabold'
                                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                              }`}
                            >
                              {val}
                            </button>
                          );
                        })}
                      </div>

                      {/* Criterion Comment */}
                      <input
                        type="text"
                        placeholder={`Optional specific feedback on ${c.name.toLowerCase()}...`}
                        value={criterionComments[c.id] || ''}
                        onChange={(e) => {
                          setCriterionComments((prev) => ({
                            ...prev,
                            [c.id]: e.target.value,
                          }));
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  );
                })}
              </div>

              {/* Overall Comment */}
              <div className="mb-8">
                <label className="text-sm font-bold text-white block mb-2">Overall Review Comment</label>
                <textarea
                  rows={4}
                  placeholder="Summarize constructive remarks, strengths, and areas for improvement..."
                  value={overallComment}
                  onChange={(e) => setOverallComment(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-500"
                ></textarea>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setSelectedReviewId(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium"
                >
                  Cancel
                </button>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending}
                    className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-medium"
                  >
                    Save Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => submitMutation.mutate()}
                    disabled={submitMutation.isPending}
                    className="px-5 py-2 rounded-xl bg-brand-500 hover:bg-brand-600 text-slate-950 text-sm font-bold shadow-lg shadow-brand-500/20 flex items-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Submit Final Review</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Track Preferences Modal */}
      <TrackPreferencesModal
        eventId="evt_01"
        isOpen={showTrackModal}
        onClose={() => setShowTrackModal(false)}
      />

      {/* Conflict of Interest Modal */}
      {conflictTarget && (
        <ConflictDeclarationModal
          eventId="evt_01"
          projectId={conflictTarget.id}
          projectTitle={conflictTarget.title}
          isOpen={Boolean(conflictTarget)}
          onClose={() => setConflictTarget(null)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['judge-assignments'] });
          }}
        />
      )}
    </div>
  );
};
