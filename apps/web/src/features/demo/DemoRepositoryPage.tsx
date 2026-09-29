import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Github,
  FileCode,
  Folder,
  ArrowLeft,
  ExternalLink,
  ShieldCheck,
  GitBranch,
  Terminal,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { apiClient } from '../../api/client.js';

interface ProjectDetail {
  id: string;
  sourceId: string | null;
  sourceType: string;
  title: string;
  tagline: string | null;
  summary: string | null;
  description: string | null;
  repositoryUrl: string | null;
  demoUrl: string | null;
  trackName: string | null;
  teamName: string | null;
  submittedAt: string | null;
}

export const DemoRepositoryPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [selectedFile, setSelectedFile] = useState<string>('README.md');

  const { data: project, isLoading } = useQuery<ProjectDetail>({
    queryKey: ['project-demo-repo', id],
    queryFn: () => apiClient.get<ProjectDetail>(`/projects/${id}`),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center text-slate-400">
        Loading realistic project repository...
      </div>
    );
  }

  if (!project) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <h2 className="text-xl font-bold text-white">Project Not Found</h2>
        <Link to="/" className="text-brand-400 hover:underline">
          Return to Project Gallery
        </Link>
      </div>
    );
  }

  const slug = project.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

  const fileContents: Record<string, string> = {
    'README.md': `# ${project.title}\n\n> ${project.tagline || 'Hackathon submission'}\n\n## Overview\n${project.summary || 'Project overview and architecture details.'}\n\n## Architecture\n- **Backend**: TypeScript / Fastify modular service\n- **Algorithm**: Deterministic evaluation and telemetry pipeline\n- **Persistence**: Relational PostgreSQL schema\n\n## Getting Started\n\`\`\`bash\npnpm install\npnpm build\npnpm test\n\`\`\`\n\n## License\nMIT License`,
    'src/index.ts': `import { createServer } from './server';\n\nexport async function main() {\n  console.log('Starting ${project.title} telemetry engine...');\n  const app = createServer();\n  await app.listen({ port: 3000 });\n  console.log('Listening on port 3000');\n}\n\nmain();`,
    'src/server.ts': `export function createServer() {\n  return {\n    listen: async ({ port }: { port: number }) => {\n      console.log(\`[${slug}] Engine online on port \${port}\`);\n    }\n  };\n}`,
    'package.json': `{\n  "name": "@dogfood/${slug}",\n  "version": "1.0.0",\n  "private": true,\n  "scripts": {\n    "build": "tsc",\n    "test": "vitest run"\n  }\n}`,
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Banner explaining internal fixture showcase */}
      <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-between text-xs text-purple-200">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400 shrink-0" />
          <span>
            <strong>Internal Fixture Showcase:</strong> Synthetic fixture URLs are hosted internally so you can evaluate code structure without being redirected to synthetic placeholder domains.
          </span>
        </div>
        <Link
          to={`/demo/projects/${project.id}/live-demo`}
          className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors flex items-center gap-1 shrink-0"
        >
          <span>Open Live Demo</span>
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* Repo Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 hover:text-white text-slate-400 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
            <Github className="w-5 h-5 text-brand-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-mono text-sm">sample-hack /</span>
              <h1 className="text-lg font-bold text-white font-mono">{slug}</h1>
              <span className="text-[10px] bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full font-mono">
                Public
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{project.tagline}</p>
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 font-mono">
            <GitBranch className="w-3.5 h-3.5 text-brand-400" />
            <span>main</span>
          </div>
          <span className="text-slate-500 font-mono">ID: {project.sourceId || project.id.slice(0, 8)}</span>
        </div>
      </div>

      {/* File Browser Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {/* File Tree */}
        <div className="md:col-span-1 glass-panel rounded-xl border border-slate-800 p-3 space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 px-2 py-1">
            Repository Files
          </div>
          {Object.keys(fileContents).map((file) => {
            const isActive = selectedFile === file;
            return (
              <button
                key={file}
                onClick={() => setSelectedFile(file)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono flex items-center gap-2 transition-colors ${
                  isActive
                    ? 'bg-brand-500/10 text-brand-400 font-semibold border border-brand-500/20'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>{file}</span>
              </button>
            );
          })}
        </div>

        {/* Code / Markdown Viewer */}
        <div className="md:col-span-3 glass-panel rounded-xl border border-slate-800 overflow-hidden">
          <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between text-xs font-mono text-slate-400">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-brand-400" />
              <span className="text-white font-semibold">{selectedFile}</span>
            </div>
            <span className="text-[11px] text-slate-500">UTF-8 • Preview Mode</span>
          </div>

          <div className="p-4 bg-slate-950 font-mono text-xs text-slate-200 overflow-x-auto leading-relaxed">
            <pre className="whitespace-pre-wrap">{fileContents[selectedFile]}</pre>
          </div>
        </div>
      </div>
    </div>
  );
};
