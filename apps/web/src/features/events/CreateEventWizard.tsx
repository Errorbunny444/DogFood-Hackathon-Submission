import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiRequest } from '../../api/client.js';
import { useAuth } from '../../context/AuthContext.js';
import {
  Calendar,
  Layers,
  Award,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Plus,
  Trash2,
  Sparkles,
  Sliders,
  HelpCircle,
  AlertCircle,
  Building2,
  Globe,
  Clock,
  ShieldCheck,
} from 'lucide-react';

interface TrackItem {
  name: string;
  description: string;
}

interface PrizeItem {
  name: string;
  description: string;
  amount: string;
  trackIndex?: number;
}

interface CriterionItem {
  name: string;
  key: string;
  description: string;
  weight: number;
  minScore: number;
  maxScore: number;
}

interface QuestionItem {
  question: string;
  type: 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'BOOLEAN' | 'SELECT' | 'MULTISELECT' | 'URL';
  optionsString: string;
  required: boolean;
}

const WIZARD_STEPS = [
  { id: 1, label: 'Basic Info', desc: 'Name & Organization' },
  { id: 2, label: 'Timeline', desc: 'Deadlines & Schedule' },
  { id: 3, label: 'Tracks', desc: 'Themes & Challenges' },
  { id: 4, label: 'Prizes', desc: 'Awards & Bounties' },
  { id: 5, label: 'Rubric', desc: 'Weighted Criteria' },
  { id: 6, label: 'Questions', desc: 'Submission Requirements' },
  { id: 7, label: 'Review', desc: 'Verification & Launch' },
];

