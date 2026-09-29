import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Vote,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Shuffle,
  Lock,
  Sparkles,
} from 'lucide-react';
import { apiClient } from '../../api/client.js';

interface BallotProject {
  id: string;
  sourceId: string | null;
  title: string;
  tagline: string | null;
  summary: string | null;
  repositoryUrl: string | null;
  demoUrl: string | null;
}

interface BallotResponse {
  eventId: string;
  hasVoted: boolean;
  votedProjectId: string | null;
  projects: BallotProject[];
}

export const VotingPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const { data, isLoading, error } = useQuery<BallotResponse>({
    queryKey: ['ballot', 'evt_01'],
    queryFn: async () => {
      return apiClient.get<BallotResponse>('/events/evt_01/ballot');
    },
  });

  const voteMutation = useMutation({
    mutationFn: async (projectId: string) => {
      return apiClient.post('/events/evt_01/votes', { projectId });
    },
    onSuccess: () => {
      setFeedback({
        type: 'success',
        message: 'Your community vote has been immutably recorded in the database!',
      });
      queryClient.invalidateQueries({ queryKey: ['ballot', 'evt_01'] });
    },
    onError: (err: any) => {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to record vote. You may have already voted.',
      });
    },
  });

  const projects = data?.projects || [];
  const hasVoted = data?.hasVoted || false;
  const votedProjectId = data?.votedProjectId;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-700 flex items-center justify-center shadow-lg shadow-purple-500/20">
              <Vote className="w-7 h-7 text-white font-bold" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                  Community Choice Ballot
                </h1>
                <span className="bg-purple-500/10 text-purple-400 text-xs px-2.5 py-0.5 rounded-full border border-purple-500/30 font-semibold flex items-center gap-1">
                  <Sparkles className="w-3.5 h-3.5" /> Public Voting Active
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-1">
                Help decide the Community Choice Award. Ballots are deterministically shuffled to eliminate presentation bias.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 px-3 py-2 rounded-lg">
          <Shuffle className="w-4 h-4 text-purple-400" />
          <span>Stable Seeded Shuffle Active</span>
        </div>
      </div>

      {/* Fairness & Anti-Abuse Notification */}
      <div className="glass-panel p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-400">
        <div className="flex items-center gap-2 text-slate-300">
          <ShieldCheck className="w-4 h-4 text-purple-400 shrink-0" />
          <span>
            <strong>Anti-Abuse Controls:</strong> Each participant / visitor is limited to 1 community vote. Ballots maintain consistent ordering across page refreshes for your session.
          </span>
        </div>
        {hasVoted && (
          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full font-semibold flex items-center gap-1.5 shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5" /> Ballot Submitted
          </span>
        )}
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm flex items-center justify-between gap-3 animate-in fade-in ${
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-300'
              : 'bg-rose-500/10 border border-rose-500/30 text-rose-300'
          }`}
        >
          <span>{feedback.message}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Project Ballot Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {projects.map((proj, idx) => {
          const isSelected = votedProjectId === proj.id;
          return (
            <div
              key={proj.id}
              className={`glass-panel rounded-2xl border transition-all duration-200 flex flex-col justify-between p-6 ${
                isSelected
                  ? 'border-emerald-500 bg-emerald-500/5 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/30'
                  : 'border-slate-800/80 hover:border-slate-700 bg-slate-900/40'
              }`}
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono text-xs text-purple-400 bg-purple-500/10 border border-purple-500/20 px-2 py-0.5 rounded">
                    Ballot #{idx + 1}
                  </span>
                  {isSelected && (
                    <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Your Vote
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white tracking-tight">{proj.title}</h3>
                  {proj.tagline && (
                    <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                      {proj.tagline}
                    </p>
                  )}
                </div>

                {proj.summary && (
                  <p className="text-xs text-slate-500 line-clamp-3 leading-relaxed border-t border-slate-800/60 pt-2">
                    {proj.summary}
                  </p>
                )}
              </div>

              <div className="pt-4 mt-4 border-t border-slate-800/60 space-y-4">
                <div className="flex items-center gap-3 text-xs text-slate-400">
                  {proj.repositoryUrl && (
                    <a
                      href={proj.repositoryUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-purple-300 flex items-center gap-1"
                    >
                      <span>Code</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {proj.demoUrl && (
                    <a
                      href={proj.demoUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="hover:text-purple-300 flex items-center gap-1"
                    >
                      <span>Demo</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>

                <button
                  onClick={() => voteMutation.mutate(proj.id)}
                  disabled={hasVoted || voteMutation.isPending}
                  className={`w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                    isSelected
                      ? 'bg-emerald-500 text-slate-950 cursor-default'
                      : hasVoted
                      ? 'bg-slate-800 text-slate-500 cursor-not-allowed'
                      : 'bg-purple-600 hover:bg-purple-500 text-white shadow-md shadow-purple-600/20'
                  }`}
                >
                  {isSelected ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" /> Voted
                    </>
                  ) : hasVoted ? (
                    <>
                      <Lock className="w-4 h-4" /> Voting Locked
                    </>
                  ) : (
                    <>
                      <Vote className="w-4 h-4" /> Cast Ballot
                    </>
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
