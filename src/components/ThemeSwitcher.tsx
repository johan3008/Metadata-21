import React, { useState, useEffect } from 'react';
import { Sun, Moon, Monitor } from 'lucide-react';

export default function ThemeSwitcher() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system';
    }
    return 'system';
  });

  useEffect(() => {
    const root = window.document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    
    // Function to apply the class
    const update = (t: 'light' | 'dark' | 'system') => {
      const isDark = t === 'dark' || (t === 'system' && mediaQuery.matches);
      if (isDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    update(theme);
    localStorage.setItem('theme', theme);

    // Listen to changes if 'system'
    const handler = () => {
      if (theme === 'system') update('system');
    };
    mediaQuery.addEventListener('change', handler);

    return () => mediaQuery.removeEventListener('change', handler);
  }, [theme]);

  return (
    <div className="fixed top-6 right-6 z-50 rounded-full border border-slate-200/50 bg-white/70 p-1 shadow-lg backdrop-blur-md dark:border-slate-800/50 dark:bg-slate-900/70">
      <div className="flex items-center gap-0.5">
        {(['light', 'dark', 'system'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTheme(t)}
            className={`flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 ${
              theme === t
                ? 'bg-slate-200 text-slate-900 dark:bg-slate-700 dark:text-white'
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'
            }`}
            title={`Switch to ${t} mode`}
          >
            {t === 'light' && <Sun size={16} />}
            {t === 'dark' && <Moon size={16} />}
            {t === 'system' && <Monitor size={16} />}
          </button>
        ))}
      </div>
    </div>
  );
}
