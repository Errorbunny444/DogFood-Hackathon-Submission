import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiRequest } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  Building2,
  Calendar,
  Users,
  Settings,
  Plus,
  Globe,
  Shield,
  ShieldAlert,
  UserPlus,
  Trash2,
  ExternalLink,
  AlertCircle,
  CheckCircle,
  Award,
} from 'lucide-react';

interface Organization {
  id: string;
  slug: string;
  name: string;
  description: string;
  website: string | null;
  createdAt: string;
}

interface OrgMember {
  id: string;
  userId: string;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
  status: string;
  joinedAt: string;
  displayName: string;
  email: string;
  avatarPath: string | null;
}

interface OrgEvent {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: string;
  submissionDeadline: string;
  communityVotingEnabled: boolean;
  resultsPublished: boolean;
}

export const OrganizationPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const { user } = useAuth();

  const [org, setOrg] = useState<Organization | null>(null);
  const [stats, setStats] = useState<{ memberCount: number; eventCount: number }>({
    memberCount: 0,
    eventCount: 0,
  });
  const [events, setEvents] = useState<OrgEvent[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'events' | 'members' | 'settings'>('events');

  // Members state
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'MEMBER' | 'ADMIN' | 'OWNER'>('MEMBER');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  // Settings state
  const [settingsName, setSettingsName] = useState('');
  const [settingsDesc, setSettingsDesc] = useState('');
  const [settingsWebsite, setSettingsWebsite] = useState('');
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchOrgDetails = async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<{
        organization: Organization;
        stats: { memberCount: number; eventCount: number };
        events: OrgEvent[];
        currentUserRole: string | null;
      }>(`/organizations/${slug}`);

      setOrg(res.organization);
      setStats(res.stats);
      setEvents(res.events || []);
      setCurrentUserRole(res.currentUserRole);

      setSettingsName(res.organization.name);
      setSettingsDesc(res.organization.description || '');
      setSettingsWebsite(res.organization.website || '');
    } catch (err: any) {
      setError(err.message || 'Failed to load organization details');
    } finally {
      setLoading(false);
    }
  };

  const fetchMembers = async () => {
    if (!slug) return;
    setLoadingMembers(true);
    try {
      const res = await apiRequest<{ members: OrgMember[] }>(`/organizations/${slug}/members`);
      setMembers(res.members || []);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    fetchOrgDetails();
  }, [slug]);

  useEffect(() => {
    if (activeTab === 'members') {
      fetchMembers();
    }
  }, [activeTab]);

  const canManage = currentUserRole === 'OWNER' || currentUserRole === 'ADMIN';
  const isOwner = currentUserRole === 'OWNER';

  const handleInviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteError(null);
    try {
      await apiRequest(`/organizations/${slug}/members`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      setShowInviteModal(false);
      setInviteEmail('');
      fetchMembers();
      fetchOrgDetails();
    } catch (err: any) {
      setInviteError(err.message || 'Failed to add member');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleRoleChange = async (targetUserId: string, newRole: string) => {
    try {
      await apiRequest(`/organizations/${slug}/members/${targetUserId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: newRole }),
      });
      fetchMembers();
    } catch (err: any) {
      alert(err.message || 'Failed to update role');
    }
  };

  const handleRemoveMember = async (targetUserId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName} from this organization?`)) {
      return;
    }
    try {
      await apiRequest(`/organizations/${slug}/members/${targetUserId}`, {
        method: 'DELETE',
      });
      fetchMembers();
      fetchOrgDetails();
    } catch (err: any) {
      alert(err.message || 'Failed to remove member');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingsLoading(true);
    setSettingsMsg(null);
    try {
      const res = await apiRequest<{ organization: Organization }>(`/organizations/${slug}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: settingsName.trim(),
          description: settingsDesc.trim(),
          website: settingsWebsite.trim() || undefined,
        }),
      });
      setOrg(res.organization);
      setSettingsMsg({ type: 'success', text: 'Organization settings updated successfully.' });
    } catch (err: any) {
      setSettingsMsg({ type: 'error', text: err.message || 'Failed to save settings' });
    } finally {
      setSettingsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center text-slate-400">
        <Building2 className="w-8 h-8 animate-pulse mx-auto mb-2 text-brand-400" />
        <p>Loading organization workspace...</p>
      </div>
    );
  }

  if (error || !org) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <h2 className="text-xl font-bold text-white mb-2">Organization Not Found</h2>
        <p className="text-sm text-slate-400 mb-6">{error || 'Could not locate this organization.'}</p>
        <Link
          to="/organizations"
          className="px-4 py-2 bg-brand-500 text-slate-950 font-semibold rounded-lg text-xs"
        >
          View All Organizations
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Organization Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 mb-8 relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-400/20 to-brand-600/10 border border-brand-500/30 flex items-center justify-center text-brand-400 shrink-0">
              <Building2 className="w-8 h-8" />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl sm:text-3xl font-bold text-white">{org.name}</h1>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-slate-800 border border-slate-700 text-slate-300">
                  /o/{org.slug}
                </span>
                {currentUserRole && (
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-brand-500/20 border border-brand-500/40 text-brand-300 flex items-center gap-1">
                    <Shield className="w-3 h-3" /> {currentUserRole}
                  </span>
                )}
              </div>
              <p className="text-slate-400 text-sm mt-1 max-w-2xl">
                {org.description || 'No description provided.'}
              </p>
              {org.website && (
                <a
                  href={org.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-brand-400 hover:text-brand-300 mt-2"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>{org.website}</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link
              to="/organizer"
              className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-semibold text-xs transition flex items-center gap-1.5 shadow-lg shadow-brand-500/20"
            >
              <Plus className="w-4 h-4" />
              <span>Organizer Center</span>
            </Link>
          </div>
        </div>

        {/* Workspace Quick Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-800/80">
          <div>
            <div className="text-xs text-slate-500">Active Hackathons</div>
            <div className="text-xl font-bold text-white mt-0.5">{stats.eventCount}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Team Members</div>
            <div className="text-xl font-bold text-white mt-0.5">{stats.memberCount}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Access Mode</div>
            <div className="text-sm font-semibold text-emerald-400 mt-1">Multi-Tenant Isolated</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Workspace Status</div>
            <div className="text-sm font-semibold text-brand-400 mt-1">Verified Organization</div>
          </div>
        </div>
      </div>

      {/* Workspace Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-800 mb-6">
        <button
          onClick={() => setActiveTab('events')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
            activeTab === 'events'
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Hackathons & Events ({events.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('members')}
          className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
            activeTab === 'members'
              ? 'border-brand-500 text-brand-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Team & Permissions ({stats.memberCount})</span>
        </button>

        {canManage && (
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs font-semibold border-b-2 transition ${
              activeTab === 'settings'
                ? 'border-brand-500 text-brand-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Organization Settings</span>
          </button>
        )}
      </div>

      {/* Tab: Events */}
      {activeTab === 'events' && (
        <div className="space-y-4">
          {events.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-400">
              <Calendar className="w-8 h-8 text-slate-600 mx-auto mb-2" />
              <p className="text-sm font-medium text-slate-300">No events yet in this organization</p>
              <p className="text-xs text-slate-500 mt-1">
                Launch your first hackathon with custom rubrics and judge normalization.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {events.map((evt) => (
                <div
                  key={evt.id}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 transition flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-slate-800 text-slate-400">
                        {evt.slug}
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${
                          evt.status === 'ACTIVE'
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : evt.status === 'SUBMISSIONS_CLOSED'
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        {evt.status.replace('_', ' ')}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-white mb-1">{evt.name}</h3>
                    <p className="text-xs text-slate-400 line-clamp-2 mb-4">
                      {evt.description || 'No description.'}
                    </p>
                  </div>

                  <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs">
                    <span className="text-slate-500">
                      Deadline: {new Date(evt.submissionDeadline).toLocaleDateString()}
                    </span>
                    <Link
                      to="/"
                      className="text-brand-400 hover:text-brand-300 font-semibold inline-flex items-center gap-1"
                    >
                      <span>Public Gallery</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Members */}
      {activeTab === 'members' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-base font-bold text-white">Organization Team Members</h3>
              <p className="text-xs text-slate-400">
                Owners can manage workspace settings and invite administrators.
              </p>
            </div>
            {canManage && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-3.5 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-950 font-semibold text-xs transition flex items-center gap-1.5"
              >
                <UserPlus className="w-4 h-4" />
                <span>Invite Member</span>
              </button>
            )}
          </div>

          {loadingMembers ? (
            <div className="py-8 text-center text-slate-400 text-xs">Loading members...</div>
          ) : (
            <div className="divide-y divide-slate-800">
              {members.map((mem) => (
                <div key={mem.id} className="py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-brand-400 text-xs">
                      {mem.displayName.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-white flex items-center gap-2">
                        {mem.displayName}
                        {mem.userId === user?.id && (
                          <span className="text-[10px] text-slate-400 font-normal">(You)</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400">{mem.email}</div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {canManage && mem.userId !== user?.id ? (
                      <select
                        value={mem.role}
                        onChange={(e) => handleRoleChange(mem.userId, e.target.value)}
                        className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-brand-500"
                      >
                        <option value="MEMBER">MEMBER</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="OWNER">OWNER</option>
                      </select>
                    ) : (
                      <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-800 text-slate-300">
                        {mem.role}
                      </span>
                    )}

                    {(canManage || mem.userId === user?.id) && (
                      <button
                        onClick={() => handleRemoveMember(mem.userId, mem.displayName)}
                        title={mem.userId === user?.id ? 'Leave Organization' : 'Remove Member'}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab: Settings */}
      {activeTab === 'settings' && canManage && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-2xl">
          <h3 className="text-base font-bold text-white mb-1">Organization Profile</h3>
          <p className="text-xs text-slate-400 mb-6">
            Update your organization display name, description, and website.
          </p>

          {settingsMsg && (
            <div
              className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-xs ${
                settingsMsg.type === 'success'
                  ? 'bg-emerald-950/40 border border-emerald-800/50 text-emerald-300'
                  : 'bg-red-950/40 border border-red-800/50 text-red-300'
              }`}
            >
              {settingsMsg.type === 'success' ? (
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400" />
              )}
              <span>{settingsMsg.text}</span>
            </div>
          )}

          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Organization Name
              </label>
              <input
                type="text"
                required
                value={settingsName}
                onChange={(e) => setSettingsName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Description
              </label>
              <textarea
                rows={3}
                value={settingsDesc}
                onChange={(e) => setSettingsDesc(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Website
              </label>
              <input
                type="url"
                value={settingsWebsite}
                onChange={(e) => setSettingsWebsite(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>

            <button
              type="submit"
              disabled={settingsLoading}
              className="px-5 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-950 font-semibold text-xs transition disabled:opacity-50"
            >
              {settingsLoading ? 'Saving...' : 'Save Settings'}
            </button>
          </form>
        </div>
      )}

      {/* Invite Member Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-1">Invite Team Member</h3>
            <p className="text-xs text-slate-400 mb-4">
              Add a registered user to '{org.name}' by email.
            </p>

            {inviteError && (
              <div className="mb-4 p-3 rounded-lg bg-red-950/40 border border-red-800/50 text-xs text-red-300">
                {inviteError}
              </div>
            )}

            <form onSubmit={handleInviteMember} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  User Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="collaborator@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Assigned Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500"
                >
                  <option value="MEMBER">MEMBER (View events, assist judges)</option>
                  <option value="ADMIN">ADMIN (Create events, manage members)</option>
                  <option value="OWNER">OWNER (Full workspace ownership)</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 rounded-lg text-xs text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={inviteLoading || !inviteEmail.trim()}
                  className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-400 text-slate-950 font-semibold text-xs disabled:opacity-50"
                >
                  {inviteLoading ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
