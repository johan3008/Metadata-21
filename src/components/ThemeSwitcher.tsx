import React, { useState, useEffect } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      const isDark = theme === 'dark' || (theme === 'system' && mediaQuery.matches);
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    applyTheme();
    localStorage.setItem('theme', theme);

    // Listener for system preference changes
    const handler = () => {
      if (theme === 'system') applyTheme();
    };
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  const buttonClass = (t: 'light' | 'dark' | 'system') => 
    `p-2 rounded-full transition-colors ${theme === t ? 'bg-slate-200 dark:bg-slate-700' : 'hover:bg-slate-100 dark:hover:bg-slate-800'}`;

  return (
    <div className="fixed top-20 right-6 z-50 p-1 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm rounded-full shadow-lg border border-slate-200 dark:border-slate-700 flex items-center gap-1">
      <button 
        onClick={() => setTheme('light')} 
        className={`${buttonClass('light')} ${theme === 'light' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' : ''}`}
        title="Light Mode"
      >
        <Sun size={18} />
      </button>
      <button 
        onClick={() => setTheme('dark')} 
        className={`${buttonClass('dark')} ${theme === 'dark' ? 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600' : ''}`}
        title="Dark Mode"
      >
        <Moon size={18} />
      </button>
      <button 
        onClick={() => setTheme('system')} 
        className={`${buttonClass('system')} ${theme === 'system' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' : ''}`}
        title="System Preference"
      >
        <Monitor size={18} />
      </button>
    </div>
  );
}
