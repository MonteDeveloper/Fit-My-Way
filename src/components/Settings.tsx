
import React, { useRef, useState } from 'react';
import { db } from '../services/db';
import { Download, Upload, Trash2, Moon, Sun, AlertTriangle, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { AppSettings } from '../../types';
import { getTranslation } from '../utils/i18n';
import { AnimatePresence, motion } from 'framer-motion';
import { useModalRegistry } from '../contexts/ModalContext';

interface SettingsProps {
  settings: AppSettings;
  onUpdateSettings: (s: AppSettings) => void;
}

interface AlertState {
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

export const Settings: React.FC<SettingsProps> = ({ settings, onUpdateSettings }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [alertState, setAlertState] = useState<AlertState | null>(null);
  
  const t = getTranslation(settings.language || 'en').settings;
  const tCommon = getTranslation(settings.language || 'en').common;

  // Register Modals to Context to hide Navbar
  useModalRegistry(showResetModal);
  useModalRegistry(!!alertState);

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info') => {
      setAlertState({ isOpen: true, title, message, type });
  };

  const closeAlert = () => {
      setAlertState(null);
      if (alertState?.type === 'success' && alertState.message === t.imported) {
         window.location.reload();
      }
  };

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
      showAlert(tCommon.done, t.imported, 'success');
    } catch (err) {
      showAlert("Error", t.importFailed, 'error');
    }
  };

  const confirmReset = async () => {
    try {
      await db.clearAll();
      window.location.reload();
    } catch (e) {
      console.error("Reset failed", e);
      // Force reload anyway to clear state
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
    <div className="p-4 space-y-6 relative">
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
             <button onClick={() => setShowResetModal(true)} className="w-full p-3 rounded-xl border border-red-200 dark:border-red-900 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 font-medium flex items-center justify-center gap-2">
                <Trash2 size={18} /> {t.reset}
             </button>
        </div>

      </div>

      <div className="text-center text-xs text-gray-400 pt-10">
        Fit My Way • by Monte
      </div>

      <AnimatePresence>
          {showResetModal && (
             <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 dark:border-slate-700"
                >
                   <div className="flex flex-col items-center text-center mb-4">
                       <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mb-4">
                           <AlertTriangle size={24} strokeWidth={2.5} />
                       </div>
                       <h3 className="font-bold text-xl mb-2">{t.reset}</h3>
                       <p className="text-gray-500 dark:text-gray-400 text-sm">
                          {t.resetConfirm}
                       </p>
                   </div>
                   
                   <div className="flex gap-3">
                      <button 
                         onClick={() => setShowResetModal(false)} 
                         className="flex-1 py-3 bg-gray-100 dark:bg-slate-700 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                      >
                         {tCommon.cancel}
                      </button>
                      <button 
                         onClick={confirmReset} 
                         className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-500/20 transition-colors"
                      >
                         {tCommon.delete}
                      </button>
                   </div>
                </motion.div>
             </div>
          )}
      </AnimatePresence>

      {/* Custom Alert Modal */}
      <AnimatePresence>
        {alertState && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 dark:border-slate-700"
            >
                <div className="flex flex-col items-center text-center mb-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${
                        alertState.type === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-500' :
                        alertState.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500' :
                        'bg-blue-100 dark:bg-blue-900/30 text-blue-500'
                    }`}>
                        {alertState.type === 'error' ? <AlertCircle size={24} /> :
                         alertState.type === 'success' ? <CheckCircle size={24} /> :
                         <Info size={24} />}
                    </div>
                    <h3 className="font-bold text-xl mb-2">{alertState.title}</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                        {alertState.message}
                    </p>
                </div>
                
                <button 
                    onClick={closeAlert} 
                    className="w-full py-3 bg-gray-100 dark:bg-slate-700 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                >
                    {tCommon.close}
                </button>
            </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
};
