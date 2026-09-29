import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import { CreateOrgModal } from './CreateOrgModal.js';
import {
  Building2,
  Plus,
  ArrowRight,
  Shield,
  Search,
  Globe,
  ExternalLink,
  Layers,
} from 'lucide-react';

interface Organization {
  id: string;
  slug: string;
  name: string;
  description: string;
  website: string | null;
  role?: string;
  status?: string;
  createdAt: string;
}

export const OrganizationsDirectoryPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchOrgs = async () => {
    setLoading(true);
    try {
      const res = await apiRequest<{ organizations: Organization[] }>('/organizations');
      setOrgs(res.organizations || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOrgs();
  }, [user]);

  const filteredOrgs = orgs.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.slug.toLowerCase().includes(search.toLowerCase()) ||
      (o.description && o.description.toLowerCase().includes(search.toLowerCase()))
  );

  const myOrgs = filteredOrgs.filter((o) => !!o.role);
  const otherOrgs = filteredOrgs.filter((o) => !o.role);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2 text-brand-400 font-semibold text-xs tracking-wider uppercase mb-1">
            <Layers className="w-4 h-4" />
            <span>Multi-Tenant Architecture</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Organizations</h1>
          <p className="text-slate-400 text-sm mt-1">
            Browse hackathon organizations or manage your multi-tenant workspaces.
          </p>
        </div>

        {user && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs transition flex items-center gap-2 shadow-lg shadow-brand-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Create Organization</span>
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="mb-8 relative max-w-md">
        <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-500" />
        <input
          type="text"
          placeholder="Filter organizations by name or slug..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-slate-900 border border-slate-800 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-brand-500 transition"
        />
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">
          <Building2 className="w-8 h-8 animate-pulse mx-auto mb-2 text-brand-400" />
          <p className="text-xs">Loading organizations...</p>
        </div>
      ) : (
        <div className="space-y-10">
          {/* My Organizations Section */}
          {myOrgs.length > 0 && (
            <div>
              <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4 text-brand-400" />
                <span>My Workspaces ({myOrgs.length})</span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {myOrgs.map((org) => (
                  <Link
                    key={org.id}
                    to={`/o/${org.slug}`}
                    className="bg-slate-900 border border-brand-500/30 hover:border-brand-500 rounded-2xl p-6 transition flex flex-col justify-between group shadow-lg shadow-brand-500/5"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="w-10 h-10 rounded-xl bg-brand-500/10 border border-brand-500/30 flex items-center justify-center text-brand-400 font-bold text-sm">
                          {org.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-500/20 text-brand-300 border border-brand-500/30">
                          {org.role}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-white group-hover:text-brand-400 transition mb-1">
                        {org.name}
                      </h3>
                      <p className="text-xs font-mono text-slate-500 mb-2">/o/{org.slug}</p>
                      <p className="text-xs text-slate-400 line-clamp-2">
                        {org.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-brand-400 font-semibold">
                      <span>Open Workspace</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* All Organizations Section */}
          <div>
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Building2 className="w-4 h-4 text-slate-400" />
              <span>
                {myOrgs.length > 0 ? 'Other Organizations' : 'All Organizations'} (
                {otherOrgs.length})
              </span>
            </h2>

            {otherOrgs.length === 0 ? (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
                <Building2 className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm font-medium text-slate-300">No organizations found</p>
                <p className="text-xs text-slate-500 mt-1">
                  Try adjusting your search filter or create a new organization workspace.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {otherOrgs.map((org) => (
                  <Link
                    key={org.id}
                    to={`/o/${org.slug}`}
                    className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-6 transition flex flex-col justify-between group"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-3">
                        <span className="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-sm">
                          {org.name.slice(0, 2).toUpperCase()}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-800">
                          /o/{org.slug}
                        </span>
                      </div>

                      <h3 className="text-lg font-bold text-white group-hover:text-brand-400 transition mb-1">
                        {org.name}
                      </h3>
                      <p className="text-xs text-slate-400 line-clamp-2">
                        {org.description || 'No description provided.'}
                      </p>
                    </div>

                    <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-medium">
                      <span>View Public Workspace</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-1 group-hover:text-brand-400 transition" />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Create Organization Modal */}
      <CreateOrgModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={(newOrg) => {
          navigate(`/o/${newOrg.slug}`);
        }}
      />
    </div>
  );
};
