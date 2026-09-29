import React from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Award,
  Layers,
  Sparkles,
  Building2,
  Calendar,
  Code2,
  Gavel,
  CheckCircle2,
  ArrowRight,
  Github,
  Server,
  Lock,
  Scale,
  FileCheck,
  UserCheck,
  Zap,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.js';

export const HomePage: React.FC = () => {
  const { appConfig } = useAuth();

  const organizerWorkflow = [
    {
      step: '01',
      title: 'Workspace Setup',
      subtitle: 'Organization & Team Roles',
      description:
        'Create a dedicated workspace for your university club, company, or developer community. Invite co-organizers with granular Owner, Admin, and Member permissions.',
    },
    {
      step: '02',
      title: '10-Step Event Wizard',
      subtitle: 'Rubrics, Tracks & Deadlines',
      description:
        'Configure submission deadlines, eligibility rules, challenge tracks, prize allocations, custom intake questions, and multi-criteria weighted rubrics.',
    },
    {
      step: '03',
      title: 'Submissions & Judging',
      subtitle: 'Blind Review & Conflict Isolation',
      description:
        'Participants register teams and submit rich media with validated URLs. Assign domain-expert judges with strict conflict-of-interest isolation and zero peer score leakage.',
    },
    {
      step: '04',
      title: 'Calibrate & Publish',
      subtitle: 'Bayesian Normalization & Integrity',
      description:
        'Run statistical mean-shrinkage normalization to eliminate judge bias. Review constant scorers and disagreement outliers before approving official public leaderboard publication.',
    },
  ];

  const pillars = [
    {
      icon: Calendar,
      title: 'Run Hackathons',
      description:
        'Multi-tenant organizations, flexible registration, custom tracks, and backend-enforced lifecycle states from draft to publication.',
      badge: 'Multi-Tenant',
    },
    {
      icon: Code2,
      title: 'Collect Projects',
      description:
        'Participant portals, solo or team registrations, rich media uploads, validated repository links, and live-demo reachability checks.',
      badge: 'Submissions',
    },
    {
      icon: Gavel,
      title: 'Assign Judges',
      description:
        'Conflict-of-interest isolation, randomized review distribution, blind review options, and zero cross-judge score leakage.',
      badge: 'Isolation',
    },
    {
      icon: Scale,
      title: 'Calibrate Scoring',
      description:
        'Multi-criteria rubrics with statistical normalization (mean-shrinkage) to eliminate harsh and lenient judge bias deterministically.',
      badge: 'Normalization',
    },
    {
      icon: ShieldCheck,
      title: 'Audit Results',
      description:
        'Append-oriented audit trails, constant-scorer detection, rank-shift explanations, and complete mathematical reproducibility.',
      badge: 'Integrity Center',
    },
    {
      icon: Award,
      title: 'Publish Winners',
      description:
        'Organizer review gate before reveal, tamper-proof leaderboards, public community voting, and verified CSV/JSON archive exports.',
      badge: 'Leaderboard',
    },
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 transition-colors">
      {/* Hero Section */}
      <div className="relative rounded-3xl overflow-hidden glass-panel p-8 sm:p-12 mb-12 border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/80 shadow-sm dark:shadow-2xl">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-400 text-xs font-semibold mb-6">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Industrial-Grade Hackathon Infrastructure</span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight mb-4">
            Auditable, Open-Source <br className="hidden sm:inline" />
            <span className="text-emerald-700 dark:text-emerald-400">
              Hackathon Management
            </span>
          </h1>

          <p className="text-slate-600 dark:text-slate-300 text-base sm:text-lg leading-relaxed mb-8 max-w-2xl">
            From university clubs to global tech summits. Collect project submissions, enforce strict judge isolation, calibrate scores with statistical normalization, and defend every winner with transparent audit trails.
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-3.5">
            <Link
              to="/events/new"
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 font-semibold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-sm hover:scale-[1.01]"
            >
              <span>Create an Event</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              to="/organizations"
              className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium text-xs sm:text-sm flex items-center gap-2 transition-colors border border-slate-200 dark:border-slate-700"
            >
              <Building2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Create Organization</span>
            </Link>

            <Link
              to="/gallery"
              className="px-4 py-2.5 rounded-xl bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-300 font-medium text-xs sm:text-sm flex items-center gap-2 transition-colors border border-slate-200 dark:border-slate-800"
            >
              <Layers className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span>{appConfig.demoEnabled ? 'Explore Demo Showcase' : 'Explore Submissions'}</span>
            </Link>

            <a
              href="https://github.com/dogfood-hackathon/dogfood"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3.5 py-2.5 rounded-xl text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white font-medium text-xs sm:text-sm flex items-center gap-1.5 transition-colors"
              title="GitHub Repository"
            >
              <Github className="w-4 h-4" />
              <span>GitHub</span>
            </a>
          </div>
        </div>

        {/* Operating Mode Status Pill */}
        <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 font-mono">
              <span className={`w-2 h-2 rounded-full ${appConfig.appMode === 'demo' ? 'bg-amber-500' : 'bg-emerald-500'}`}></span>
              Active Mode: <strong className="text-slate-800 dark:text-slate-200 uppercase">{appConfig.appMode}</strong>
            </span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> PostgreSQL & Fastify Monolith
            </span>
            <span className="text-slate-300 dark:text-slate-700">|</span>
            <span className="flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-500 dark:text-slate-400" /> Argon2id & RFC 6238 MFA
            </span>
          </div>

          <div className="font-mono text-slate-400 dark:text-slate-500">
            Zero cloud lock-in &bull; Fully self-hostable
          </div>
        </div>
      </div>

      {/* Built for Organizers: End-to-End Platform Experience */}
      <div className="mb-14">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 mb-2">
            <Zap className="w-3.5 h-3.5" />
            <span>Complete Organizer Operating System</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Run Every Stage of Your Hackathon on One Platform
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-2">
            Eliminate chaotic spreadsheets, fragmented forms, and judging disputes. Everything an organizer needs is fully integrated directly on the website.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {organizerWorkflow.map((item) => (
            <div
              key={item.step}
              className="glass-panel rounded-2xl p-6 border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 flex flex-col justify-between"
            >
              <div>
                <span className="text-2xl font-black text-slate-300 dark:text-slate-700 font-mono block mb-2">
                  {item.step}
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1">
                  {item.title}
                </h3>
                <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400 mb-2.5">
                  {item.subtitle}
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {item.description}
                </p>
              </div>

              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-mono">
                <span>Integrated Tool</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Product Pillars Grid */}
      <div className="mb-14">
        <div className="text-center max-w-2xl mx-auto mb-10">
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
            Engineered for Fair, Auditable Competitions
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-2">
            Every feature is architected for transparent scoring, strong tenant isolation, and verifiable outcome provenance.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pillars.map((pillar) => {
            const Icon = pillar.icon;
            return (
              <div
                key={pillar.title}
                className="glass-panel glass-panel-hover rounded-2xl p-6 border border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/60 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-700 dark:text-slate-300">
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                      {pillar.badge}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">{pillar.title}</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm leading-relaxed">{pillar.description}</p>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center text-xs text-emerald-700 dark:text-emerald-400 font-medium">
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  <span>Production Ready</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Deployment & Architecture Banner */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white/60 dark:bg-slate-900/60 p-8 flex flex-col lg:flex-row items-center justify-between gap-8 shadow-sm">
        <div>
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-2">
            <Server className="w-4 h-4" />
            <span>Self-Hosting or Cloud SaaS</span>
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Deploy Anywhere with Docker Compose</h3>
          <p className="text-slate-600 dark:text-slate-400 text-sm max-w-xl leading-relaxed">
            Run a complete instance on a single $10/mo VPS with Caddy and local storage, or scale to managed PostgreSQL and S3-compatible cloud storage with no code modifications.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <Link
            to="/gallery"
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs sm:text-sm font-semibold border border-slate-200 dark:border-slate-700 transition-colors"
          >
            Showcase
          </Link>
          <Link
            to="/events/new"
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white dark:bg-white dark:hover:bg-slate-100 dark:text-slate-950 text-xs sm:text-sm font-bold transition-colors shadow-sm"
          >
            Launch Hackathon
          </Link>
        </div>
      </div>
    </div>
  );
};
