import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { apiRequest } from '../../api/client.js';
import { X, Building2, Globe, FileText, Sparkles, AlertCircle } from 'lucide-react';

interface CreateOrgModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (org: any) => void;
}

export const CreateOrgModal: React.FC<CreateOrgModalProps> = ({ isOpen, onClose, onCreated }) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [website, setWebsite] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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

  const handleNameChange = (val: string) => {
    setName(val);
    // Auto-generate slug from name if user hasn't typed custom slug
    const generated = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
    setSlug(generated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await apiRequest<{ organization: any }>('/organizations', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim(),
          website: website.trim() || undefined,
        }),
      });

      onCreated(res.organization);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm overflow-y-auto"
      onClick={onClose}
    >
      <div className="min-h-full flex items-center justify-center p-4">
        <div
          className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative my-8 animate-in fade-in duration-150"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Create Organization</h2>
            <p className="text-xs text-slate-400">
              Set up a multi-tenant workspace to organize events, teams, and judges.
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800/50 flex items-start gap-2 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-red-400 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Organization Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Acme Tech Labs"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500 placeholder:text-slate-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              URL Slug <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-400 focus-within:border-brand-500">
              <span className="text-xs text-slate-500 select-none mr-1">/o/</span>
              <input
                type="text"
                required
                pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                title="Lowercase letters, numbers, and hyphens only."
                placeholder="acme-tech-labs"
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                className="w-full bg-transparent text-white focus:outline-none font-mono text-xs placeholder:text-slate-600"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Unique identifier used in URLs. Letters, numbers, and single hyphens.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              placeholder="What does your organization or university do?"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500 placeholder:text-slate-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Official Website
            </label>
            <div className="relative">
              <Globe className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="url"
                placeholder="https://example.com"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500 placeholder:text-slate-600"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim() || !slug.trim()}
              className="px-5 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-950 font-semibold text-xs transition flex items-center gap-1.5 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Workspace'}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>,
  document.body
);
};
