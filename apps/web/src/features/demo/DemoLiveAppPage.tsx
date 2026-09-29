import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Github,
  Activity,
  Cpu,
  Layers,
  Sparkles,
  Zap,
  Play,
  RotateCw,
  CheckCircle2,
  Terminal,
} from 'lucide-react';
import { apiClient } from '../../api/client.js';

interface ProjectDetail {
  id: string;
  sourceId: string | null;
  sourceType: string;
  title: string;
  tagline: string | null;
  summary: string | null;
}

export const DemoLiveAppPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [pingCount, setPingCount] = useState<number>(42);
  const [latency, setLatency] = useState<number>(14);
  const [logs, setLogs] = useState<string[]>([
    'System initialized in sandbox execution mode.',
    'Connected to local telemetry collector.',
    'Cluster health: 100% operational.',
  ]);

  const { data: project, isLoading } = useQuery<ProjectDetail>({
    queryKey: ['project-demo-live', id],
    queryFn: () => apiClient.get<ProjectDetail>(`/projects/${id}`),
    enabled: !!id,
  });

  const handleSimulateAction = () => {
    const newPing = pingCount + 1;
    const newLatency = Math.floor(10 + Math.random() * 15);
    setPingCount(newPing);
    setLatency(newLatency);
    const timeStr = new Date().toLocaleTimeString();
    setLogs((prev) => [
      `[${timeStr}] Simulated workload dispatch #` + newPing + ` completed in ${newLatency}ms.`,
      ...prev.slice(0, 7),
    ]);
  };

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center text-slate-400">
        Starting interactive demo sandbox...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">Project Not Found</h2>
        <Link to="/" className="text-brand-400 hover:underline">
          Return to Gallery
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Sandbox Notice Banner */}
      <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between text-xs text-purple-200">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
          <span>
            <strong>Interactive Demo Sandbox:</strong> Live simulation of project features without external placeholder redirects.
          </span>
        </div>
        <Link
          to={`/demo/projects/${project.id}/repository`}
          className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors flex items-center gap-1 shrink-0"
        >
          <Github className="w-3.5 h-3.5" />
          <span>View Source Code</span>
        </Link>
      </div>

      {/* App Header */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:text-white text-slate-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-brand-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-brand-500/20">
            <Zap className="w-6 h-6 text-slate-950 font-bold" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-white tracking-tight">{project.title}</h1>
              <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-mono font-semibold">
                LIVE SANDBOX
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{project.tagline}</p>
          </div>
        </div>

        <button
          onClick={handleSimulateAction}
          className="px-4 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-slate-950 font-bold text-xs transition-colors flex items-center gap-2 shadow-sm self-start sm:self-auto"
        >
          <Play className="w-3.5 h-3.5" />
          <span>Execute Simulation Ping</span>
        </button>
      </div>

      {/* Simulated Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-brand-400" />
            <span>Telemetry Dispatches</span>
          </div>
          <div className="text-2xl font-black font-mono text-white">{pingCount}</div>
          <div className="text-[10px] text-emerald-400 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> System optimal
          </div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-blue-400" />
            <span>Response Latency</span>
          </div>
          <div className="text-2xl font-black font-mono text-white">{latency} ms</div>
          <div className="text-[10px] text-slate-400">p99 &lt; 25ms threshold</div>
        </div>

        <div className="glass-panel p-4 rounded-xl border border-slate-800 space-y-1">
          <div className="text-xs text-slate-400 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>Target Pipeline</span>
          </div>
          <div className="text-lg font-bold font-mono text-slate-200 mt-1">Autonomous Agent</div>
          <div className="text-[10px] text-slate-500">Deterministic verification active</div>
        </div>
      </div>

      {/* Live Terminal Output */}
      <div className="glass-panel rounded-xl border border-slate-800 overflow-hidden space-y-0">
        <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-brand-400" />
            <span className="text-white font-semibold">Live Sandbox Console</span>
          </div>
          <button
            onClick={() => setLogs([])}
            className="text-[11px] text-slate-500 hover:text-white flex items-center gap-1"
          >
            <RotateCw className="w-3 h-3" /> Clear
          </button>
        </div>
        <div className="p-4 bg-slate-950 font-mono text-xs text-slate-300 space-y-1 min-h-[140px]">
          {logs.map((log, index) => (
            <div key={index} className="text-slate-400">
              <span className="text-brand-400 font-bold">&gt;</span> {log}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
