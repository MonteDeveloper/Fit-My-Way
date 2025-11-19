
import React, { useRef } from 'react';
import { db } from '../services/db';
import { Download, Upload, Trash2, Moon, Sun, Globe } from 'lucide-react';
import { AppSettings } from '../types';
import { getTranslation } from '../utils/i18n';

interface SettingsProps {
  settings: AppSettings;
  onUpdateSettings: (s: AppSettings) => void;
}

export const Settings: React.FC<SettingsProps> = ({ settings, onUpdateSettings }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = getTranslation(settings.language || 'en').settings;
  const tCommon = getTranslation(settings.language || 'en').common;

  const handleExport = async () => {
    const json = await db.exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fit-my-way-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      await db.importData(text);
      alert(t.imported);
      window.location.reload();
    } catch (err) {
      alert(t.importFailed);
    }
  };

  const handleReset = async () => {
    if (confirm(t.resetConfirm)) {
      await db.clearAll();
      window.location.reload();
    }
  };

  const toggleTheme = () => {
    const newTheme = settings.theme === 'light' ? 'dark' : 'light';
    onUpdateSettings({ ...settings, theme: newTheme });
  };

  const changeLanguage = (lang: 'en' | 'it') => {
    onUpdateSettings({ ...settings, language: lang });
  };

  return (
    <div className="p-4 space-y-6">
      <h2 className="text-2xl font-bold">{t.title}</h2>

      <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-slate-700 space-y-6">
        
        <div className="flex justify-between items-center">
            <div>
                <h3 className="font-semibold">{t.theme}</h3>
                <p className="text-xs text-gray-500">{t.themeDesc}</p>
            </div>
            <button onClick={toggleTheme} className="p-2 bg-gray-100 dark:bg-slate-700 rounded-lg">
                {settings.theme === 'dark' ? <Moon size={20} className="text-primary"/> : <Sun size={20} className="text-orange-500"/>}
            </button>
        </div>

        <div className="h-px bg-gray-100 dark:bg-slate-700"></div>

        <div className="flex justify-between items-center">
            <div>
                <h3 className="font-semibold">{t.language}</h3>
                <p className="text-xs text-gray-500">{t.languageDesc}</p>
            </div>
            <div className="flex items-center gap-2 bg-gray-100 dark:bg-slate-700 rounded-lg p-1">
                <button 
                    onClick={() => changeLanguage('en')} 
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${settings.language === 'en' ? 'bg-white dark:bg-slate-600 shadow-sm text-primary' : 'text-gray-500'}`}
                >
                    EN
                </button>
                <button 
                    onClick={() => changeLanguage('it')} 
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${settings.language === 'it' ? 'bg-white dark:bg-slate-600 shadow-sm text-primary' : 'text-gray-500'}`}
                >
                    IT
                </button>
            </div>
        </div>

        <div className="h-px bg-gray-100 dark:bg-slate-700"></div>

        <div>
            <h3 className="font-semibold mb-3">{t.data}</h3>
            <div className="grid grid-cols-2 gap-3">
                <button onClick={handleExport} className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 text-primary font-medium flex items-center justify-center gap-2 hover:bg-indigo-100 dark:hover:bg-indigo-900/40">
                    <Download size={18} /> {t.export}
                </button>
                <button onClick={() => fileInputRef.current?.click()} className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 font-medium flex items-center justify-center gap-2 hover:bg-emerald-100 dark:hover:bg-emerald-900/40">
                    <Upload size={18} /> {t.import}
                </button>
                <input ref={fileInputRef} type="file" className="hidden" accept=".json" onChange={handleImport} />
            </div>
        </div>

        <div className="h-px bg-gray-100 dark:bg-slate-700"></div>

        <div>
             <button onClick={handleReset} className="w-full p-3 rounded-xl border border-red-200 dark:border-red-900 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium flex items-center justify-center gap-2">
                <Trash2 size={18} /> {t.reset}
             </button>
        </div>

      </div>

      <div className="text-center text-xs text-gray-400 pt-10">
        Fit My Way v1.1 • Local Only
      </div>
    </div>
  );
};
