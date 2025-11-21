
import React, { useState, useEffect } from 'react';
import { ExerciseManager } from './components/ExerciseManager';
import { WorkoutManager } from './components/WorkoutManager';
import { ActiveWorkout } from './components/ActiveWorkout';
import { Settings } from './components/Settings';
import { db } from './services/db';
import { Dumbbell, List, Settings as SettingsIcon, Activity } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { getTranslation } from './utils/i18n';
import { useModalContext } from './contexts/ModalContext';
import { ViewState, Workout, AppSettings } from '@/types';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('workouts');
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [isResuming, setIsResuming] = useState(false);
  const [settings, setSettings] = useState<AppSettings>({ theme: 'light', unit: 'kg', language: 'en' });
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [isNavVisible, setIsNavVisible] = useState(true); // Track Navbar visibility from children
  
  // Global modal count to hide navbar when any modal is open
  const { modalCount } = useModalContext();

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

  // NO BOUNCY ANIMATIONS - Strict Tween
  const stackVariants = {
    initial: { 
      opacity: 0, 
      x: '10%', 
      scale: 0.98,
      zIndex: 30 
    },
    animate: { 
      opacity: 1, 
      x: '0%', 
      scale: 1,
      zIndex: 30,
      transition: { 
        type: 'tween',
        ease: 'easeOut',
        duration: 0.3 
      }
    },
    exit: { 
      opacity: 0.5, 
      scale: 0.95,
      x: '-5%',
      zIndex: 0,
      transition: { duration: 0.2 }
    }
  };

  // Navbar Animation: Slide Up/Down
  const navVariants = {
    visible: { y: '0%', opacity: 1, transition: { type: 'tween', ease: 'easeOut', duration: 0.3 } },
    hidden: { y: '100%', opacity: 0, transition: { type: 'tween', ease: 'easeIn', duration: 0.3 } }
  };

  // Navbar is visible ONLY if:
  // 1. The current view mode (list vs detail) allows it (isNavVisible)
  // 2. NO modals are currently open (modalCount === 0)
  const shouldShowNavbar = isNavVisible && modalCount === 0;

  if (loading) return <div className="flex h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 text-primary">Loading Fit My Way...</div>;

  return (
    <div className="h-[100dvh] bg-gray-50 dark:bg-dark text-gray-900 dark:text-gray-100 font-sans overflow-hidden">
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

      <main className="max-w-md mx-auto h-full bg-white dark:bg-dark shadow-2xl relative overflow-hidden">
        {!activeWorkout && (
            <>
                {/* Main Content Area - Relative container for absolute positioned pages */}
                <div className="relative w-full h-full pb-0">
                  <AnimatePresence initial={false}>
                    {view === 'exercises' && (
                      <motion.div
                         key="exercises"
                         variants={stackVariants}
                         initial="initial"
                         animate="animate"
                         exit="exit"
                         className="absolute inset-0 w-full h-full bg-white dark:bg-dark"
                      >
                          <ExerciseManager 
                            initialExerciseId={pendingExerciseId}
                            onClearPendingId={() => setPendingExerciseId(null)}
                            onNavigateToWorkout={handleGoToWorkout}
                            language={settings.language}
                            onViewModeChange={setIsNavVisible}
                          />
                      </motion.div>
                    )}
                    {view === 'workouts' && (
                        <motion.div
                            key="workouts"
                            variants={stackVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="absolute inset-0 w-full h-full bg-white dark:bg-dark"
                        >
                            <WorkoutManager 
                              key={`workouts-${refreshTrigger}`} 
                              onStartWorkout={startWorkout} 
                              initialWorkoutId={pendingWorkoutId}
                              onClearPendingId={() => setPendingWorkoutId(null)}
                              onNavigateToExercise={handleGoToExercise}
                              language={settings.language}
                              onViewModeChange={setIsNavVisible}
                            />
                        </motion.div>
                    )}
                    {view === 'settings' && (
                         <motion.div
                            key="settings"
                            variants={stackVariants}
                            initial="initial"
                            animate="animate"
                            exit="exit"
                            className="absolute inset-0 w-full h-full bg-white dark:bg-dark overflow-y-auto"
                            onAnimationStart={() => setIsNavVisible(true)}
                         >
                            <Settings settings={settings} onUpdateSettings={handleUpdateSettings} />
                         </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Navigation Bar */}
                <AnimatePresence>
                  {shouldShowNavbar && (
                    <motion.nav 
                      variants={navVariants}
                      initial="hidden"
                      animate="visible"
                      exit="hidden"
                      className="absolute bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-gray-200 dark:border-slate-800 z-40 pb-safe pb-5"
                    >
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
                    </motion.nav>
                  )}
                </AnimatePresence>
            </>
        )}
      </main>
    </div>
  );
};

export default App;
