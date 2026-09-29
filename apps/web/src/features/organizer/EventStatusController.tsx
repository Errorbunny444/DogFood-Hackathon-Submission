import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '../../api/client.js';
import {
  Clock,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Calendar,
  Lock,
  Play,
  Award,
  Gavel,
  FileCheck,
  RotateCcw,
} from 'lucide-react';

interface EventStatusControllerProps {
  eventId: string;
  currentStatus: string;
  submissionDeadline: string;
  resultsPublished: boolean;
  onStatusChanged?: () => void;
}

const LIFECYCLE_STEPS = [
  { id: 'DRAFT', label: 'Draft', desc: 'Configuring rubrics & tracks' },
  { id: 'PUBLISHED', label: 'Published', desc: 'Public page preview live' },
  { id: 'REGISTRATION', label: 'Registration', desc: 'Participant signups open' },
  { id: 'ACTIVE', label: 'Active', desc: 'Hacking & Submissions open' },
  { id: 'SUBMISSIONS_CLOSED', label: 'Submissions Closed', desc: 'Deadline passed' },
  { id: 'JUDGING', label: 'Judging', desc: 'Score isolation in effect' },
  { id: 'RESULTS_READY', label: 'Results Ready', desc: 'Normalized & verified' },
  { id: 'COMPLETED', label: 'Completed', desc: 'Winners publicly published' },
];

const VALID_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['PUBLISHED', 'REGISTRATION', 'ARCHIVED'],
  PUBLISHED: ['REGISTRATION', 'ACTIVE', 'ARCHIVED'],
  REGISTRATION: ['ACTIVE', 'SUBMISSIONS_CLOSED', 'ARCHIVED'],
  ACTIVE: ['SUBMISSIONS_CLOSED', 'ARCHIVED'],
  SUBMISSIONS_CLOSED: ['JUDGING', 'ACTIVE', 'ARCHIVED'],
  JUDGING: ['RESULTS_READY', 'SUBMISSIONS_CLOSED', 'ARCHIVED'],
  RESULTS_READY: ['COMPLETED', 'JUDGING', 'ARCHIVED'],
  COMPLETED: ['ARCHIVED'],
  ARCHIVED: ['DRAFT'],
};

export const EventStatusController: React.FC<EventStatusControllerProps> = ({
  eventId,
  currentStatus,
  submissionDeadline,
  resultsPublished,
  onStatusChanged,
}) => {
  const queryClient = useQueryClient();
  const [transitioningTo, setTransitioningTo] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [isExtendingDeadline, setIsExtendingDeadline] = useState(false);
  const [newDeadline, setNewDeadline] = useState(
    submissionDeadline ? new Date(submissionDeadline).toISOString().slice(0, 16) : ''
  );

  const currentStepIndex = LIFECYCLE_STEPS.findIndex((s) => s.id === currentStatus);
  const allowedNextStatuses = VALID_TRANSITIONS[currentStatus] || [];

  // Status transition mutation
  const transitionMutation = useMutation({
    mutationFn: async (targetStatus: string) => {
      return await apiRequest(`/events/${eventId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: targetStatus, reason }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-info'] });
      setTransitioningTo(null);
      setReason('');
      setErrorMsg(null);
      onStatusChanged?.();
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'Status transition failed.');
    },
  });

  // Deadline update mutation
  const deadlineMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/events/${eventId}/timeline`, {
        method: 'PATCH',
        body: JSON.stringify({
          submissionDeadline: new Date(newDeadline).toISOString(),
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event-info'] });
      setIsExtendingDeadline(false);
      alert('Submission deadline updated successfully.');
    },
    onError: (err: any) => {
      alert(err.message || 'Failed to update deadline');
    },
  });

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-8 shadow-xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-400">
              Event State Machine
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-800 border border-slate-700 text-slate-300">
              Current: {currentStatus.replace('_', ' ')}
            </span>
          </div>
          <h2 className="text-xl font-bold text-white mt-1">Lifecycle & Deadlines</h2>
          <p className="text-xs text-slate-400">
            Server-enforced event state machine. Controls registration, submission lock, and judging.
          </p>
        </div>

        {/* Quick Deadline Status */}
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-[11px] text-slate-500">Submission Deadline</div>
            <div className="text-xs font-mono font-semibold text-slate-200">
              {new Date(submissionDeadline).toLocaleString()}
            </div>
          </div>
          <button
            onClick={() => setIsExtendingDeadline(!isExtendingDeadline)}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition flex items-center gap-1.5"
          >
            <Clock className="w-3.5 h-3.5 text-brand-400" />
            <span>Adjust Deadline</span>
          </button>
        </div>
      </div>

      {/* Deadline Extension Dropdown */}
      {isExtendingDeadline && (
        <div className="mb-6 p-4 rounded-xl bg-slate-950 border border-slate-800 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[240px]">
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              New Server-Enforced Deadline (UTC / Local)
            </label>
            <input
              type="datetime-local"
              value={newDeadline}
              onChange={(e) => setNewDeadline(e.target.value)}
              className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-brand-500"
            />
          </div>
          <div className="flex items-center gap-2 pt-5">
            <button
              onClick={() => deadlineMutation.mutate()}
              disabled={deadlineMutation.isPending}
              className="px-4 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs transition"
            >
              {deadlineMutation.isPending ? 'Saving...' : 'Apply Deadline'}
            </button>
            <button
              onClick={() => setIsExtendingDeadline(false)}
              className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Visual State Machine Pipeline */}
      <div className="overflow-x-auto pb-2">
        <div className="flex items-center min-w-[700px] justify-between relative">
          <div className="absolute top-1/2 left-4 right-4 h-0.5 bg-slate-800 -translate-y-1/2 -z-0"></div>

          {LIFECYCLE_STEPS.map((step, idx) => {
            const isCompleted = currentStepIndex > idx;
            const isCurrent = currentStepIndex === idx;
            const isAllowedNext = allowedNextStatuses.includes(step.id);

            return (
              <div key={step.id} className="relative z-10 flex flex-col items-center text-center px-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all shadow-md ${
                    isCurrent
                      ? 'bg-brand-500 text-slate-950 ring-4 ring-brand-500/20 scale-110 font-extrabold'
                      : isCompleted
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-800 border border-slate-700 text-slate-500'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                </div>

                <div className="mt-2 text-[11px] font-bold text-white whitespace-nowrap">
                  {step.label}
                </div>
                <div className="text-[9px] text-slate-500 max-w-[80px] truncate leading-tight">
                  {step.desc}
                </div>

                {isAllowedNext && (
                  <button
                    onClick={() => setTransitioningTo(step.id)}
                    className="mt-2 px-2 py-0.5 rounded text-[10px] font-bold bg-brand-500/20 border border-brand-500/50 text-brand-300 hover:bg-brand-500 hover:text-slate-950 transition"
                  >
                    Transition →
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {errorMsg && (
        <div className="mt-4 p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Transition Confirmation Modal */}
      {transitioningTo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-bold text-white mb-1">Confirm Status Transition</h3>
            <p className="text-xs text-slate-400 mb-4">
              Transition event state from <strong className="text-white">{currentStatus}</strong> to{' '}
              <strong className="text-brand-400">{transitioningTo}</strong>.
            </p>

            <div className="mb-4">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Reason / Audit Log Note (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Submissions deadline reached, starting evaluation"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setTransitioningTo(null)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={() => transitionMutation.mutate(transitioningTo)}
                disabled={transitionMutation.isPending}
                className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs transition disabled:opacity-50"
              >
                {transitionMutation.isPending ? 'Transitioning...' : 'Confirm Transition'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
