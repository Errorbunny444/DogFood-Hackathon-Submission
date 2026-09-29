import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Layers, Check, CheckCircle2 } from 'lucide-react';
import { apiRequest } from '../../api/client.js';

interface Track {
  id: string;
  name: string;
  description: string;
}

interface TrackPreferencesModalProps {
  eventId: string;
  isOpen: boolean;
  onClose: () => void;
}

export const TrackPreferencesModal: React.FC<TrackPreferencesModalProps> = ({
  eventId,
  isOpen,
  onClose,
}) => {
  const queryClient = useQueryClient();
  const [selectedTrackIds, setSelectedTrackIds] = useState<string[]>([]);

  // Fetch event full details (tracks)
  const { data: eventData } = useQuery<{ tracks: Track[] }>({
    queryKey: ['event-full', eventId],
    queryFn: () => apiRequest<{ tracks: Track[] }>(`/events/${eventId}/full`),
    enabled: isOpen,
  });

  // Fetch current judge preferences
  const { data: currentPrefs } = useQuery<{ trackIds: string[] }>({
    queryKey: ['judge-preferences', eventId],
    queryFn: () => apiRequest<{ trackIds: string[] }>(`/events/${eventId}/judge/preferences`),
    enabled: isOpen,
  });

  useEffect(() => {
    if (currentPrefs?.trackIds) {
      setSelectedTrackIds(currentPrefs.trackIds);
    }
  }, [currentPrefs]);

  const toggleTrack = (id: string) => {
    setSelectedTrackIds((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/events/${eventId}/judge/preferences`, {
        method: 'PUT',
        body: JSON.stringify({ trackIds: selectedTrackIds }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['judge-preferences', eventId] });
      onClose();
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

  const tracks = eventData?.tracks || [];

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm overflow-y-auto animate-in fade-in"
      onClick={onClose}
    >
      <div className="min-h-full flex items-center justify-center p-4">
        <div
          className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl relative my-8"
          onClick={(e) => e.stopPropagation()}
        >
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <Layers className="w-5 h-5 text-brand-400" />
            <span>Select Preferred Tracks</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Choose the tracks that align with your domain expertise. The auto-assignment algorithm will prioritize assigning projects in these tracks to you.
        </p>

        <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
          {tracks.length === 0 ? (
            <div className="text-xs text-slate-500 py-4 text-center">No tracks defined for this event.</div>
          ) : (
            tracks.map((track) => {
              const isSelected = selectedTrackIds.includes(track.id);
              return (
                <div
                  key={track.id}
                  onClick={() => toggleTrack(track.id)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                    isSelected
                      ? 'bg-brand-500/10 border-brand-500/40 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div>
                    <h4 className="font-bold text-sm">{track.name}</h4>
                    {track.description && (
                      <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
                        {track.description}
                      </p>
                    )}
                  </div>
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center border shrink-0 mt-0.5 ${
                      isSelected
                        ? 'bg-brand-500 border-brand-400 text-slate-950'
                        : 'border-slate-700'
                    }`}
                  >
                    {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="px-5 py-2 bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-brand-500/20 disabled:opacity-50"
          >
            <span>{saveMutation.isPending ? 'Saving...' : 'Save Preferences'}</span>
          </button>
        </div>
      </div>
    </div>
  </div>,
  document.body
);
};