export const CreateEventWizard: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Organizations list for selector
  const [orgs, setOrgs] = useState<{ id: string; name: string; slug: string }[]>([]);

  // Step 1: Basics
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [organizationId, setOrganizationId] = useState('');

  // Step 2: Timeline (ISO local strings)
  const defaultDeadline = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 16);
  const [submissionDeadline, setSubmissionDeadline] = useState(defaultDeadline);
  const [registrationOpensAt, setRegistrationOpensAt] = useState('');
  const [registrationClosesAt, setRegistrationClosesAt] = useState('');
  const [eventStartsAt, setEventStartsAt] = useState('');
  const [eventEndsAt, setEventEndsAt] = useState('');
  const [judgingStartsAt, setJudgingStartsAt] = useState('');
  const [judgingEndsAt, setJudgingEndsAt] = useState('');
  const [resultsPublishAt, setResultsPublishAt] = useState('');
  const [communityVotingEnabled, setCommunityVotingEnabled] = useState(true);
  const [commentsEnabled, setCommentsEnabled] = useState(true);

  // Step 3: Tracks
  const [tracks, setTracks] = useState<TrackItem[]>([
    { name: 'Core Infrastructure', description: 'Agent architectures and runtime systems' },
    { name: 'Developer Tooling', description: 'IDEs, benchmarking, debugging' },
  ]);

  // Step 4: Prizes
  const [prizes, setPrizes] = useState<PrizeItem[]>([
    { name: 'Grand Prize', amount: '$10,000', description: 'Best overall submission' },
    { name: 'Best Infrastructure', amount: '$5,000', description: 'Top infrastructure project', trackIndex: 0 },
  ]);

  // Step 5: Rubric & Criteria
  const [rubricName, setRubricName] = useState('Standard Evaluation Rubric');
  const [rubricDesc, setRubricDesc] = useState('Comprehensive weighted judging criteria');
  const [criteria, setCriteria] = useState<CriterionItem[]>([
    { name: 'Technical Depth', key: 'technical_depth', description: 'Code architecture, completeness, engineering quality', weight: 0.4, minScore: 1, maxScore: 5 },
    { name: 'Practical Usability', key: 'practical_usability', description: 'Real-world developer ergonomics and usability', weight: 0.3, minScore: 1, maxScore: 5 },
    { name: 'Innovation & Polish', key: 'innovation', description: 'Originality, UI polish, documentation', weight: 0.3, minScore: 1, maxScore: 5 },
  ]);

  // Step 6: Submission Questions
  const [questions, setQuestions] = useState<QuestionItem[]>([
    { question: 'Architecture Overview', type: 'TEXTAREA', optionsString: '', required: true },
    { question: 'Open Source License', type: 'SELECT', optionsString: 'MIT, Apache-2.0, GPLv3', required: false },
  ]);

  useEffect(() => {
    // Fetch organizations
    apiRequest<{ organizations: any[] }>('/organizations')
      .then((res) => {
        setOrgs(res.organizations || []);
        if (res.organizations?.length > 0 && !organizationId) {
          setOrganizationId(res.organizations[0].id);
        }
      })
      .catch(console.error);
  }, []);

  const handleNameChange = (val: string) => {
    setName(val);
    const generated = val
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 50);
    setSlug(generated);
  };

  // Live Criteria Weight Calculation
  const totalWeight = criteria.reduce((sum, c) => sum + Number(c.weight || 0), 0);
  const isWeightValid = Math.abs(totalWeight - 1.0) < 0.001;

  // Track manipulation
  const addTrack = () => setTracks([...tracks, { name: '', description: '' }]);
  const removeTrack = (index: number) => setTracks(tracks.filter((_, i) => i !== index));

  // Prize manipulation
  const addPrize = () => setPrizes([...prizes, { name: '', amount: '', description: '' }]);
  const removePrize = (index: number) => setPrizes(prizes.filter((_, i) => i !== index));

  // Criteria manipulation
  const addCriterion = () =>
    setCriteria([
      ...criteria,
      { name: '', key: '', description: '', weight: 0.1, minScore: 1, maxScore: 5 },
    ]);
  const removeCriterion = (index: number) => setCriteria(criteria.filter((_, i) => i !== index));

  // Question manipulation
  const addQuestion = () =>
    setQuestions([...questions, { question: '', type: 'TEXT', optionsString: '', required: false }]);
  const removeQuestion = (index: number) => setQuestions(questions.filter((_, i) => i !== index));

  const handleLaunch = async (initialStatus: 'DRAFT' | 'PUBLISHED') => {
    setError(null);
    setLoading(true);

    try {
      const payload = {
        name: name.trim(),
        slug: slug.trim(),
        description: description.trim(),
        timezone,
        organizationId: organizationId || undefined,
        registrationOpensAt: registrationOpensAt ? new Date(registrationOpensAt).toISOString() : null,
        registrationClosesAt: registrationClosesAt ? new Date(registrationClosesAt).toISOString() : null,
        eventStartsAt: eventStartsAt ? new Date(eventStartsAt).toISOString() : null,
        eventEndsAt: eventEndsAt ? new Date(eventEndsAt).toISOString() : null,
        submissionDeadline: new Date(submissionDeadline).toISOString(),
        judgingStartsAt: judgingStartsAt ? new Date(judgingStartsAt).toISOString() : null,
        judgingEndsAt: judgingEndsAt ? new Date(judgingEndsAt).toISOString() : null,
        resultsPublishAt: resultsPublishAt ? new Date(resultsPublishAt).toISOString() : null,
        communityVotingEnabled,
        commentsEnabled,
        initialStatus,
        tracks: tracks.filter((t) => t.name.trim().length > 0),
        prizes: prizes.filter((p) => p.name.trim().length > 0).map((p) => ({
          name: p.name,
          description: p.description,
          amount: p.amount || undefined,
          trackIndex: p.trackIndex,
        })),
        rubric: {
          name: rubricName.trim(),
          description: rubricDesc.trim(),
          criteria: criteria.map((c) => ({
            name: c.name.trim(),
            key: c.key || c.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
            description: c.description,
            weight: Number(c.weight),
            minScore: Number(c.minScore),
            maxScore: Number(c.maxScore),
          })),
        },
        submissionQuestions: questions.filter((q) => q.question.trim().length > 0).map((q) => ({
          question: q.question.trim(),
          type: q.type,
          required: q.required,
          options: q.optionsString
            ? q.optionsString.split(',').map((s) => s.trim()).filter(Boolean)
            : undefined,
        })),
      };

      const res = await apiRequest<{ event: any }>('/events/wizard', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      alert(`Hackathon '${res.event.name}' successfully created!`);
      navigate(`/organizer`);
    } catch (err: any) {
      setError(err.message || 'Failed to create event.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      {/* Wizard Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-brand-400 font-semibold text-xs tracking-wider uppercase mb-1">
          <Calendar className="w-4 h-4" />
          <span>Hackathon Launch Wizard</span>
        </div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Create New Hackathon</h1>
        <p className="text-slate-400 text-sm mt-1">
          Set up evaluation rubrics, server-enforced deadlines, judging criteria, and tracks.
        </p>
      </div>

      {/* Stepper Navigation */}
      <div className="mb-8 overflow-x-auto pb-2">
        <div className="flex items-center gap-2 min-w-[650px]">
          {WIZARD_STEPS.map((s) => (
            <button
              key={s.id}
              onClick={() => setCurrentStep(s.id)}
              className={`flex-1 p-3 rounded-xl border text-left transition ${
                currentStep === s.id
                  ? 'bg-slate-900 border-brand-500 text-white shadow-lg shadow-brand-500/10'
                  : currentStep > s.id
                  ? 'bg-slate-950 border-emerald-800/40 text-emerald-400'
                  : 'bg-slate-950/60 border-slate-800 text-slate-500'
              }`}
            >
              <div className="text-[10px] font-bold uppercase tracking-wider">
                Step {s.id}
              </div>
              <div className="text-xs font-bold truncate mt-0.5">{s.label}</div>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-800/50 flex items-start gap-3 text-xs text-red-300">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <div className="font-bold text-red-200">Validation Error</div>
            <div>{error}</div>
          </div>
        </div>
      )}

      {/* STEP 1: Basic Information */}
      {currentStep === 1 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <h2 className="text-lg font-bold text-white mb-4">Step 1: Event Identity</h2>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Event Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Autonomous Agents Hackathon 2026"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Event URL Slug <span className="text-red-400">*</span>
            </label>
            <div className="flex items-center bg-slate-950 border border-slate-700 rounded-xl px-4 py-2 text-sm text-slate-400 focus-within:border-brand-500">
              <span className="text-xs text-slate-500 select-none mr-1">/events/</span>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                className="w-full bg-transparent text-white focus:outline-none font-mono text-xs"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Host Organization
            </label>
            <select
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
            >
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name} (/o/{o.slug})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Overview & Mission
            </label>
            <textarea
              rows={4}
              placeholder="Describe the challenge goals, target participants, and technology stack..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-sm text-white focus:outline-none focus:border-brand-500"
            />
          </div>
        </div>
      )}

      {/* STEP 2: Timeline */}
      {currentStep === 2 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <h2 className="text-lg font-bold text-white mb-4">Step 2: Server-Enforced Deadlines</h2>

          <div className="p-4 rounded-xl bg-amber-950/20 border border-amber-800/40 text-xs text-amber-300 flex items-start gap-2.5">
            <Clock className="w-5 h-5 shrink-0 text-amber-400 mt-0.5" />
            <div>
              <strong className="block font-semibold text-amber-200 mb-0.5">Strict Deadline Guarantee:</strong>
              Submissions received after the submission deadline will be automatically rejected with HTTP 409 Conflict.
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Submission Deadline <span className="text-red-400">*</span>
              </label>
              <input
                type="datetime-local"
                required
                value={submissionDeadline}
                onChange={(e) => setSubmissionDeadline(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Judging Begins
              </label>
              <input
                type="datetime-local"
                value={judgingStartsAt}
                onChange={(e) => setJudgingStartsAt(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500 font-mono"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 space-y-3">
            <label className="flex items-center gap-3 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={communityVotingEnabled}
                onChange={(e) => setCommunityVotingEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-brand-500 bg-slate-950 border-slate-700"
              />
              <span>Enable Community Voting & Public Ballots</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={commentsEnabled}
                onChange={(e) => setCommentsEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-brand-500 bg-slate-950 border-slate-700"
              />
              <span>Enable Public Project Discussion & Peer Feedback</span>
            </label>
          </div>
        </div>
      )}

      {/* STEP 3: Tracks */}
      {currentStep === 3 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white">Step 3: Hackathon Tracks</h2>
              <p className="text-xs text-slate-400">
                Organize submissions into domain-specific categories.
              </p>
            </div>
            <button
              onClick={addTrack}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-brand-400 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Track</span>
            </button>
          </div>

          <div className="space-y-4">
            {tracks.map((t, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex gap-4 items-start">
                <div className="flex-1 space-y-3">
                  <input
                    type="text"
                    placeholder="Track Title (e.g. AI Agents, Fintech)"
                    value={t.name}
                    onChange={(e) => {
                      const updated = [...tracks];
                      updated[idx].name = e.target.value;
                      setTracks(updated);
                    }}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500 font-semibold"
                  />
                  <input
                    type="text"
                    placeholder="Track criteria and guidelines..."
                    value={t.description}
                    onChange={(e) => {
                      const updated = [...tracks];
                      updated[idx].description = e.target.value;
                      setTracks(updated);
                    }}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-brand-500"
                  />
                </div>
                <button
                  onClick={() => removeTrack(idx)}
                  className="p-2 text-slate-500 hover:text-red-400 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 4: Prizes */}
      {currentStep === 4 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white">Step 4: Prizes & Bounties</h2>
              <p className="text-xs text-slate-400">Define the awards for overall and track winners.</p>
            </div>
            <button
              onClick={addPrize}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-brand-400 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Prize</span>
            </button>
          </div>

          <div className="space-y-4">
            {prizes.map((p, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex gap-4 items-start">
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input
                    type="text"
                    placeholder="Prize Title (e.g. 1st Place)"
                    value={p.name}
                    onChange={(e) => {
                      const updated = [...prizes];
                      updated[idx].name = e.target.value;
                      setPrizes(updated);
                    }}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500 font-semibold"
                  />
                  <input
                    type="text"
                    placeholder="Amount / Perks (e.g. $10,000)"
                    value={p.amount}
                    onChange={(e) => {
                      const updated = [...prizes];
                      updated[idx].amount = e.target.value;
                      setPrizes(updated);
                    }}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-emerald-400 focus:outline-none focus:border-brand-500 font-mono"
                  />
                  <select
                    value={p.trackIndex !== undefined ? p.trackIndex : ''}
                    onChange={(e) => {
                      const updated = [...prizes];
                      updated[idx].trackIndex = e.target.value === '' ? undefined : Number(e.target.value);
                      setPrizes(updated);
                    }}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-brand-500"
                  >
                    <option value="">Overall (All Tracks)</option>
                    {tracks.map((t, tIdx) => (
                      <option key={tIdx} value={tIdx}>
                        {t.name || `Track ${tIdx + 1}`}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={() => removePrize(idx)}
                  className="p-2 text-slate-500 hover:text-red-400 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 5: Rubric & Criteria */}
      {currentStep === 5 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white">Step 5: Weighted Judging Rubric</h2>
              <p className="text-xs text-slate-400">
                Criteria weights determine the final composite score used by the normalization engine.
              </p>
            </div>

            {/* Total Weight Status Indicator */}
            <div
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 ${
                isWeightValid
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
              }`}
            >
              <span>Total Weight: {(totalWeight * 100).toFixed(0)}%</span>
              {isWeightValid ? (
                <CheckCircle2 className="w-4 h-4" />
              ) : (
                <AlertCircle className="w-4 h-4" />
              )}
            </div>
          </div>

          <div className="space-y-4">
            {criteria.map((c, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex gap-4 items-start">
                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="text"
                      placeholder="Criterion Name (e.g. Technical Depth)"
                      value={c.name}
                      onChange={(e) => {
                        const updated = [...criteria];
                        updated[idx].name = e.target.value;
                        setCriteria(updated);
                      }}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500 font-semibold"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 shrink-0">Weight:</span>
                      <input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        value={c.weight}
                        onChange={(e) => {
                          const updated = [...criteria];
                          updated[idx].weight = Number(e.target.value);
                          setCriteria(updated);
                        }}
                        className="w-24 px-2 py-1 bg-slate-900 border border-slate-700 rounded-lg text-xs text-brand-400 font-mono font-bold focus:outline-none"
                      />
                      <span className="text-xs text-slate-500">
                        ({(c.weight * 100).toFixed(0)}%)
                      </span>
                    </div>
                  </div>

                  <input
                    type="text"
                    placeholder="Description / Guide for judges..."
                    value={c.description}
                    onChange={(e) => {
                      const updated = [...criteria];
                      updated[idx].description = e.target.value;
                      setCriteria(updated);
                    }}
                    className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-brand-500"
                  />
                </div>

                <button
                  onClick={() => removeCriterion(idx)}
                  className="p-2 text-slate-500 hover:text-red-400 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button
            onClick={addCriterion}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-brand-400 text-xs font-semibold flex items-center gap-1.5 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Criterion</span>
          </button>
        </div>
      )}

      {/* STEP 6: Submission Questions */}
      {currentStep === 6 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-white">Step 6: Custom Submission Questions</h2>
              <p className="text-xs text-slate-400">
                Collect structured metadata from participants upon submission.
              </p>
            </div>
            <button
              onClick={addQuestion}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-brand-400 text-xs font-semibold flex items-center gap-1.5 transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Field</span>
            </button>
          </div>

          <div className="space-y-4">
            {questions.map((q, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-slate-950 border border-slate-800 flex gap-4 items-start">
                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <input
                      type="text"
                      placeholder="Question prompt..."
                      value={q.question}
                      onChange={(e) => {
                        const updated = [...questions];
                        updated[idx].question = e.target.value;
                        setQuestions(updated);
                      }}
                      className="w-full sm:col-span-2 px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm text-white focus:outline-none focus:border-brand-500"
                    />

                    <select
                      value={q.type}
                      onChange={(e) => {
                        const updated = [...questions];
                        updated[idx].type = e.target.value as any;
                        setQuestions(updated);
                      }}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-brand-500"
                    >
                      <option value="TEXT">Short Text</option>
                      <option value="TEXTAREA">Paragraph Text</option>
                      <option value="URL">URL / Link</option>
                      <option value="SELECT">Single Select</option>
                      <option value="BOOLEAN">Yes / No Toggle</option>
                    </select>
                  </div>

                  {q.type === 'SELECT' && (
                    <input
                      type="text"
                      placeholder="Comma-separated options: Option A, Option B, Option C"
                      value={q.optionsString}
                      onChange={(e) => {
                        const updated = [...questions];
                        updated[idx].optionsString = e.target.value;
                        setQuestions(updated);
                      }}
                      className="w-full px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-xs text-slate-300 focus:outline-none focus:border-brand-500"
                    />
                  )}

                  <label className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={q.required}
                      onChange={(e) => {
                        const updated = [...questions];
                        updated[idx].required = e.target.checked;
                        setQuestions(updated);
                      }}
                      className="rounded bg-slate-900 border-slate-700 text-brand-500"
                    />
                    <span>Required response</span>
                  </label>
                </div>

                <button
                  onClick={() => removeQuestion(idx)}
                  className="p-2 text-slate-500 hover:text-red-400 rounded-lg transition"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* STEP 7: Review & Launch */}
      {currentStep === 7 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <h2 className="text-xl font-bold text-white mb-2">Step 7: Launch Verification</h2>
          <p className="text-xs text-slate-400">
            Review the configured hackathon settings. Choose whether to publish live or save as a draft.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-xs text-slate-500">Event Title & Slug</div>
              <div className="text-base font-bold text-white mt-1">{name || 'Untitled'}</div>
              <div className="text-xs font-mono text-brand-400">/events/{slug}</div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-xs text-slate-500">Server-Enforced Deadline</div>
              <div className="text-base font-bold text-white mt-1">
                {new Date(submissionDeadline).toLocaleString()}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-xs text-slate-500">Configured Tracks</div>
              <div className="text-base font-bold text-white mt-1">{tracks.length} Tracks</div>
              <div className="text-xs text-slate-400 truncate">
                {tracks.map((t) => t.name).join(', ')}
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800">
              <div className="text-xs text-slate-500">Evaluation Criteria</div>
              <div className="text-base font-bold text-white mt-1">
                {criteria.length} Criteria ({(totalWeight * 100).toFixed(0)}% weight)
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-slate-800 flex flex-wrap items-center justify-between gap-4">
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              className="px-4 py-2.5 rounded-xl border border-slate-700 text-xs text-slate-300 hover:bg-slate-800 transition"
            >
              Back to Questions
            </button>

            <div className="flex items-center gap-3">
              <button
                onClick={() => handleLaunch('DRAFT')}
                disabled={loading || !name.trim() || !slug.trim()}
                className="px-5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-xs transition disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Save as Draft'}
              </button>
              <button
                onClick={() => handleLaunch('PUBLISHED')}
                disabled={loading || !name.trim() || !slug.trim()}
                className="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs transition shadow-lg shadow-brand-500/20 disabled:opacity-50"
              >
                {loading ? 'Publishing...' : 'Launch & Publish Event'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Navigation Buttons */}
      {currentStep < 7 && (
        <div className="mt-8 flex items-center justify-between">
          <button
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className="px-5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold hover:bg-slate-800 transition flex items-center gap-2 disabled:opacity-40"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <button
            onClick={() => setCurrentStep(Math.min(7, currentStep + 1))}
            className="px-6 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-brand-500/20"
          >
            <span>Next: {WIZARD_STEPS[currentStep].label}</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
