import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Navbar } from './components/layout/Navbar.js';
import { HomePage } from './features/home/HomePage.js';
import { GalleryPage } from './features/gallery/GalleryPage.js';
import { ResultsPage } from './features/results/ResultsPage.js';
import { VotingPage } from './features/voting/VotingPage.js';
import { ParticipantDashboard } from './features/participant/ParticipantDashboard.js';
import { JudgeDashboard } from './features/judge/JudgeDashboard.js';
import { OrganizerDashboard } from './features/organizer/OrganizerDashboard.js';
import { DemoRepositoryPage } from './features/demo/DemoRepositoryPage.js';
import { DemoLiveAppPage } from './features/demo/DemoLiveAppPage.js';
import { OrganizationsDirectoryPage } from './features/organizations/OrganizationsDirectoryPage.js';
import { OrganizationPage } from './features/organizations/OrganizationPage.js';
import { CreateEventWizard } from './features/events/CreateEventWizard.js';
import { ShieldCheck, Heart, Terminal, Database } from 'lucide-react';

export const App: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-brand-500 selection:text-slate-950 transition-colors duration-200">
      <Navbar />

      <main className="flex-1 pb-16">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/projects" element={<GalleryPage />} />
          <Route path="/results" element={<ResultsPage />} />
          <Route path="/voting" element={<VotingPage />} />
          <Route path="/participant" element={<ParticipantDashboard />} />
          <Route path="/judge" element={<JudgeDashboard />} />
          <Route path="/organizer" element={<OrganizerDashboard />} />
          <Route path="/events/new" element={<CreateEventWizard />} />
          <Route path="/organizations" element={<OrganizationsDirectoryPage />} />
          <Route path="/organizations/:slug" element={<OrganizationPage />} />
          <Route path="/o/:slug" element={<OrganizationPage />} />
          <Route path="/demo/projects/:id/repository" element={<DemoRepositoryPage />} />
          <Route path="/demo/projects/:id/live-demo" element={<DemoLiveAppPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800/80 bg-white/90 dark:bg-slate-950/90 py-8 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 dark:text-slate-400 transition-colors">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-brand-400" />
            <span className="font-semibold text-slate-800 dark:text-slate-300">DOGFOOD 2026</span>
            <span>— Auditable Hackathon Judging Platform</span>
          </div>

          <div className="flex items-center gap-4 text-slate-600 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" /> Self-Hosted Relational Store
            </span>
            <span className="flex items-center gap-1.5">
              <Terminal className="w-3.5 h-3.5 text-emerald-600 dark:text-brand-400" /> Fastify REST /api/v1
            </span>
          </div>

          <div className="text-slate-500 dark:text-slate-400">
            Every result explained, audited, reproduced, and defended.
          </div>
        </div>
      </footer>
    </div>
  );
};
