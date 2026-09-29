import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search,
  ExternalLink,
  Github,
  Layers,
  Sparkles,
  Users,
  Filter,
  CheckCircle2,
  X,
  Radio,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../api/client.js';
import { getProjectRepositoryLink, getProjectDemoLink } from '../../lib/urls.js';

interface Project {
  id: string;
  sourceId: string | null;
  sourceType?: string;
  title: string;
  tagline: string;
  summary: string;
  description: string;
  repositoryUrl: string | null;
  demoUrl: string | null;
  videoUrl: string | null;
  status: string;
  submittedAt: string | null;
  trackId: string | null;
  trackName: string | null;
  teamId: string | null;
  teamName: string | null;
}

export const GalleryPage: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTrack, setSelectedTrack] = useState<string>('ALL');
  const [activeProject, setActiveProject] = useState<Project | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveProject(null);
      }
    };
    if (activeProject) {
      window.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [activeProject]);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['public-projects'],
    queryFn: () => apiRequest<Project[]>('/public/projects'),
  });

  // Extract distinct tracks
  const tracks = Array.from(
    new Set(projects.map((p) => p.trackName).filter(Boolean) as string[])
  ).sort();

  // Filter projects
  const filtered = projects.filter((p) => {
    const matchesTrack = selectedTrack === 'ALL' || p.trackName === selectedTrack;
    const q = searchTerm.toLowerCase();
    const matchesSearch =
      !searchTerm ||
      p.title.toLowerCase().includes(q) ||
      p.summary.toLowerCase().includes(q) ||
      (p.teamName && p.teamName.toLowerCase().includes(q)) ||
      (p.sourceId && p.sourceId.toLowerCase().includes(q));
    return matchesTrack && matchesSearch;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 transition-colors">
      {/* Hero Banner */}
      <div className="relative rounded-2xl overflow-hidden glass-panel p-8 mb-8 border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/80 shadow-sm">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-400 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Public Competition Showcase</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 dark:text-white tracking-tight mb-3">
            Auditable Project Submissions
          </h1>
          <p className="text-slate-600 dark:text-slate-300 text-base leading-relaxed mb-6">
            Explore verified hackathon projects evaluated by independent judges. Every score is mathematically calibrated, isolated, explainable, and defended.
          </p>
          <div className="flex flex-wrap items-center gap-6 text-sm text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-white text-lg">{projects.length}</span>
              <span>Submissions</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-white text-lg">{tracks.length}</span>
              <span>Tracks</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-slate-900 dark:text-white text-lg">126</span>
              <span>Peer Reviews</span>
            </div>
          </div>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search projects by title, team, or summary..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs sm:text-sm text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:border-slate-400 dark:focus:border-slate-600 shadow-sm transition"
          />
        </div>

        {/* Track Filter Chips */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 sm:pb-0">
          <button
            onClick={() => setSelectedTrack('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              selectedTrack === 'ALL'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-semibold shadow-sm'
                : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
            }`}
          >
            All Tracks ({projects.length})
          </button>
          {tracks.map((t) => (
            <button
              key={t}
              onClick={() => setSelectedTrack(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                selectedTrack === t
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-950 font-semibold shadow-sm'
                  : 'bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-800'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Projects Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-64 rounded-xl bg-slate-100 dark:bg-slate-900 animate-pulse border border-slate-200 dark:border-slate-800"></div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 glass-panel rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60">
          <Layers className="w-12 h-12 text-slate-400 dark:text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-300">No projects found</h3>
          <p className="text-slate-500 text-sm mt-1">Try adjusting your search query or track filter.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((project) => (
            <div
              key={project.id}
              onClick={() => setActiveProject(project)}
              className="glass-panel glass-panel-hover rounded-xl p-5 border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 flex flex-col justify-between cursor-pointer group shadow-sm hover:shadow-md"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                      {project.sourceId || 'PRJ'}
                    </span>
                    {(project.sourceType === 'FIXTURE' || (project.sourceId && project.sourceId.startsWith('prj_'))) && (
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-full font-medium">
                        Sample fixture
                      </span>
                    )}
                  </div>
                  {project.trackName && (
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-500/20">
                      {project.trackName}
                    </span>
                  )}
                </div>

                <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors line-clamp-1 mb-1">
                  {project.title}
                </h3>
                <p className="text-slate-600 dark:text-slate-400 text-xs line-clamp-3 mb-4 leading-relaxed">
                  {project.summary || project.description || 'No summary provided.'}
                </p>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-700 dark:text-slate-300 font-medium">{project.teamName || 'Independent'}</span>
                </div>
                <div className="flex items-center gap-3">
                  {project.repositoryUrl && (() => {
                    const repoLink = getProjectRepositoryLink(project);
                    return repoLink.isInternal ? (
                      <Link
                        to={repoLink.href}
                        onClick={(e) => e.stopPropagation()}
                        className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        title="Repository (Fixture Showcase)"
                      >
                        <Github className="w-4 h-4" />
                      </Link>
                    ) : (
                      <a
                        href={repoLink.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        title="Repository"
                      >
                        <Github className="w-4 h-4" />
                      </a>
                    );
                  })()}
                  {project.demoUrl && (() => {
                    const demoLink = getProjectDemoLink(project);
                    return demoLink.isInternal ? (
                      <Link
                        to={demoLink.href}
                        onClick={(e) => e.stopPropagation()}
                        className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        title="Interactive Demo Sandbox"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Link>
                    ) : (
                      <a
                        href={demoLink.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                        title="Demo URL"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                    );
                  })()}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Project Detail Modal */}
      {activeProject && createPortal(
        <div
          className="fixed inset-0 z-[100] bg-black/60 dark:bg-black/80 backdrop-blur-sm overflow-y-auto"
          onClick={() => setActiveProject(null)}
        >
          <div className="min-h-full flex items-center justify-center p-4">
            <div
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 my-8 max-h-[90vh] overflow-y-auto shadow-2xl relative animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setActiveProject(null)}
                className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 dark:hover:text-white p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                {activeProject.sourceId || 'PROJECT'}
              </span>
              {(activeProject.sourceType === 'FIXTURE' || (activeProject.sourceId && activeProject.sourceId.startsWith('prj_'))) && (
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                  Sample fixture project
                </span>
              )}
              {activeProject.trackName && (
                <span className="text-xs font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-800 dark:text-emerald-400 border border-emerald-500/20">
                  {activeProject.trackName}
                </span>
              )}
            </div>

            <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">{activeProject.title}</h2>
            {activeProject.tagline && (
              <p className="text-sm text-emerald-700 dark:text-emerald-400 font-medium mb-4">{activeProject.tagline}</p>
            )}

            <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4 mb-6">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Summary</h4>
              <p className="text-slate-700 dark:text-slate-200 text-sm leading-relaxed">{activeProject.summary}</p>
            </div>

            <div className="mb-6">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Description</h4>
              <p className="text-slate-600 dark:text-slate-300 text-sm leading-relaxed whitespace-pre-line">
                {activeProject.description || activeProject.summary}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-200 dark:border-slate-800 mb-6">
              <div>
                <span className="text-xs text-slate-500 block mb-1">Team</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-200">{activeProject.teamName || 'Solo'}</span>
              </div>
              <div>
                <span className="text-xs text-slate-500 block mb-1">Submitted At</span>
                <span className="text-sm text-slate-600 dark:text-slate-300">
                  {activeProject.submittedAt ? new Date(activeProject.submittedAt).toLocaleString() : 'N/A'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 flex-wrap">
              {activeProject.repositoryUrl && (() => {
                const repoLink = getProjectRepositoryLink(activeProject);
                return repoLink.isInternal ? (
                  <Link
                    to={repoLink.href}
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors border border-slate-200 dark:border-slate-700"
                  >
                    <Github className="w-4 h-4" />
                    <span>View Repository (Fixture Showcase)</span>
                  </Link>
                ) : (
                  <a
                    href={repoLink.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-medium flex items-center gap-2 transition-colors border border-slate-200 dark:border-slate-700"
                  >
                    <Github className="w-4 h-4" />
                    <span>Repository</span>
                  </a>
                );
              })()}
              {activeProject.demoUrl && (() => {
                const demoLink = getProjectDemoLink(activeProject);
                return demoLink.isInternal ? (
                  <Link
                    to={demoLink.href}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors shadow-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>Open Live Demo Sandbox</span>
                  </Link>
                ) : (
                  <a
                    href={demoLink.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-semibold text-xs sm:text-sm flex items-center gap-2 transition-colors shadow-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>View Live Demo</span>
                  </a>
                );
              })()}
            </div>
          </div>
        </div>
      </div>,
      document.body
    )}
  </div>
);
};
