
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/db';
import { Plus, Play, Pencil, Trash2, ChevronUp, ChevronDown, X, ChevronLeft, Search, Copy, Clock, Dumbbell, Image as ImageIcon, Move, ZoomIn, RotateCw, Clipboard, ChevronRight, Activity } from 'lucide-react';
import { getTranslation } from '../utils/i18n';
import { AnimatePresence, motion } from 'framer-motion';
import { Workout, Language, ImageTransform, Exercise, ActiveSessionState, WORKOUT_COVERS, WorkoutExercise, WorkoutSet, MUSCLE_GROUPS } from '@/types';

interface WorkoutManagerProps {
  onStartWorkout: (workout: Workout, resume?: boolean) => void;
  initialWorkoutId?: string | null;
  onClearPendingId?: () => void;
  onNavigateToExercise?: (id: string) => void;
  language: Language;
}

type ViewMode = 'list' | 'detail' | 'edit';
const DEFAULT_COVER_TRANSFORM: ImageTransform = { x: 0, y: 0, scale: 1 };

export const WorkoutManager: React.FC<WorkoutManagerProps> = ({ 
  onStartWorkout, 
  initialWorkoutId, 
  onClearPendingId,
  onNavigateToExercise,
  language
}) => {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [activeSession, setActiveSession] = useState<ActiveSessionState | undefined>(undefined);
  
  const [mode, setMode] = useState<ViewMode>('list');
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [editingWorkout, setEditingWorkout] = useState<Partial<Workout>>({});
  const [searchTerm, setSearchTerm] = useState('');

  const [workoutToDelete, setWorkoutToDelete] = useState<string | null>(null);

  const [showAddExModal, setShowAddExModal] = useState(false);
  const [showCoverEditor, setShowCoverEditor] = useState(false);
  
  const [exModalSearch, setExModalSearch] = useState('');
  const [exModalSelected, setExModalSelected] = useState<string[]>([]);
  const [exModalFilters, setExModalFilters] = useState<string[]>([]);

  const [coverUrlInput, setCoverUrlInput] = useState('');
  const [coverTransform, setCoverTransform] = useState<ImageTransform>(DEFAULT_COVER_TRANSFORM);
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const dragStartRef = useRef<{x: number, y: number} | null>(null);

  // State for expanding truncated titles in detail view
  const [isTitleExpanded, setIsTitleExpanded] = useState(false);

  const t = getTranslation(language).workouts;
  const tMuscles = getTranslation(language).muscles;
  const tCommon = getTranslation(language).common;
  const tEx = getTranslation(language).exercises;

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    if (initialWorkoutId && workouts.length > 0) {
        const w = workouts.find(wk => wk.id === initialWorkoutId);
        if (w) {
            setSelectedWorkout(w);
            setMode('detail');
            if (onClearPendingId) onClearPendingId();
        }
    }
  }, [initialWorkoutId, workouts, onClearPendingId]);

  const refreshData = async () => {
    const w = await db.getWorkouts();
    const e = await db.getExercises();
    const s = await db.getActiveSession();
    setWorkouts(w.sort((a, b) => b.createdAt - a.createdAt));
    setAllExercises(e);
    setActiveSession(s);
  };

  const handleCreateNew = () => {
    const randomCover = WORKOUT_COVERS[Math.floor(Math.random() * WORKOUT_COVERS.length)];
    setSelectedWorkout(null);
    setEditingWorkout({
      id: crypto.randomUUID(),
      name: '',
      coverImage: randomCover,
      coverTransform: DEFAULT_COVER_TRANSFORM,
      exercises: [],
      createdAt: Date.now()
    });
    setMode('edit');
  };

  const handleEdit = (workout: Workout) => {
    setEditingWorkout(JSON.parse(JSON.stringify(workout))); 
    setCoverTransform(workout.coverTransform || DEFAULT_COVER_TRANSFORM);
    setMode('edit');
  };

  const handleDuplicate = async (workout: Workout) => {
    const copy: Workout = {
        ...workout,
        id: crypto.randomUUID(),
        name: `${workout.name} (${t.copy})`,
        createdAt: Date.now(),
        exercises: workout.exercises.map(e => ({
            ...e, 
            id: crypto.randomUUID(),
            sets: e.sets.map(s => ({...s, id: crypto.randomUUID()}))
        }))
    };
    await db.saveWorkout(copy);
    await refreshData();
    setSelectedWorkout(copy);
    setMode('detail');
  };

  const promptDelete = (id: string) => {
    setWorkoutToDelete(id);
  };

  const confirmDelete = async () => {
    if (workoutToDelete) {
      try {
        await db.deleteWorkout(workoutToDelete);
        await refreshData();
        setMode('list');
        setSelectedWorkout(null);
      } catch (e) {
        alert("Error deleting workout");
      } finally {
        setWorkoutToDelete(null);
      }
    }
  };

  const handleSave = async () => {
    if (!editingWorkout.name) return alert("Name required");

    const sanitizedExercises = editingWorkout.exercises?.map(ex => ({
        ...ex,
        restTime: Number(ex.restTime) || 0,
        restAfterExercise: Number(ex.restAfterExercise) || 0,
        sets: ex.sets.map(s => ({
            ...s,
            value: Number(s.value) || 0,
            weight: Number(s.weight) || 0
        }))
    })) || [];

    const finalWorkout: Workout = {
        ...editingWorkout as Workout,
        exercises: sanitizedExercises,
        coverTransform: coverTransform
    };
    await db.saveWorkout(finalWorkout);
    await refreshData();
    
    const saved = await db.getWorkouts().then(res => res.find(w => w.id === finalWorkout.id));
    if (saved) {
        setSelectedWorkout(saved);
        setMode('detail');
    } else {
        setMode('list');
    }
  };

  const handleAddSelectedExercises = () => {
    const newItems: WorkoutExercise[] = exModalSelected.map(id => ({
        id: crypto.randomUUID(),
        exerciseId: id,
        sets: Array.from({length: 3}).map(() => ({
            id: crypto.randomUUID(),
            type: 'reps',
            value: 10,
            weight: 0
        })),
        restTime: 60,
        restAfterExercise: 60
    }));
    setEditingWorkout(prev => ({
        ...prev,
        exercises: [...(prev.exercises || []), ...newItems]
    }));
    setExModalSelected([]);
    setShowAddExModal(false);
  };

  const removeExerciseFromWorkout = (idx: number) => {
    const newEx = [...(editingWorkout.exercises || [])];
    newEx.splice(idx, 1);
    setEditingWorkout({...editingWorkout, exercises: newEx});
  };

  const moveExercise = (idx: number, dir: number) => {
    const items = [...(editingWorkout.exercises || [])];
    if (idx + dir < 0 || idx + dir >= items.length) return;
    [items[idx], items[idx + dir]] = [items[idx + dir], items[idx]];
    setEditingWorkout({...editingWorkout, exercises: items});
  };

  const addSet = (exerciseIdx: number) => {
      const newExs = [...(editingWorkout.exercises || [])];
      const lastSet = newExs[exerciseIdx].sets[newExs[exerciseIdx].sets.length - 1];
      newExs[exerciseIdx].sets.push({
          id: crypto.randomUUID(),
          type: lastSet ? lastSet.type : 'reps',
          value: lastSet ? lastSet.value : 10,
          weight: lastSet ? lastSet.weight : 0
      });
      setEditingWorkout({...editingWorkout, exercises: newExs});
  };

  const removeSet = (exerciseIdx: number, setIdx: number) => {
      const newExs = [...(editingWorkout.exercises || [])];
      if (newExs[exerciseIdx].sets.length > 1) {
          newExs[exerciseIdx].sets.splice(setIdx, 1);
          setEditingWorkout({...editingWorkout, exercises: newExs});
      }
  };

  const updateSet = (exerciseIdx: number, setIdx: number, field: keyof WorkoutSet, value: any) => {
      const newExs = [...(editingWorkout.exercises || [])];
      newExs[exerciseIdx].sets[setIdx] = {
          ...newExs[exerciseIdx].sets[setIdx],
          [field]: value
      };
      setEditingWorkout({...editingWorkout, exercises: newExs});
  };

  const handleCoverPaste = async () => {
      try {
          setCoverUrlInput('');
          const text = await navigator.clipboard.readText();
          if (text) setCoverUrlInput(text);
      } catch (err) {
        alert("Clipboard access denied. Paste manually.");
      }
  };

  const handleCoverPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDraggingCover(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleCoverPointerMove = (e: React.PointerEvent) => {
    if (!isDraggingCover || !dragStartRef.current) return;
    e.preventDefault();
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    setCoverTransform(prev => ({
      ...prev,
      x: prev.x + (deltaX * 0.1),
      y: prev.y + (deltaY * 0.1)
    }));
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const toggleExModalFilter = (muscle: string) => {
    if (exModalFilters.includes(muscle)) {
      setExModalFilters(exModalFilters.filter(m => m !== muscle));
    } else {
      setExModalFilters([...exModalFilters, muscle]);
    }
  };

  const filteredWorkouts = workouts.filter(w => 
    w.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    // FLEX COLUMN LAYOUT for fixed header robustness
    <div className="h-[100dvh] bg-white dark:bg-dark overflow-hidden flex flex-col">
      <AnimatePresence mode="wait" initial={false}>
        {mode === 'list' && (
            <motion.div
                key="list"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="flex flex-col h-full"
            >
                {/* FIXED HEADER */}
                <div className="flex-none bg-white/95 dark:bg-dark/95 backdrop-blur-md z-20 px-4 py-3 border-b border-gray-100 dark:border-slate-800 space-y-3 shadow-sm">
                    <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold truncate">{t.title}</h2>
                    <div className="flex gap-2 flex-shrink-0">
                        <button 
                            onClick={handleCreateNew}
                            className="bg-primary hover:bg-indigo-600 text-white p-2 rounded-full shadow-lg transition-all hover:scale-105"
                        >
                            <Plus size={24} />
                        </button>
                    </div>
                    </div>

                    <div className="relative">
                        <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                        <input 
                        type="text"
                        placeholder={t.searchPlaceholder}
                        className="w-full pl-10 p-2.5 rounded-xl bg-gray-100 dark:bg-slate-800 border-none focus:ring-2 focus:ring-primary outline-none"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                {/* SCROLLABLE LIST */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
                    {activeSession && (
                        <div 
                            onClick={() => {
                                const w = workouts.find(w => w.id === activeSession.workoutId);
                                if (w) onStartWorkout(w, true);
                            }}
                            className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/50 p-4 rounded-xl flex items-center justify-between cursor-pointer"
                        >
                            <div>
                                <div className="text-xs font-bold text-primary uppercase mb-1">{t.activeSession}</div>
                                <div className="font-bold truncate max-w-[200px]">{t.resumeSession}</div>
                            </div>
                            <div className="bg-primary text-white p-2 rounded-full flex-shrink-0">
                                <RotateCw size={20} />
                            </div>
                        </div>
                    )}

                    {filteredWorkouts.map(workout => {
                        const estimatedTime = workout.exercises.reduce((acc, ex) => {
                            const sets = Array.isArray(ex.sets) ? ex.sets : [];
                            return acc + (sets.length * (30 + (ex.restTime || 0)));
                        }, 0) / 60;
                        const ct = workout.coverTransform || DEFAULT_COVER_TRANSFORM;

                        return (
                            <div 
                                key={workout.id}
                                onClick={() => { setSelectedWorkout(workout); setMode('detail'); setIsTitleExpanded(false); }}
                                className="relative w-full aspect-[21/9] bg-gray-900 rounded-2xl overflow-hidden shadow-md cursor-pointer group"
                            >
                                <img 
                                    src={workout.coverImage} 
                                    className="w-full h-full object-cover opacity-80 group-hover:opacity-60 transition-opacity"
                                    alt={workout.name}
                                    style={{ transform: `translate(${ct.x}%, ${ct.y}%) scale(${ct.scale})`}}
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none';
                                        e.currentTarget.parentElement?.classList.add('bg-gradient-to-br', 'from-gray-800', 'to-gray-900');
                                    }}
                                />
                                {(!workout.coverImage) && <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-900"></div>}
                                
                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent pointer-events-none"></div>
                                <div className="absolute bottom-0 left-0 p-4 text-white w-full">
                                    <h3 className="font-bold text-xl leading-tight mb-1 truncate pr-4">{workout.name}</h3>
                                    <div className="flex items-center gap-3 text-xs font-medium text-gray-300">
                                        <span className="flex items-center gap-1"><Dumbbell size={12}/> {workout.exercises.length} {t.exercisesCount}</span>
                                        <span className="flex items-center gap-1"><Clock size={12}/> ~{Math.round(estimatedTime)} {t.estimatedTime}</span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                    
                    {filteredWorkouts.length === 0 && (
                        <div className="text-center text-gray-400 py-10">{t.noWorkouts}</div>
                    )}
                </div>
            </motion.div>
        )}

        {mode === 'detail' && selectedWorkout && (
            <motion.div
                key="detail"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-white dark:bg-dark flex flex-col h-full"
            >
                {(() => {
                    const estimatedTime = selectedWorkout.exercises.reduce((acc, ex) => {
                        const sets = Array.isArray(ex.sets) ? ex.sets : [];
                        return acc + (sets.length * (30 + (ex.restTime || 0)));
                    }, 0) / 60;
                    const ct = selectedWorkout.coverTransform || DEFAULT_COVER_TRANSFORM;
                    const isResumable = activeSession?.workoutId === selectedWorkout.id;

                    return (
                        <>
                            {/* FIXED HEADER */}
                            <div className="flex-none z-50 bg-white/95 dark:bg-dark/95 backdrop-blur-md border-b border-gray-100 dark:border-slate-800 px-4 py-3 flex justify-between items-center shadow-sm">
                                <div className="flex items-center gap-2 overflow-hidden min-w-0">
                                    <button onClick={() => setMode('list')} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors flex-shrink-0">
                                        <ChevronLeft size={24} />
                                    </button>
                                    {/* Static Header Title */}
                                    <h2 className="font-bold text-lg truncate">
                                        {tCommon.workout}
                                    </h2>
                                </div>
                                <div className="flex gap-2 flex-shrink-0">
                                    <button onClick={() => handleDuplicate(selectedWorkout)} className="p-2 text-gray-500 hover:text-primary bg-gray-50 dark:bg-slate-800 rounded-full transition-colors"><Copy size={20} /></button>
                                    <button onClick={() => handleEdit(selectedWorkout)} className="p-2 text-gray-500 hover:text-primary bg-gray-50 dark:bg-slate-800 rounded-full transition-colors"><Pencil size={20} /></button>
                                    <button onClick={() => promptDelete(selectedWorkout.id)} className="p-2 text-gray-500 hover:text-red-500 bg-gray-50 dark:bg-slate-800 rounded-full transition-colors"><Trash2 size={20} /></button>
                                </div>
                            </div>

                            {/* SCROLLABLE BODY */}
                            <div className="flex-1 overflow-y-auto">
                                <div className="relative min-h-[16rem] w-full overflow-hidden bg-gray-900">
                                    <img 
                                        src={selectedWorkout.coverImage} 
                                        className="w-full h-full object-cover absolute inset-0"
                                        alt="Cover"
                                        style={{ transform: `translate(${ct.x}%, ${ct.y}%) scale(${ct.scale})`}}
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            e.currentTarget.parentElement?.classList.add('bg-gradient-to-br', 'from-gray-700', 'to-gray-900');
                                        }}
                                    />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none"></div>
                                    
                                    <div className="absolute bottom-0 left-0 p-6 text-white z-10 w-full">
                                        {/* Interactive Title: Click to expand/collapse. */}
                                        <h1 
                                            onClick={() => setIsTitleExpanded(!isTitleExpanded)}
                                            className={`text-3xl font-black mb-2 leading-tight cursor-pointer ${isTitleExpanded ? 'whitespace-normal' : 'truncate'}`}
                                            title="Tap to expand"
                                        >
                                            {selectedWorkout.name}
                                        </h1>
                                        {selectedWorkout.description && <p className="text-gray-200 text-sm line-clamp-2">{selectedWorkout.description}</p>}
                                    </div>
                                </div>

                                <div className="p-4 space-y-6 relative z-10 bg-white dark:bg-dark rounded-t-3xl -mt-4 min-h-[calc(100vh-16rem)]">
                                    <div className="flex justify-between items-center px-2">
                                        <div className="flex gap-4">
                                            <div className="flex items-center gap-2 text-sm font-semibold text-gray-500">
                                                <Dumbbell size={16} /> {selectedWorkout.exercises.length} {t.exercisesCount}
                                            </div>
                                            <div className="flex items-center gap-2 text-sm font-semibold text-gray-500">
                                                <Clock size={16} /> ~{Math.round(estimatedTime)} {t.estimatedTime}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-3">
                                        {isResumable && (
                                            <button 
                                                onClick={() => onStartWorkout(selectedWorkout, true)}
                                                className="w-full py-4 bg-indigo-100 dark:bg-indigo-900/30 text-primary dark:text-indigo-400 rounded-2xl font-bold text-lg flex justify-center items-center gap-2"
                                            >
                                                <RotateCw size={20} /> {t.resumeSession}
                                            </button>
                                        )}

                                        <button 
                                            onClick={() => onStartWorkout(selectedWorkout, false)}
                                            className="w-full py-4 bg-primary hover:bg-indigo-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-indigo-500/30 flex justify-center items-center gap-2 transition-transform hover:scale-[1.02]"
                                        >
                                            <Play size={24} fill="currentColor" /> {isResumable ? t.restartWorkout : t.startWorkout}
                                        </button>
                                    </div>

                                    <div className="space-y-3 pb-8">
                                        <h3 className="font-bold uppercase text-xs text-gray-400 tracking-wider pl-2">{t.exercisesCount}</h3>
                                        {selectedWorkout.exercises.map((ex, idx) => {
                                            const exDef = allExercises.find(e => e.id === ex.exerciseId);
                                            const tImg = exDef?.imageTransform || {x:0, y:0, scale:1};
                                            const sets = Array.isArray(ex.sets) ? ex.sets : [];
                                            const setSummary = sets.map(s => s.type === 'time' ? `${s.value}s` : `${s.value}r`).join(' / ') || 'No sets';
                                            const restLabel = language === 'it' ? 'Recupero' : 'Rest';
                                            
                                            return (
                                                <div key={idx}>
                                                    <div 
                                                        onClick={() => onNavigateToExercise && onNavigateToExercise(ex.exerciseId)}
                                                        className="bg-gray-50 dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700 flex items-center gap-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700/80 transition z-0 relative"
                                                    >
                                                        <div className="w-20 aspect-[4/3] bg-gray-200 dark:bg-slate-700 rounded-lg overflow-hidden flex-shrink-0 relative">
                                                            {exDef?.imageUrl ? (
                                                                <img 
                                                                    src={exDef.imageUrl} 
                                                                    className="w-full h-full object-cover" 
                                                                    alt=""
                                                                    style={{ transform: `translate(${tImg.x}%, ${tImg.y}%) scale(${tImg.scale})`}}
                                                                    onError={(e) => e.currentTarget.style.display = 'none'}
                                                                />
                                                            ) : <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">{idx+1}</div>}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-bold text-base truncate mb-2">{exDef?.name || 'Unknown'}</h4>
                                                            <div className="flex flex-wrap gap-2">
                                                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-600 text-xs font-medium text-gray-600 dark:text-gray-300">
                                                                    {sets.length} {t.sets}
                                                                </span>
                                                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-600 text-xs font-medium text-gray-600 dark:text-gray-300 truncate max-w-[120px]">
                                                                    {setSummary}
                                                                </span>
                                                                {ex.restTime > 0 && (
                                                                    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                                                                        <Clock size={10} /> {ex.restTime}s
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <ChevronRight size={16} className="text-gray-400 flex-shrink-0"/>
                                                    </div>
                                                    
                                                    {/* Rest Tag between exercises */}
                                                    {idx < selectedWorkout.exercises.length - 1 && (ex.restAfterExercise || 0) > 0 && (
                                                        <div className="flex justify-center -mt-2 -mb-5 relative z-10 pointer-events-none">
                                                            <div className="flex items-center gap-2 px-8 py-1.5 rounded-full bg-emerald-50 dark:bg-slate-800 border-2 border-emerald-200 dark:border-slate-600 text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest shadow-sm">
                                                                <Clock size={12} /> 
                                                                <span>{restLabel} {ex.restAfterExercise}s</span>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        </>
                    );
                })()}
            </motion.div>
        )}

        {mode === 'edit' && (
             <motion.div
                key="edit"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-gray-50 dark:bg-dark flex flex-col h-full"
             >
                {/* FIXED HEADER */}
                <div className="flex-none p-4 border-b border-gray-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md flex justify-between items-center shadow-sm">
                    <h2 className="text-xl font-bold truncate">
                        {selectedWorkout ? t.editWorkout : t.newWorkout}
                    </h2>
                    <button onClick={() => selectedWorkout ? setMode('detail') : setMode('list')} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors flex-shrink-0"><X size={24} /></button>
                </div>
                
                {/* SCROLLABLE FORM */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    <div className="space-y-3">
                        <div className="relative w-full aspect-[21/9] bg-gray-200 dark:bg-slate-800 rounded-2xl overflow-hidden border border-gray-300 dark:border-slate-700">
                            <img 
                                src={editingWorkout.coverImage} 
                                className="w-full h-full object-cover" 
                                alt="Cover"
                                style={{ transform: `translate(${coverTransform.x}%, ${coverTransform.y}%) scale(${coverTransform.scale})`}}
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.parentElement?.classList.add('bg-gradient-to-br', 'from-gray-700', 'to-gray-900');
                                }}
                            />
                            <button 
                                onClick={() => setShowCoverEditor(true)}
                                className="absolute bottom-3 right-3 px-4 py-2 bg-white/90 dark:bg-black/60 text-sm font-bold rounded-lg backdrop-blur shadow-sm"
                            >
                                {t.editCover}
                            </button>
                        </div>

                        <input 
                        className="text-2xl font-bold w-full bg-transparent outline-none placeholder-gray-400"
                        placeholder={t.namePlaceholder}
                        value={editingWorkout.name}
                        onChange={e => setEditingWorkout({...editingWorkout, name: e.target.value})}
                        />
                        <input 
                        className="w-full bg-transparent outline-none text-gray-500"
                        placeholder={t.descPlaceholder}
                        value={editingWorkout.description || ''}
                        onChange={e => setEditingWorkout({...editingWorkout, description: e.target.value})}
                        />
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-center">
                            <h3 className="font-semibold text-gray-500 uppercase text-xs tracking-wider">{t.exercisesCount}</h3>
                            <span className="text-xs text-gray-400">{editingWorkout.exercises?.length || 0} items</span>
                        </div>
                        
                        <button 
                            onClick={() => setShowAddExModal(true)}
                            className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl text-gray-500 font-medium flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-800"
                        >
                            <Plus size={20}/> {t.addExercises}
                        </button>

                        <div className="space-y-4 pb-8">
                            {editingWorkout.exercises?.map((wEx, idx) => {
                            const exDef = allExercises.find(e => e.id === wEx.exerciseId);
                            const isLastItem = idx === (editingWorkout.exercises?.length || 0) - 1;
                            
                            return (
                                <div key={wEx.id} className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
                                    <div className="flex justify-between items-start mb-4 border-b border-gray-100 dark:border-slate-700 pb-2">
                                        <div className="font-medium flex items-center gap-2 min-w-0">
                                            <span className="text-gray-400 text-xs flex-shrink-0">#{idx + 1}</span> 
                                            <span className="truncate">{exDef?.name || 'Unknown Exercise'}</span>
                                        </div>
                                        <div className="flex gap-1 flex-shrink-0">
                                            <button onClick={() => moveExercise(idx, -1)} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"><ChevronUp size={16}/></button>
                                            <button onClick={() => moveExercise(idx, 1)} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"><ChevronDown size={16}/></button>
                                            <button onClick={() => removeExerciseFromWorkout(idx)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><X size={16}/></button>
                                        </div>
                                    </div>

                                    <div className="space-y-2 mb-3">
                                        <div className="grid grid-cols-[30px_1fr_1fr_1fr_30px] gap-2 text-[10px] uppercase text-gray-400 text-center">
                                            <div>#</div>
                                            <div>Type</div>
                                            <div>Val</div>
                                            <div>Kg</div>
                                            <div></div>
                                        </div>
                                        {(Array.isArray(wEx.sets) ? wEx.sets : []).map((set, sIdx) => (
                                            <div key={set.id} className="grid grid-cols-[30px_1fr_1fr_1fr_30px] gap-2 items-center">
                                                <div className="text-center text-xs text-gray-400">{sIdx + 1}</div>
                                                <button 
                                                    onClick={() => updateSet(idx, sIdx, 'type', set.type === 'reps' ? 'time' : 'reps')}
                                                    className="text-xs font-bold bg-gray-100 dark:bg-slate-700 p-1 rounded"
                                                >
                                                    {set.type === 'reps' ? t.reps : t.time}
                                                </button>
                                                
                                                <input 
                                                    type="text" 
                                                    inputMode="decimal"
                                                    className="w-full bg-gray-50 dark:bg-slate-900 p-1 rounded text-center" 
                                                    value={set.value === 0 ? '' : set.value}
                                                    onChange={(e) => updateSet(idx, sIdx, 'value', e.target.value)}
                                                    onBlur={(e) => updateSet(idx, sIdx, 'value', Number(e.target.value) || 0)}
                                                    placeholder="0"
                                                />
                                                
                                                <input 
                                                    type="text"
                                                    inputMode="decimal" 
                                                    className="w-full bg-gray-50 dark:bg-slate-900 p-1 rounded text-center" 
                                                    value={set.weight === 0 ? '' : set.weight}
                                                    onChange={(e) => updateSet(idx, sIdx, 'weight', e.target.value)}
                                                    onBlur={(e) => updateSet(idx, sIdx, 'weight', Number(e.target.value) || 0)}
                                                    placeholder="-"
                                                />
                                                <button onClick={() => removeSet(idx, sIdx)} className="text-red-400 hover:text-red-600 flex justify-center"><X size={14}/></button>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-slate-700">
                                        <button onClick={() => addSet(idx)} className="text-xs font-bold text-primary flex items-center gap-1">+ {t.add} Set</button>
                                        
                                        <div className="flex flex-col gap-2 items-end">
                                            <div className="flex items-center gap-2">
                                                <label className="text-[10px] uppercase text-gray-400">{t.restSets}</label>
                                                <div className="relative w-16">
                                                    <input 
                                                        type="text" 
                                                        inputMode="numeric"
                                                        className="w-full bg-gray-50 dark:bg-slate-900 p-1 rounded text-center text-xs"
                                                        value={wEx.restTime === 0 ? '' : wEx.restTime}
                                                        onChange={(e) => {
                                                            const newExs = [...(editingWorkout.exercises||[])];
                                                            const val = e.target.value;
                                                            (newExs[idx] as any).restTime = val;
                                                            setEditingWorkout({...editingWorkout, exercises: newExs});
                                                        }}
                                                        onBlur={(e) => {
                                                            const newExs = [...(editingWorkout.exercises||[])];
                                                            newExs[idx].restTime = Number(e.target.value) || 0;
                                                            setEditingWorkout({...editingWorkout, exercises: newExs});
                                                        }}
                                                        placeholder="0"
                                                    />
                                                </div>
                                            </div>
                                            {!isLastItem && (
                                                <div className="flex items-center gap-2">
                                                    <label className="text-[10px] uppercase text-gray-400">{t.restEnd}</label>
                                                    <div className="relative w-16">
                                                        <input 
                                                            type="text" 
                                                            inputMode="numeric"
                                                            className="w-full bg-gray-50 dark:bg-slate-900 p-1 rounded text-center text-xs"
                                                            value={wEx.restAfterExercise === 0 ? '' : wEx.restAfterExercise}
                                                            onChange={(e) => {
                                                                const newExs = [...(editingWorkout.exercises||[])];
                                                                const val = e.target.value;
                                                                (newExs[idx] as any).restAfterExercise = val;
                                                                setEditingWorkout({...editingWorkout, exercises: newExs});
                                                            }}
                                                            onBlur={(e) => {
                                                                const newExs = [...(editingWorkout.exercises||[])];
                                                                newExs[idx].restAfterExercise = Number(e.target.value) || 0;
                                                                setEditingWorkout({...editingWorkout, exercises: newExs});
                                                            }}
                                                            placeholder="0"
                                                        />
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                            })}
                        </div>
                    </div>
                </div>

                {/* FIXED FOOTER */}
                <div className="flex-none p-4 border-t border-gray-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md">
                    <button onClick={handleSave} className="w-full bg-primary text-white p-4 rounded-xl font-bold shadow-lg hover:bg-indigo-600 transition">{t.saveWorkout}</button>
                </div>
             </motion.div>
        )}

      {showCoverEditor && (
            <div className="fixed inset-0 z-[60] bg-white dark:bg-dark flex flex-col">
                <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between flex-none">
                    <h3 className="font-bold text-lg">{t.editCover}</h3>
                    <button onClick={() => setShowCoverEditor(false)} className="p-2 text-primary font-bold">{tCommon.done}</button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    <div>
                        <div className="flex justify-between items-center text-xs text-gray-500 uppercase mb-2">
                            <span>{tEx.preview}</span>
                            <span className="flex items-center gap-1"><Move size={12}/> {tEx.dragPan}</span>
                        </div>
                        <div 
                            className="w-full aspect-[21/9] bg-black rounded-xl overflow-hidden relative touch-none"
                            onPointerDown={handleCoverPointerDown}
                            onPointerMove={handleCoverPointerMove}
                            onPointerUp={() => {setIsDraggingCover(false); dragStartRef.current = null;}}
                            onPointerLeave={() => {setIsDraggingCover(false); dragStartRef.current = null;}}
                        >
                            <img 
                                src={editingWorkout.coverImage} 
                                className="w-full h-full object-cover pointer-events-none select-none"
                                alt=""
                                style={{ transform: `translate(${coverTransform.x}%, ${coverTransform.y}%) scale(${coverTransform.scale})`}}
                                onError={(e) => {
                                    e.currentTarget.style.display = 'none';
                                    e.currentTarget.parentElement?.classList.add('bg-gradient-to-br', 'from-gray-800', 'to-gray-900');
                                }}
                            />
                        </div>
                        <div className="flex items-center gap-3 pt-3">
                            <ZoomIn size={16} className="text-gray-400"/>
                            <input 
                                type="range" min="1" max="3" step="0.1" 
                                value={coverTransform.scale}
                                onChange={e => setCoverTransform({...coverTransform, scale: parseFloat(e.target.value)})}
                                className="flex-1 accent-primary h-2 bg-gray-200 rounded-lg appearance-none"
                            />
                        </div>
                    </div>

                    <div>
                         <label className="block text-xs font-medium text-gray-500 uppercase mb-1">{t.customUrl}</label>
                         <div className="flex gap-2">
                             <input 
                                value={coverUrlInput}
                                onChange={e => setCoverUrlInput(e.target.value)}
                                placeholder="https://..."
                                className="flex-1 p-3 rounded-xl bg-gray-100 dark:bg-slate-800"
                             />
                             <button onClick={handleCoverPaste} className="px-4 bg-gray-200 dark:bg-slate-700 rounded-xl hover:bg-gray-300 dark:hover:bg-slate-600" type="button"><Clipboard size={20}/></button>
                             <button 
                                onClick={() => {
                                    if(coverUrlInput) {
                                        setEditingWorkout({...editingWorkout, coverImage: coverUrlInput});
                                        setCoverUrlInput('');
                                    }
                                }}
                                className="px-4 font-bold bg-gray-200 dark:bg-slate-700 rounded-xl"
                             >
                                {t.use}
                             </button>
                         </div>
                    </div>

                    <div>
                         <label className="block text-xs font-medium text-gray-500 uppercase mb-2">{t.presets}</label>
                         <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                             {WORKOUT_COVERS.map((url, i) => (
                                 <button 
                                     key={i} 
                                     onClick={() => setEditingWorkout({...editingWorkout, coverImage: url})}
                                     className={`aspect-video rounded-lg overflow-hidden relative border-2 ${editingWorkout.coverImage === url ? 'border-primary' : 'border-transparent'}`}
                                 >
                                     <img 
                                        src={url} 
                                        className="w-full h-full object-cover" 
                                        loading="lazy" 
                                        alt=""
                                        onError={(e) => {
                                            e.currentTarget.style.display = 'none';
                                            e.currentTarget.parentElement?.classList.add('bg-gray-800');
                                        }}
                                     />
                                 </button>
                             ))}
                         </div>
                    </div>
                </div>
            </div>
        )}

        {showAddExModal && (
            // FIXED INSET-0, FLEX COLUMN
            <div className="fixed inset-0 z-[70] bg-white dark:bg-dark flex flex-col h-full">
                 {/* FIXED HEADER */}
                 <div className="flex-none p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-white/95 dark:bg-dark/95 backdrop-blur-md z-10 shadow-sm">
                     <button onClick={() => setShowAddExModal(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full transition-colors flex-shrink-0"><X size={24}/></button>
                     <h3 className="font-bold text-lg truncate">{t.addExercises}</h3>
                     <button 
                        onClick={handleAddSelectedExercises}
                        disabled={exModalSelected.length === 0}
                        className="px-4 py-2 bg-primary text-white rounded-full font-bold disabled:opacity-50 flex-shrink-0"
                     >
                         {t.add} ({exModalSelected.length})
                     </button>
                 </div>
                 
                 {/* FIXED SEARCH & FILTER */}
                 <div className="flex-none p-4 space-y-3 bg-white dark:bg-dark border-b border-gray-100 dark:border-slate-800 z-10">
                     <div className="relative">
                        <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                        <input 
                            value={exModalSearch}
                            onChange={e => setExModalSearch(e.target.value)}
                            placeholder={tEx.searchPlaceholder}
                            className="w-full pl-10 p-3 rounded-xl bg-gray-100 dark:bg-slate-800 border-none outline-none"
                        />
                     </div>
                     <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                         <button 
                            onClick={() => setExModalFilters([])}
                            className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap ${exModalFilters.length === 0 ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-500'}`}
                         >
                             {tEx.muscleAll}
                         </button>
                         {MUSCLE_GROUPS.map(m => {
                             const isActive = exModalFilters.includes(m);
                             return (
                                 <button 
                                    key={m}
                                    onClick={() => toggleExModalFilter(m)}
                                    className={`px-3 py-1 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${isActive ? 'bg-primary text-white shadow-sm' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 border border-transparent'}`}
                                 >
                                     {tMuscles[m as keyof typeof tMuscles] || m}
                                 </button>
                             );
                         })}
                     </div>
                 </div>

                 {/* SCROLLABLE EXERCISE LIST */}
                 <div className="flex-1 overflow-y-auto p-4 space-y-3">
                     {allExercises
                        .filter(e => {
                            const matchesSearch = e.name.toLowerCase().includes(exModalSearch.toLowerCase());
                            // Multi-select logic: show if it matches ANY filter, or ALL if empty
                            const matchesFilter = exModalFilters.length > 0 
                                ? exModalFilters.some(m => e.muscleGroups.includes(m)) 
                                : true;
                            return matchesSearch && matchesFilter;
                        })
                        .map(e => {
                            const isSelected = exModalSelected.includes(e.id);
                            const tImg = e.imageTransform || {x:0, y:0, scale: 1};
                            return (
                                <div 
                                    key={e.id}
                                    onClick={() => {
                                        if(isSelected) setExModalSelected(prev => prev.filter(id => id !== e.id));
                                        else setExModalSelected(prev => [...prev, e.id]);
                                    }}
                                    className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${isSelected ? 'border-primary bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800'}`}
                                >
                                    <div className="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 border-gray-300 dark:border-slate-600">
                                        {isSelected && <div className="w-3 h-3 rounded-full bg-primary"></div>}
                                    </div>
                                    <div className="w-16 aspect-[4/3] bg-gray-200 dark:bg-slate-700 rounded-lg overflow-hidden flex-shrink-0 relative">
                                        {e.imageUrl ? (
                                            <img 
                                                src={e.imageUrl} 
                                                className="w-full h-full object-cover" 
                                                alt=""
                                                style={{ transform: `translate(${tImg.x}%, ${tImg.y}%) scale(${tImg.scale})`}}
                                                onError={(e) => e.currentTarget.style.display = 'none'}
                                            />
                                        ) : <ImageIcon className="text-gray-400 m-auto h-full"/>}
                                    </div>
                                    <div className="min-w-0">
                                        <h4 className="font-bold text-sm truncate">{e.name}</h4>
                                        <p className="text-xs text-gray-500 truncate">
                                            {e.muscleGroups.map(m => tMuscles[m as keyof typeof tMuscles] || m).join(', ')}
                                        </p>
                                    </div>
                                </div>
                            );
                        })
                     }
                     {allExercises.length === 0 && <div className="text-center text-gray-400 p-8">{tEx.noExercises}</div>}
                 </div>
            </div>
        )}

        {workoutToDelete && (
           <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
              <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 dark:border-slate-700 transform transition-all scale-100">
                 <h3 className="font-bold text-xl mb-2">{t.deleteTitle}</h3>
                 <p className="text-gray-500 dark:text-gray-400 mb-6">
                    {tCommon.confirmDelete} <span className="font-bold">"{selectedWorkout?.name}"</span>? {tCommon.cannotUndo}
                 </p>
                 <div className="flex gap-3">
                    <button 
                       onClick={() => setWorkoutToDelete(null)} 
                       className="flex-1 py-3 bg-gray-100 dark:bg-slate-700 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-slate-600"
                    >
                       {tCommon.cancel}
                    </button>
                    <button 
                       onClick={confirmDelete} 
                       className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-500/20"
                    >
                       {tCommon.delete}
                    </button>
                 </div>
              </div>
           </div>
        )}
        </AnimatePresence>
    </div>
  );
};
