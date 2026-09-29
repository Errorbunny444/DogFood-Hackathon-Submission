import React from 'react';
import { Sun, Moon, Laptop } from 'lucide-react';
import { useTheme, Theme } from '../../context/ThemeContext.js';

export const ThemeToggle: React.FC = () => {
  const { theme, resolvedTheme, setTheme } = useTheme();

  return (
    <div className="flex items-center rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-100/80 dark:bg-slate-900 p-0.5 text-slate-500 dark:text-slate-400">
      <button
        type="button"
        onClick={() => setTheme('light')}
        className={`p-1.5 rounded-md transition-all ${
          theme === 'light'
            ? 'bg-white dark:bg-slate-800 text-amber-500 shadow-sm'
            : 'hover:text-slate-900 dark:hover:text-white'
        }`}
        title="Light Mode"
      >
        <Sun className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={() => setTheme('dark')}
        className={`p-1.5 rounded-md transition-all ${
          theme === 'dark'
            ? 'bg-white dark:bg-slate-800 text-sky-400 shadow-sm'
            : 'hover:text-slate-900 dark:hover:text-white'
        }`}
        title="Dark Mode"
      >
        <Moon className="w-3.5 h-3.5" />
      </button>

      <button
        type="button"
        onClick={() => setTheme('system')}
        className={`p-1.5 rounded-md transition-all hidden sm:block ${
          theme === 'system'
            ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-200 shadow-sm'
            : 'hover:text-slate-900 dark:hover:text-white'
        }`}
        title="System Preference"
      >
        <Laptop className="w-3.5 h-3.5" />
      </button>
    </div>
  );
};
