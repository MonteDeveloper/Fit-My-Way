
import React, { useState, useEffect } from 'react';
import { ViewState, Workout, AppSettings } from '../types';
import { ExerciseManager } from './components/ExerciseManager';
import { WorkoutManager } from './components/WorkoutManager';
import { ActiveWorkout } from './components/ActiveWorkout';
import { Settings } from './components/Settings';
import { db } from './services/db';
import { Dumbbell, List, Settings as SettingsIcon, Activity } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { getTranslation } from './utils/i18n';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('workouts');
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({ theme: 'light', unit: 'kg', language: 'en' });
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [pendingExerciseId, setPendingExerciseId] = useState<string | null>(null);
  const [pendingWorkoutId, setPendingWorkoutId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const s = await db.getSettings();
      setSettings(s);
      applyTheme(s.theme);
      setLoading(false);
    };
    init();
  }, []);

  const applyTheme = (theme: 'light' | 'dark') => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const handleUpdateSettings = async (newSettings: AppSettings) => {
    setSettings(newSettings);
    applyTheme(newSettings.theme);
    await db.saveSettings(newSettings);
  };

  const startWorkout = (w: Workout, resume = false) => {
    setIsResuming(resume);
    setActiveWorkout(w);
  };

  const handleGoToExercise = (id: string) => {
    setPendingExerciseId(id);
    setView('exercises');
  };

  const handleGoToWorkout = (id: string) => {
    setPendingWorkoutId(id);
    setView('workouts');
  };

  const t = getTranslation(settings.language || 'en').nav;

  if (loading) return <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 text-primary">Loading Fit My Way...</div>;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark text-gray-900 dark:text-gray-100 font-sans overflow-hidden">
      {activeWorkout && (
        <ActiveWorkout 
          workout={activeWorkout} 
          resume={isResuming}
          onClose={() => {
              setActiveWorkout(null);
              setIsResuming(false);
              setRefreshTrigger(prev => prev + 1);
          }}
          language={settings.language}
        />
      )}

      <main className="max-w-md mx-auto min-h-screen bg-white dark:bg-dark shadow-2xl relative">
        {!activeWorkout && (
            <>
                <div className="pb-20 min-h-screen">
                  <AnimatePresence mode="wait">
                    {view === 'exercises' && (
                      <motion.div
                         key="exercises"
                         initial={{ opacity: 0, x: 20 }}
                         animate={{ opacity: 1, x: 0 }}
                         exit={{ opacity: 0, x: -20 }}
                         transition={{ duration: 0.2 }}
                      >
                          <ExerciseManager 
                            initialExerciseId={pendingExerciseId}
                            onClearPendingId={() => setPendingExerciseId(null)}
                            onNavigateToWorkout={handleGoToWorkout}
                            language={settings.language}
                          />
                      </motion.div>
                    )}
                    {view === 'workouts' && (
                        <motion.div
                            key="workouts"
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            transition={{ duration: 0.2 }}
                        >
                            <WorkoutManager 
                              key={`workouts-${refreshTrigger}`} 
                              onStartWorkout={startWorkout} 
                              initialWorkoutId={pendingWorkoutId}
                              onClearPendingId={() => setPendingWorkoutId(null)}
                              onNavigateToExercise={handleGoToExercise}
                              language={settings.language}
                            />
                        </motion.div>
                    )}
                    {view === 'settings' && (
                         <motion.div
                            key="settings"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 20 }}
                            transition={{ duration: 0.2 }}
                         >
                            <Settings settings={settings} onUpdateSettings={handleUpdateSettings} />
                         </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <nav className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-gray-200 dark:border-slate-800 z-40 pb-safe pb-5">
                  <div className="max-w-md mx-auto flex justify-around items-center p-3">
                    <button 
                        onClick={() => setView('workouts')} 
                        className={`flex flex-col items-center gap-1 transition-colors ${view === 'workouts' ? 'text-primary' : 'text-gray-400'}`}
                    >
                        <Activity size={24} strokeWidth={view === 'workouts' ? 2.5 : 2} />
                        <span className="text-[10px] font-medium">{t.workouts}</span>
                    </button>
                    
                    <button 
                        onClick={() => setView('exercises')} 
                        className={`flex flex-col items-center gap-1 transition-colors ${view === 'exercises' ? 'text-primary' : 'text-gray-400'}`}
                    >
                        <Dumbbell size={24} strokeWidth={view === 'exercises' ? 2.5 : 2} />
                        <span className="text-[10px] font-medium">{t.exercises}</span>
                    </button>

                    <button 
                        onClick={() => setView('settings')} 
                        className={`flex flex-col items-center gap-1 transition-colors ${view === 'settings' ? 'text-primary' : 'text-gray-400'}`}
                    >
                        <SettingsIcon size={24} strokeWidth={view === 'settings' ? 2.5 : 2} />
                        <span className="text-[10px] font-medium">{t.settings}</span>
                    </button>
                  </div>
                </nav>
            </>
        )}
      </main>
    </div>
  );
};

export default App;
