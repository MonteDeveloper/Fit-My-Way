

import React, { useState, useEffect, useRef } from 'react';
import { Workout, Exercise, Language } from '../../types';
import { db } from '../services/db';
import { Pause, Play, X, ChevronLeft, ChevronRight, SkipBack, SkipForward, CheckCircle, Image as ImageIcon, RotateCcw, AlertCircle, Info, Plus, Minus, Copy } from 'lucide-react';
import { getTranslation } from '../utils/i18n';
import { AnimatePresence, motion } from 'framer-motion';

interface ActiveWorkoutProps {
  workout: Workout;
  resume?: boolean;
  onClose: () => void;
  language: Language;
}

interface AlertState {
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

type WorkoutLog = Record<string, { [setIndex: number]: number }>;

export const ActiveWorkout: React.FC<ActiveWorkoutProps> = ({ workout, resume = false, onClose, language }) => {
  const [currentExIndex, setCurrentExIndex] = useState(0);
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [startTime] = useState(Date.now());
  const [isLoading, setIsLoading] = useState(true);

  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(true);
  const [restTimer, setRestTimer] = useState(0);
  const [isResting, setIsResting] = useState(false);
  const [afterExerciseRest, setAfterExerciseRest] = useState(false);
  
  const [setCountdown, setSetCountdown] = useState<number | null>(null);
  const [isSetCountdownRunning, setIsSetCountdownRunning] = useState(false);

  const [showFinishConfirm, setShowFinishConfirm] = useState(false);
  const [reportCopied, setReportCopied] = useState(false);
  const [alertState, setAlertState] = useState<AlertState | null>(null);

  const [workoutLog, setWorkoutLog] = useState<WorkoutLog>({});
  const [lastCompletedSet, setLastCompletedSet] = useState<{ exId: string; exIndex: number; setIndex: number } | null>(null);
  const [completedSets, setCompletedSets] = useState<Record<string, Set<number>>>({});

  const startSoundRef = useRef<HTMLAudioElement | null>(null);
  const audioUnlockedRef = useRef(false);

  const t = getTranslation(language).active;
  const tCommon = getTranslation(language).common;
  const tWorkouts = getTranslation(language).workouts;
  const tMuscles = getTranslation(language).muscles;

  useEffect(() => {
    // --- Audio Unlock Logic for Safari/iOS ---
    startSoundRef.current = new Audio('https://www.soundjay.com/buttons/sounds/button-16.mp3');
    startSoundRef.current.preload = 'auto';

    const unlockAudio = () => {
      if (startSoundRef.current && !audioUnlockedRef.current) {
        const audio = startSoundRef.current;
        audio.volume = 0; // Play it silently
        audio.play()
          .then(() => {
            // Success! Pause and reset.
            audio.pause();
            audio.currentTime = 0;
            audio.volume = 1; // Restore volume
            audioUnlockedRef.current = true;
          })
          .catch(e => {
            console.warn("Audio unlock interaction failed.", e);
          });
      }
    };
    // Add a one-time listener for the first user interaction
    document.addEventListener('pointerdown', unlockAudio, { once: true });
    // --- End Audio Unlock Logic ---

    const init = async () => {
      const all = await db.getExercises();
      setExercises(all);

      if (resume) {
        const session = await db.getActiveSession();
        if (session && session.workoutId === workout.id) {
           setCurrentExIndex(session.currentExIndex);
           setCurrentSetIndex(session.currentSetIndex);
           setTimer(session.timer);
        }
      } else {
        await db.clearActiveSession();
      }
      setIsLoading(false);
    };
    init();

    // Cleanup listener on unmount
    return () => {
      document.removeEventListener('pointerdown', unlockAudio);
    };
  }, []);

  useEffect(() => {
    if (workout && !isLoading) {
        const initialLog: WorkoutLog = {};
        workout.exercises.forEach((wEx) => {
            initialLog[wEx.id] = {};
            wEx.sets.forEach((set, setIndex) => {
                initialLog[wEx.id][setIndex] = set.value;
            });
        });
        setWorkoutLog(initialLog);
    }
  }, [workout, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    const wEx = workout.exercises[currentExIndex];
    const s = Array.isArray(wEx?.sets) ? wEx.sets[currentSetIndex] : null;
    
    if (s && s.type === 'time' && !isResting) {
       setSetCountdown(s.value);
       setIsSetCountdownRunning(true);
    } else {
       setSetCountdown(null);
       setIsSetCountdownRunning(false);
    }
  }, [currentExIndex, currentSetIndex, isResting, isLoading]);

  useEffect(() => {
    if (isLoading) return;
    
    db.saveActiveSession({
        id: 'current',
        workoutId: workout.id,
        currentExIndex,
        currentSetIndex,
        timer,
        startTime
    });
  }, [currentExIndex, currentSetIndex, timer, isLoading]);

  useEffect(() => {
    const interval = setInterval(() => {
      if (isTimerRunning) setTimer(t => t + 1);
      if (isResting) {
        if (restTimer > 0) {
          setRestTimer(t => t - 1);
        } else {
          setIsResting(false);
          setLastCompletedSet(null);
          if (afterExerciseRest) {
            nextExercise();
            setAfterExerciseRest(false);
          }
        }
      }
      
      if (isSetCountdownRunning && setCountdown !== null && setCountdown > 0) {
          setSetCountdown(c => (c as number) - 1);
      }
      if (isSetCountdownRunning && setCountdown === 0) {
          setIsSetCountdownRunning(false);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning, isResting, restTimer, isSetCountdownRunning, setCountdown, afterExerciseRest]);
  
  useEffect(() => {
    // Play sound when rest timer is about to hit zero naturally
    if (isResting && restTimer === 1) {
      if (startSoundRef.current) {
        startSoundRef.current.currentTime = 0;
        startSoundRef.current.play().catch(e => console.error("Audio play failed:", e));
      }
    }
  }, [restTimer, isResting]);

  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  const handleUpdateLog = (increment: number) => {
    if (!lastCompletedSet) return;
    const { exId, setIndex } = lastCompletedSet;
    setWorkoutLog(prevLog => {
        const currentVal = prevLog[exId]?.[setIndex] ?? 0;
        const newVal = Math.max(0, currentVal + increment);
        return { ...prevLog, [exId]: { ...prevLog[exId], [setIndex]: newVal } };
    });
  };

  const currentWorkoutExercise = workout.exercises[currentExIndex];
  const sets = Array.isArray(currentWorkoutExercise?.sets) ? currentWorkoutExercise.sets : [];
  const currentSet = sets[currentSetIndex];
  const exerciseDef = exercises.find(e => e.id === currentWorkoutExercise?.exerciseId);
  const totalSets = sets.length || 1;
  
  const handleCopyReport = async () => {
    const dateStr = new Date().toLocaleDateString(language, { weekday: 'long', year: 'numeric', month: '2-digit', day: '2-digit' });
    let logText = `${dateStr}\n`;
    logText += `${t.reportDuration}: ${formatTime(timer)}\n\n`;
    logText += `${t.reportExercises}\n`;
    workout.exercises.forEach(wEx => {
        const exDef = exercises.find(e => e.id === wEx.exerciseId);
        if (!exDef) return;
        
        const loggedSets = wEx.sets.map((set, setIndex) => {
            if (!completedSets[wEx.id]?.has(setIndex)) {
                return null;
            }
            const loggedValue = workoutLog[wEx.id]?.[setIndex] ?? set.value;
            return set.type === 'time' ? `${loggedValue}s` : `${loggedValue}x`;
        }).filter(val => val !== null);

        if (loggedSets.length > 0) {
            logText += `• ${exDef.name}: ${loggedSets.join(', ')}\n`;
        }
    });

    try {
      await navigator.clipboard.writeText(logText.trim());
      setReportCopied(true);
    } catch (e) { console.warn("Clipboard write failed", e); }
  };

  const handleConfirmFinish = async () => {
    await db.clearActiveSession();
    setShowFinishConfirm(false);
    onClose();
  };

  const handleCloseAlert = () => {
      setAlertState(null);
      onClose();
  };

  const prevExercise = () => {
    if (currentExIndex > 0) {
        setCurrentExIndex(i => i - 1);
        setCurrentSetIndex(0);
        setIsResting(false);
    }
  };

  const nextExercise = () => {
    if (currentExIndex < workout.exercises.length - 1) {
        setCurrentExIndex(i => i + 1);
        setCurrentSetIndex(0);
        setIsResting(false);
    }
  };

  const prevSet = () => {
    if (currentSetIndex > 0) {
        setCurrentSetIndex(i => i - 1);
    }
  };

  const nextSet = () => {
    setCompletedSets(prev => {
        const newSets = { ...prev };
        if (!newSets[currentWorkoutExercise.id]) {
            newSets[currentWorkoutExercise.id] = new Set();
        }
        newSets[currentWorkoutExercise.id].add(currentSetIndex);
        return newSets;
    });
    
    setLastCompletedSet({ exId: currentWorkoutExercise.id, exIndex: currentExIndex, setIndex: currentSetIndex });
    
    const isLastSetOfExercise = currentSetIndex >= totalSets - 1;
    const isLastExerciseOfWorkout = currentExIndex >= workout.exercises.length - 1;

    if (!isLastSetOfExercise) {
        setCurrentSetIndex(i => i + 1);
        if (currentWorkoutExercise.restTime > 0) {
            setRestTimer(currentWorkoutExercise.restTime);
            setIsResting(true);
            setAfterExerciseRest(false);
        }
    } else if (!isLastExerciseOfWorkout) {
        if ((currentWorkoutExercise.restAfterExercise || 0) > 0) {
            setRestTimer(currentWorkoutExercise.restAfterExercise);
            setIsResting(true);
            setAfterExerciseRest(true);
        } else {
            nextExercise();
        }
    } else {
        setReportCopied(false);
        setShowFinishConfirm(true);
    }
  };

  const handleSkipRest = () => {
    setIsResting(false);
    setLastCompletedSet(null);
    if (afterExerciseRest) {
      nextExercise();
      setAfterExerciseRest(false);
    }
  };

  if (isLoading || !exerciseDef || !currentSet) return <div className="p-10 text-center dark:text-white">Loading...</div>;

  const transform = exerciseDef.imageTransform || {x:0, y:0, scale: 1};

  const btnBase = "flex flex-col items-center justify-center p-3 rounded-xl transition border-2 active:scale-95 h-20";
  const btnDisabled = "border-transparent bg-gray-100 dark:bg-slate-800 text-gray-300 dark:text-slate-600 opacity-40 cursor-not-allowed pointer-events-none";
  const btnSecondary = "border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700";
  const btnPrimary = "border-primary bg-primary text-white shadow-lg shadow-indigo-500/20";

  const isFirstEx = currentExIndex === 0;
  const isLastEx = currentExIndex === workout.exercises.length - 1;
  const isFirstSet = currentSetIndex === 0;
  const isLastSet = currentSetIndex === totalSets - 1;
  const showWeight = currentSet.weight > 0;
  const isFinishState = isLastEx && isLastSet;
  
  const completedWorkoutEx = lastCompletedSet ? workout.exercises[lastCompletedSet.exIndex] : null;
  const completedSetDef = completedWorkoutEx ? completedWorkoutEx.sets[lastCompletedSet.setIndex] : null;
  const loggedValue = (lastCompletedSet && completedSetDef) ? workoutLog[lastCompletedSet.exId]?.[lastCompletedSet.setIndex] : null;

  return (
    <div className="fixed inset-0 bg-white dark:bg-slate-900 z-50 flex flex-col h-full">
      <div className="p-4 flex justify-between items-center bg-white dark:bg-slate-900 z-10 border-b border-gray-100 dark:border-slate-800">
        <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-500 bg-gray-50 dark:bg-slate-800 rounded-full"><X size={20}/></button>
        <div className="flex flex-col items-center"><span className="font-mono font-bold text-2xl text-primary dark:text-indigo-400">{formatTime(timer).substring(3)}</span></div>
        <button onClick={() => setIsTimerRunning(!isTimerRunning)} className={`p-2 rounded-full ${isTimerRunning ? 'text-primary bg-indigo-50 dark:bg-indigo-900/20' : 'text-gray-400 bg-gray-100 dark:bg-slate-800'}`}>{isTimerRunning ? <Pause size={20}/> : <Play size={20}/>}</button>
      </div>
      <div className="flex-1 flex flex-col overflow-hidden relative">
        <div className="w-full aspect-[4/3] bg-black overflow-hidden shadow-inner border-b border-gray-200 dark:border-slate-700 shrink-0 relative">
            {exerciseDef.imageUrl ? (<img key={`${exerciseDef.id}-${isResting}`} src={exerciseDef.imageUrl} alt={exerciseDef.name} className="w-full h-full object-contain" style={{transform: `translate(${transform.x}%, ${transform.y}%) scale(${transform.scale})`, transformOrigin: 'center',}} onError={(e) => e.currentTarget.style.display = 'none'}/>) : (<div className="flex flex-col items-center justify-center h-full text-gray-400 bg-gray-100 dark:bg-slate-800"><ImageIcon size={64} /><span className="mt-2 text-sm">{t.noVisual}</span></div>)}
        </div>
        <div className="flex-1 overflow-y-auto p-4">
            <div className="flex items-center justify-between mb-1"><h2 className="text-2xl font-black leading-none text-gray-900 dark:text-white truncate pr-2">{exerciseDef.name}</h2><div className="flex-shrink-0 px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-primary rounded-full text-xs font-bold uppercase tracking-wide whitespace-nowrap">Set {currentSetIndex + 1} <span className="opacity-50">/ {totalSets}</span></div></div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">{exerciseDef.muscleGroups.map(m => tMuscles[m as keyof typeof tMuscles] || m).join(', ')}</p>
            <div className={`grid gap-4 mb-4 ${showWeight ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <div className="bg-gray-50 dark:bg-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center border border-gray-100 dark:border-slate-700">
                     {currentSet.type === 'time' ? (<><div className="text-center mb-2">{setCountdown === 0 ? (<div className="text-5xl font-black font-mono text-red-500 animate-pulse">0s</div>) : (<div className="text-5xl font-black font-mono text-emerald-500">{setCountdown}s</div>)}</div><div className="flex gap-2">{setCountdown === 0 ? (<button onClick={() => {setSetCountdown(currentSet.value); setIsSetCountdownRunning(true);}} className="p-2 bg-gray-200 dark:bg-slate-700 rounded-full"><RotateCcw size={16}/></button>) : (<><button onClick={() => setIsSetCountdownRunning(!isSetCountdownRunning)} className="p-2 bg-emerald-500 text-white rounded-full shadow-sm">{isSetCountdownRunning ? <Pause size={16}/> : <Play size={16}/>}</button><button onClick={() => {setSetCountdown(currentSet.value); setIsSetCountdownRunning(false);}} className="p-2 bg-gray-200 dark:bg-slate-700 rounded-full text-gray-500"><RotateCcw size={16}/></button></>)}</div></>) : (<div className="text-center"><div className="text-6xl font-black text-gray-800 dark:text-white">{currentSet.value}</div><div className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mt-1">{tWorkouts.reps}</div></div>)}
                </div>
                {showWeight && (<div className="bg-gray-50 dark:bg-slate-800 rounded-2xl p-4 flex flex-col items-center justify-center border border-gray-100 dark:border-slate-700"><div className="text-center"><div className="text-6xl font-black text-gray-800 dark:text-white">{currentSet.weight}</div><div className="text-[10px] uppercase font-bold text-gray-400 tracking-widest mt-1">Kg</div></div></div>)}
            </div>
            {exerciseDef.notes && (<div className="w-full bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded-xl border border-yellow-100 dark:border-yellow-900/20"><h4 className="text-[10px] font-bold text-yellow-600 uppercase mb-1">{tCommon.notes}</h4><p className="text-sm text-gray-600 dark:text-gray-300 leading-snug">{exerciseDef.notes}</p></div>)}
        </div>
      </div>
      <div className="p-4 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800 pb-safe-area">
          <div className="grid grid-cols-4 gap-3">
              <button disabled={isFirstEx} onClick={prevExercise} className={`${btnBase} ${isFirstEx ? btnDisabled : btnSecondary}`}><SkipBack size={20} /><span className="text-[9px] font-bold mt-1 uppercase">{t.prevEx}</span></button>
              <button disabled={isFirstSet} onClick={prevSet} className={`${btnBase} ${isFirstSet ? btnDisabled : btnSecondary}`}><ChevronLeft size={20} /><span className="text-[9px] font-bold mt-1 uppercase">{t.prevSet}</span></button>
              {isFinishState ? (<button onClick={nextSet} className={`col-span-2 flex items-center justify-center p-3 rounded-xl transition border-2 active:scale-95 h-20 bg-emerald-500 hover:bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-500/20`}><div className="flex flex-col items-center"><CheckCircle size={24} /><span className="text-xs font-bold mt-1 uppercase">{t.finish}</span></div></button>) : (<><button onClick={nextSet} className={`${btnBase} ${btnPrimary}`}><ChevronRight size={24} strokeWidth={3} /><span className="text-[9px] font-bold mt-1 uppercase">{t.nextSet}</span></button><button disabled={isLastEx} onClick={nextExercise} className={`${btnBase} ${isLastEx ? btnDisabled : btnSecondary}`}><SkipForward size={20} /><span className="text-[9px] font-bold mt-1 uppercase">{t.nextEx}</span></button></>)}
          </div>
      </div>
      {isResting && (
            <div className="absolute inset-0 z-50 bg-white dark:bg-slate-900 flex flex-col">
            {(() => {
                if (!lastCompletedSet) return null;

                const { exIndex: completedExIndex, setIndex: completedSetIndex } = lastCompletedSet;
                const completedWkEx = workout.exercises[completedExIndex];
                const isLastSetOfCompletedExercise = completedSetIndex >= completedWkEx.sets.length - 1;

                const nextExIdx = isLastSetOfCompletedExercise ? completedExIndex + 1 : completedExIndex;
                const nextSetIdx = isLastSetOfCompletedExercise ? 0 : completedSetIndex + 1;

                const nextWkEx = workout.exercises[nextExIdx];
                if (!nextWkEx) return null;

                const nextExDef = exercises.find(e => e.id === nextWkEx.exerciseId);
                const nextSet = nextWkEx.sets[nextSetIdx];
                if (!nextSet) return null;
                
                const nextTransform = nextExDef?.imageTransform || { x: 0, y: 0, scale: 1 };

                return (<>
                    <div className="w-full aspect-[4/3] bg-black relative shrink-0 border-b border-gray-100 dark:border-slate-800 overflow-hidden">
                        {nextExDef?.imageUrl ? (
                           <img src={nextExDef.imageUrl} alt={nextExDef.name} className="w-full h-full object-contain" style={{transform: `translate(${nextTransform.x}%, ${nextTransform.y}%) scale(${nextTransform.scale})`, transformOrigin: 'center'}} />
                        ) : (
                           <div className="w-full h-full flex items-center justify-center bg-gray-900 text-gray-600"><ImageIcon size={64} /></div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
                        <div className="absolute bottom-0 left-0 w-full p-4 text-white z-20 pb-6 flex items-end justify-between gap-4">
                            <div className="flex-1 min-w-0">
                                <span className="px-2 py-0.5 bg-emerald-500 text-black text-[10px] font-black uppercase tracking-wider rounded mb-1 inline-block">{t.nextLabel}</span>
                                <h2 className="text-2xl font-black leading-none truncate text-white">{nextExDef?.name}</h2>
                            </div>
                            <div className="text-right shrink-0">
                                <div className="text-2xl font-black leading-none">{nextSet.type === 'time' ? `${nextSet.value}s` : `${nextSet.value}x`}</div>
                                <div className="text-xs text-gray-300 font-medium mt-1">Set {nextSetIdx + 1}/{nextWkEx.sets.length}</div>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 flex flex-col items-center justify-center p-6 bg-white dark:bg-slate-900 relative space-y-6">
                       <div className="flex flex-col items-center text-center">
                           <div className="text-9xl font-black font-mono text-primary tabular-nums tracking-tighter leading-none">{restTimer}</div>
                       </div>
                       {completedSetDef && loggedValue !== null && (<div className="w-full max-w-xs space-y-3 text-center"><p className="text-sm text-gray-500 font-medium">{completedSetDef.type === 'reps' ? t.logRepsPrompt : t.logTimePrompt}</p><div className="flex items-center justify-center gap-4"><button onClick={() => handleUpdateLog(-1)} className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-sm border border-gray-200 dark:border-slate-700"><Minus size={24} /></button><span className="text-5xl font-bold w-24 text-center tabular-nums">{loggedValue}</span><button onClick={() => handleUpdateLog(1)} className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-sm border border-gray-200 dark:border-slate-700"><Plus size={24} /></button></div></div>)}
                       <button onClick={handleSkipRest} className="w-full max-w-xs py-4 bg-gray-100 dark:bg-slate-800 rounded-2xl font-bold text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-slate-700 transition active:scale-[0.98] flex items-center justify-center gap-3 shadow-sm border border-gray-200 dark:border-slate-700"><SkipForward size={20} />{t.skipRest}</button>
                    </div>
                </>);
            })()}
            </div>
      )}
      <AnimatePresence>
        {showFinishConfirm && (
             <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.2 }} className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 dark:border-slate-700">
                   <div className="flex flex-col items-center text-center">
                       <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500 rounded-full flex items-center justify-center mb-4"><CheckCircle size={24} /></div>
                       <h3 className="font-bold text-xl mb-2">{t.finish}</h3>
                       <p className="text-gray-500 dark:text-gray-400 text-sm mb-6">{t.finishConfirm}</p>
                       
                       {completedSetDef && loggedValue !== null && (
                         <div className="w-full max-w-xs space-y-3 text-center mb-6">
                            <p className="text-sm text-gray-500 font-medium">{completedSetDef.type === 'reps' ? t.logRepsPrompt : t.logTimePrompt}</p>
                            <div className="flex items-center justify-center gap-4">
                               <button onClick={() => handleUpdateLog(-1)} className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-sm border border-gray-200 dark:border-slate-700"><Minus size={24} /></button>
                               <span className="text-5xl font-bold w-24 text-center tabular-nums">{loggedValue}</span>
                               <button onClick={() => handleUpdateLog(1)} className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center active:scale-90 transition-transform shadow-sm border border-gray-200 dark:border-slate-700"><Plus size={24} /></button>
                            </div>
                         </div>
                       )}

                       <button onClick={handleCopyReport} disabled={reportCopied} className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors mb-4 ${reportCopied ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-gray-100 dark:bg-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600'}`}>{reportCopied ? <CheckCircle size={18}/> : <Copy size={18}/>} {reportCopied ? t.reportCopied : t.copyReport}</button>
                   </div>
                   <div className="flex gap-3">
                      <button onClick={() => setShowFinishConfirm(false)} className="flex-1 py-3 bg-gray-100 dark:bg-slate-700 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors">{tCommon.cancel}</button>
                      <button onClick={handleConfirmFinish} className="flex-1 py-3 bg-primary hover:bg-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-indigo-500/20 transition-colors">{tCommon.confirm}</button>
                   </div>
                </motion.div>
             </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {alertState && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.2 }} className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 dark:border-slate-700">
                <div className="flex flex-col items-center text-center mb-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${alertState.type === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-500' : alertState.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-500'}`}>{alertState.type === 'error' ? <AlertCircle size={24} /> : alertState.type === 'success' ? <CheckCircle size={24} /> : <Info size={24} />}</div>
                    <h3 className="font-bold text-xl mb-2">{alertState.title}</h3><p className="text-gray-500 dark:text-gray-400 text-sm whitespace-pre-wrap">{alertState.message}</p>
                </div>
                <button onClick={handleCloseAlert} className="w-full py-3 bg-gray-100 dark:bg-slate-700 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors">{tCommon.close}</button>
            </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
};
