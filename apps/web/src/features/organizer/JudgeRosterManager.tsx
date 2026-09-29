import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Gavel,
  UserPlus,
  Mail,
  ShieldCheck,
  AlertTriangle,
  Layers,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { apiRequest } from '../../api/client.js';

interface JudgeMember {
  userId: string;
  displayName: string;
  email: string;
  maxWorkload: number;
  bio?: string;
  preferredTrackIds: string[];
  assignedCount: number;
  conflictCount: number;
}

interface JudgeRosterManagerProps {
  eventId: string;
}

export const JudgeRosterManager: React.FC<JudgeRosterManagerProps> = ({ eventId }) => {
  const queryClient = useQueryClient();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [maxWorkload, setMaxWorkload] = useState(15);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Fetch judges roster
  const { data: judges = [], isLoading } = useQuery<JudgeMember[]>({
    queryKey: ['event-judges', eventId],
    queryFn: () => apiRequest<JudgeMember[]>(`/events/${eventId}/judges`),
  });

  // Invite judge mutation
  const inviteMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/events/${eventId}/judges/invite`, {
        method: 'POST',
        body: JSON.stringify({
          email,
          displayName: displayName || undefined,
          maxWorkload: Number(maxWorkload),
        }),
      });
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['event-judges', eventId] });
      setFeedback(`Judge ${data.judge.email} successfully invited and assigned role!`);
      setEmail('');
      setDisplayName('');
      setShowInviteModal(false);
    },
    onError: (err: any) => {
      setFeedback(`Failed to invite judge: ${err.message}`);
    },
  });

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    inviteMutation.mutate();
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-panel p-6 rounded-2xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-400 uppercase tracking-wider mb-1">
            <Gavel className="w-4 h-4" />
            <span>Judging Staff & Assignments</span>
          </div>
          <h2 className="text-xl font-bold text-white">Judge Roster & Workload Distribution</h2>
          <p className="text-xs text-slate-400 mt-1">
            Invite domain experts, configure workload limits, and monitor conflicts of interest.
          </p>
        </div>

        <button
          onClick={() => setShowInviteModal(true)}
          className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-sm flex items-center gap-2 shadow-lg shadow-brand-500/20 transition-all"
        >
          <UserPlus className="w-4 h-4" />
          <span>Invite Judge</span>
        </button>
      </div>

      {feedback && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-200 text-sm flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{feedback}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-emerald-400 text-xs hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Roster Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-slate-900 animate-pulse border border-slate-800"></div>
          ))}
        </div>
      ) : judges.length === 0 ? (
        <div className="text-center py-12 glass-panel rounded-2xl border border-slate-800">
          <Gavel className="w-10 h-10 text-slate-600 mx-auto mb-2" />
          <h3 className="text-base font-semibold text-white">No judges registered yet</h3>
          <p className="text-xs text-slate-400 mt-1">
            Invite judges by email to evaluate submissions with blind isolation.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {judges.map((judge) => (
            <div
              key={judge.userId}
              className="glass-panel p-5 rounded-xl border border-slate-800 flex flex-col justify-between space-y-4"
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-bold text-white text-base truncate">{judge.displayName}</h4>
                  <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-400 border border-brand-500/30">
                    JUDGE
                  </span>
                </div>
                <div className="text-xs text-slate-400 flex items-center gap-1.5 truncate">
                  <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{judge.email}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 py-2.5 px-3 rounded-xl bg-slate-900/80 border border-slate-800 text-center">
                <div>
                  <div className="text-[10px] uppercase font-semibold text-slate-400">Assigned</div>
                  <div className="text-sm font-bold text-white mt-0.5">{judge.assignedCount}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-semibold text-slate-400">Max Cap</div>
                  <div className="text-sm font-bold text-slate-300 mt-0.5">{judge.maxWorkload}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase font-semibold text-slate-400">Conflicts</div>
                  <div
                    className={`text-sm font-bold mt-0.5 ${
                      judge.conflictCount > 0 ? 'text-amber-400' : 'text-slate-500'
                    }`}
                  >
                    {judge.conflictCount}
                  </div>
                </div>
              </div>

              {judge.preferredTrackIds.length > 0 && (
                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-brand-400" />
                  <span>{judge.preferredTrackIds.length} Preferred Track(s)</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <UserPlus className="w-5 h-5 text-brand-400" />
                <span>Invite New Judge</span>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleInvite} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                  Judge Email Address *
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="judge@example.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                  Display Name (Optional)
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Dr. Jane Doe"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-300 mb-1">
                  Max Project Review Capacity
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={maxWorkload}
                  onChange={(e) => setMaxWorkload(Number(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteMutation.isPending}
                  className="px-5 py-2 bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-brand-500/20 disabled:opacity-50"
                >
                  <span>{inviteMutation.isPending ? 'Inviting...' : 'Send Invitation'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
