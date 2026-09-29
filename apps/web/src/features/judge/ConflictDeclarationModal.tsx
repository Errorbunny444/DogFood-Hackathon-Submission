import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ShieldAlert } from 'lucide-react';
import { apiRequest } from '../../api/client.js';

interface ConflictDeclarationModalProps {
  eventId: string;
  projectId: string;
  projectTitle: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const ConflictDeclarationModal: React.FC<ConflictDeclarationModalProps> = ({
  eventId,
  projectId,
  projectTitle,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const queryClient = useQueryClient();
  const [reason, setReason] = useState('Conflict of interest: prior mentorship or collaboration.');
  const [error, setError] = useState<string | null>(null);

  const conflictMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/events/${eventId}/judge/conflicts`, {
        method: 'POST',
        body: JSON.stringify({
          projectId,
          reason,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judge-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['judge-conflicts'] });
      onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to declare conflict');
    },
  });

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

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in"
      onClick={onClose}
    >
      <div className="min-h-full flex items-center justify-center p-4">
        <div
          className="bg-slate-900 border border-amber-500/30 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative my-8"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Declare Conflict of Interest</h3>
            <p className="text-xs text-slate-400">Automated un-assignment protocol</p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed">
          Declaring a conflict of interest on <strong className="text-white">"{projectTitle}"</strong> will{' '}
          <span className="font-bold text-amber-300">immediately remove this project</span> from your assigned queue and flag it in the organizer audit ledger.
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs rounded-lg">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
            Reason for Conflict *
          </label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-500"
            placeholder="E.g., Mentored the team members, advisor to the project, financial conflict..."
          />
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => conflictMutation.mutate()}
            disabled={conflictMutation.isPending || !reason.trim()}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            <span>{conflictMutation.isPending ? 'Unassigning...' : 'Confirm Conflict'}</span>
          </button>
        </div>
      </div>
    </div>
  </div>,
  document.body
);
};
