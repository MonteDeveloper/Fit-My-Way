
import React, { useState, useEffect, useRef } from 'react';
import { db } from '../services/db';
import { Plus, Search, Pencil, Trash2, ChevronLeft, Image as ImageIcon, Move, ZoomIn, ZoomOut, Clipboard, ChevronRight, Activity, Copy, RotateCcw, Sparkles, X, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { getTranslation } from '../utils/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { TextImportModal } from './TextImportModal';
import { ImageTransform, Language, Exercise, Workout, MUSCLE_GROUPS } from '@/types';
import { parseUniversalData, validateImageUrls, generateAIPrompt } from '../utils/importHelper';

type ViewMode = 'list' | 'detail' | 'edit';

const DEFAULT_TRANSFORM: ImageTransform = { x: 0, y: 0, scale: 1 };

// Animation Variants
const mainModalVariants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
  transition: { duration: 0.2 }
};

const subModalVariants = {
  initial: { opacity: 0, x: -50 }, // Slide in from left
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -50, transition: { duration: 0.2 } }, // Slide out to left
  transition: { duration: 0.2 }
};

interface ExerciseManagerProps {
  initialExerciseId?: string | null;
  onClearPendingId?: () => void;
  onNavigateToWorkout?: (id: string) => void;
  language: Language;
}

interface AlertState {
    isOpen: boolean;
    title: string;
    message: string;
    type: 'success' | 'error' | 'info';
}

export const ExerciseManager: React.FC<ExerciseManagerProps> = ({ 
  initialExerciseId, 
  onClearPendingId,
  onNavigateToWorkout,
  language
}) => {
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [mode, setMode] = useState<ViewMode>('list');
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMuscles, setFilterMuscles] = useState<string[]>([]);
  
  const [workoutSearchTerm, setWorkoutSearchTerm] = useState('');
  const [exerciseToDelete, setExerciseToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Exercise>>({});
  const [transform, setTransform] = useState<ImageTransform>(DEFAULT_TRANSFORM);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{x: number, y: number} | null>(null);

  const [showImportModal, setShowImportModal] = useState(false);
  const [alertState, setAlertState] = useState<AlertState | null>(null);

  const t = getTranslation(language).exercises;
  const tMuscles = getTranslation(language).muscles;
  const tCommon = getTranslation(language).common;
  const tWorkouts = getTranslation(language).workouts;

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (initialExerciseId && exercises.length > 0) {
      const ex = exercises.find(e => e.id === initialExerciseId);
      if (ex) {
        setSelectedExercise(ex);
        setMode('detail');
        if (onClearPendingId) onClearPendingId();
      }
    }
  }, [initialExerciseId, exercises, onClearPendingId]);

  const loadData = async () => {
    const exData = await db.getExercises();
    const wData = await db.getWorkouts();
    setExercises(exData.sort((a, b) => a.name.localeCompare(b.name)));
    setWorkouts(wData);
  };

  const showAlert = (title: string, message: string, type: 'success' | 'error' | 'info') => {
    setAlertState({ isOpen: true, title, message, type });
  };

  const closeAlert = () => {
    setAlertState(null);
  };

  const handleSave = async () => {
    if (!formData.name) return;

    // Check for duplicate name
    const normalizedName = formData.name.trim().toLowerCase();
    const duplicate = exercises.find(e => 
        e.name.trim().toLowerCase() === normalizedName && 
        e.id !== formData.id
    );

    if (duplicate) {
        showAlert("Error", t.duplicateError || "Exercise name already exists.", 'error');
        return;
    }

    const exerciseToSave: Exercise = {
      id: formData.id || crypto.randomUUID(),
      name: formData.name,
      muscleGroups: Array.isArray(formData.muscleGroups) ? formData.muscleGroups : [],
      imageUrl: formData.imageUrl,
      imageTransform: transform,
      notes: formData.notes,
      defaultWeight: formData.defaultWeight || 0,
      defaultRepValue: formData.defaultRepValue || 10,
      defaultSetType: formData.defaultSetType || 'reps',
      defaultRestTime: formData.defaultRestTime || 60,
    };

    await db.saveExercise(exerciseToSave);
    await loadData();
    
    setSelectedExercise(exerciseToSave);
    setMode('detail');
    setFormData({});
  };

  const handleDuplicate = async (exercise: Exercise) => {
    const copy: Exercise = {
      ...exercise,
      id: crypto.randomUUID(),
      name: `${exercise.name} (${tWorkouts.copy})`,
    };
    await db.saveExercise(copy);
    await loadData();
    setSelectedExercise(copy);
    setMode('detail');
  };

  const promptDelete = (id: string) => {
    setExerciseToDelete(id);
  };

  const confirmDelete = async () => {
    if (exerciseToDelete) {
      try {
        await db.deleteExercise(exerciseToDelete);
        await loadData();
        setMode('list');
        setSelectedExercise(null);
      } catch (error) {
        console.error("Delete failed", error);
        showAlert("Error", "Failed to delete exercise", 'error');
      } finally {
        setExerciseToDelete(null);
      }
    }
  };

  const handlePaste = async () => {
    try {
      // Directly replace content, same as GEN AI modal
      const text = await navigator.clipboard.readText();
      if (text) {
        setFormData(prev => ({ ...prev, imageUrl: text }));
      }
    } catch (err) {
      console.error('Clipboard read failed', err);
      showAlert("Error", "Unable to access clipboard automatically. Please check permissions or paste manually.", 'error');
    }
  };

  const handleMassImport = async (jsonText: string) => {
    try {
        // Use universal parser with error throwing and workout duplicate handling
        const { newExercises, newWorkouts } = parseUniversalData(jsonText, exercises, workouts);
        
        // Validate Images concurrently (client-side check)
        const validatedExercises = await validateImageUrls(newExercises);

        let createdSummary = "";

        for (const ex of validatedExercises) {
            await db.saveExercise(ex);
        }
        // Even if in Exercise mode, if the user asked for workouts, save them.
        for (const w of newWorkouts) {
            await db.saveWorkout(w);
        }

        await loadData();
        setShowImportModal(false);

        // Build Summary
        const exList = validatedExercises.length > 0 
            ? validatedExercises.map(e => `• ${e.name}`).join('\n') 
            : tCommon.none;
        const wkList = newWorkouts.length > 0 
            ? newWorkouts.map(w => `• ${w.name}`).join('\n') 
            : tCommon.none;

        createdSummary = `${tCommon.createdExercises}\n${exList}\n\n${tCommon.createdWorkouts}\n${wkList}`;

        showAlert(tCommon.importSummaryTitle, createdSummary, 'success');

    } catch (e: any) {
        console.error(e);
        const errorDetail = e.message || "Unknown error";
        const displayMsg = `${tCommon.jsonError}\n\n${tCommon.jsonErrorHelp}\n${errorDetail}`;
        showAlert("Error", displayMsg, 'error');
    }
  };

  const openCreate = () => {
    setFormData({ 
        muscleGroups: [],
        defaultRepValue: 10,
        defaultSetType: 'reps',
        defaultWeight: 0,
        defaultRestTime: 60
    });
    setTransform(DEFAULT_TRANSFORM);
    setMode('edit');
    setSelectedExercise(null);
  };

  const openEdit = (exercise: Exercise) => {
    setFormData({ 
        ...exercise,
        defaultRepValue: exercise.defaultRepValue || 10,
        defaultSetType: exercise.defaultSetType || 'reps',
        defaultWeight: exercise.defaultWeight || 0,
        defaultRestTime: exercise.defaultRestTime || 60
    });
    setTransform(exercise.imageTransform || DEFAULT_TRANSFORM);
    setMode('edit');
  };

  const openDetail = (exercise: Exercise) => {
    setSelectedExercise(exercise);
    setMode('detail');
    setWorkoutSearchTerm('');
  };

  const toggleMuscle = (muscle: string) => {
    const current = (formData.muscleGroups as string[]) || [];
    if (current.includes(muscle)) {
      setFormData({ ...formData, muscleGroups: current.filter(m => m !== muscle) });
    } else {
      setFormData({ ...formData, muscleGroups: [...current, muscle] });
    }
  };

  const toggleFilter = (muscle: string) => {
    if (filterMuscles.includes(muscle)) {
      setFilterMuscles(filterMuscles.filter(m => m !== muscle));
    } else {
      setFilterMuscles([...filterMuscles, muscle]);
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    e.preventDefault();
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    setTransform(prev => ({
      ...prev,
      x: prev.x + (deltaX * 0.2),
      y: prev.y + (deltaY * 0.2)
    }));
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerUp = () => {
    setIsDragging(false);
    dragStartRef.current = null;
  };

  const filtered = exercises.filter(e => {
    const matchesSearch = e.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterMuscles.length > 0 
      ? filterMuscles.some(m => e.muscleGroups.includes(m))
      : true;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="h-[100dvh] bg-white dark:bg-dark overflow-hidden flex flex-col">
      <AnimatePresence mode="wait" initial={false}>
        {mode === 'list' && (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col h-full"
          >
            <div className="flex-none bg-white/95 dark:bg-dark/95 backdrop-blur-md z-20 px-4 py-3 border-b border-gray-100 dark:border-slate-800 shadow-sm">
                {/* Header Top Row */}
                <div className="flex justify-between items-center mb-3">
                    <h2 className="text-2xl font-bold truncate">{t.title}</h2>
                    <div className="flex gap-2">
                        <button 
                            onClick={() => setShowImportModal(true)}
                            className="w-11 h-11 rounded-full bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 shadow-md hover:shadow-purple-500/40 transition-all hover:scale-105 group p-[2px]"
                            title={tCommon.generateText}
                        >
                            <div className="w-full h-full bg-white dark:bg-slate-800 rounded-full flex items-center justify-center group-hover:bg-white/90 dark:group-hover:bg-slate-800/90 transition-colors">
                                <Sparkles size={24} className="text-indigo-600 dark:text-indigo-400" />
                            </div>
                        </button>
                        <button 
                            onClick={openCreate}
                            className="bg-primary hover:bg-indigo-600 text-white rounded-full shadow-lg transition-all flex-shrink-0 hover:scale-105 w-11 h-11 flex items-center justify-center"
                        >
                            <Plus size={24} />
                        </button>
                    </div>
                </div>

                <div className="space-y-3">
                    {/* Search Bar */}
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

                    {/* Filters Container - Placed BELOW search bar with proper spacing */}
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide snap-x pb-1">
                        <button 
                        onClick={() => setFilterMuscles([])}
                        className={`snap-start px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${filterMuscles.length === 0 ? 'bg-primary text-white' : 'bg-gray-100 dark:bg-slate-800 text-gray-500'}`}
                        >
                        {t.muscleAll}
                        </button>
                        {MUSCLE_GROUPS.map(m => {
                            const isActive = filterMuscles.includes(m);
                            return (
                                <button 
                                    key={m}
                                    onClick={() => toggleFilter(m)}
                                    className={`snap-start px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex-shrink-0 ${isActive ? 'bg-primary text-white shadow-sm' : 'bg-gray-100 dark:bg-slate-800 text-gray-500 border border-transparent'}`}
                                >
                                    {tMuscles[m as keyof typeof tMuscles] || m}
                                </button>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* SCROLLABLE CONTENT */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-24">
                {filtered.map(exercise => {
                const tVal = exercise.imageTransform || DEFAULT_TRANSFORM;
                return (
                    <button 
                    key={exercise.id} 
                    onClick={() => openDetail(exercise)}
                    className="w-full text-left bg-white dark:bg-slate-800 p-3 rounded-xl shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                    <div className="w-20 aspect-[4/3] bg-black rounded-lg overflow-hidden flex-shrink-0 relative">
                        {exercise.imageUrl ? (
                            <img 
                                src={exercise.imageUrl} 
                                alt="" 
                                className="w-full h-full object-contain" 
                                style={{
                                transform: `translate(${tVal.x}%, ${tVal.y}%) scale(${tVal.scale})`,
                                transformOrigin: 'center',
                            }}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100 dark:bg-slate-700">
                                <ImageIcon size={20} />
                            </div>
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg truncate pr-2">{exercise.name}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {exercise.muscleGroups.map(m => tMuscles[m as keyof typeof tMuscles] || m).join(', ')}
                        </p>
                    </div>
                    <div className="text-gray-400 flex-shrink-0">
                        <ChevronLeft size={20} className="rotate-180" />
                    </div>
                    </button>
                );
                })}
                {filtered.length === 0 && (
                <div className="text-center text-gray-400 mt-8">{t.noExercises}</div>
                )}
            </div>
          </motion.div>
        )}

        {mode === 'detail' && selectedExercise && (
          <motion.div
            key="detail"
            {...subModalVariants}
            className="fixed inset-0 z-50 bg-white dark:bg-dark flex flex-col h-full"
          >
            {(() => {
                const tVal = selectedExercise.imageTransform || DEFAULT_TRANSFORM;
                const relatedWorkouts = workouts.filter(w => 
                w.exercises.some(e => e.exerciseId === selectedExercise.id)
                ).filter(w => 
                w.name.toLowerCase().includes(workoutSearchTerm.toLowerCase())
                );

                return (
                    <>
                    {/* Detail Header: Back Left, Title Center, Actions Right */}
                    <div className="flex-none bg-white/95 dark:bg-dark/95 backdrop-blur-md z-20 px-4 py-3 border-b border-gray-100 dark:border-slate-800 grid grid-cols-[auto_1fr_auto] items-center shadow-sm gap-4">
                        <button onClick={() => setMode('list')} className="w-10 h-10 flex items-center justify-center rounded-full -ml-2 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                            <ChevronLeft size={24} />
                        </button>
                        
                        <h2 className="text-xl font-bold truncate text-center">
                            {tCommon.exercise}
                        </h2>
                        
                        <div className="flex gap-2 flex-shrink-0">
                            <button onClick={() => handleDuplicate(selectedExercise)} className="p-2 text-gray-500 hover:text-primary bg-gray-50 dark:bg-slate-800 rounded-full transition-colors">
                                <Copy size={20} />
                            </button>
                            <button onClick={() => openEdit(selectedExercise)} className="p-2 text-gray-500 hover:text-primary bg-gray-50 dark:bg-slate-800 rounded-full transition-colors">
                                <Pencil size={20} />
                            </button>
                            <button onClick={() => promptDelete(selectedExercise.id)} className="p-2 text-gray-500 hover:text-red-500 bg-gray-50 dark:bg-slate-800 rounded-full transition-colors">
                                <Trash2 size={20} />
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white break-words leading-tight">
                        {selectedExercise.name}
                    </h1>

                    <div className="flex flex-wrap gap-2">
                        {selectedExercise.muscleGroups.map(m => (
                        <span key={m} className="px-3 py-1 bg-indigo-100 dark:bg-indigo-900/30 text-primary text-xs font-bold uppercase rounded-full">
                            {tMuscles[m as keyof typeof tMuscles] || m}
                        </span>
                        ))}
                    </div>

                    <div className="w-full aspect-[4/3] bg-black rounded-xl overflow-hidden border border-gray-200 dark:border-slate-700 relative">
                        {selectedExercise.imageUrl ? (
                        <img 
                            src={selectedExercise.imageUrl} 
                            alt={selectedExercise.name} 
                            className="w-full h-full object-contain"
                            style={{
                                transform: `translate(${tVal.x}%, ${tVal.y}%) scale(${tVal.scale})`,
                                transformOrigin: 'center',
                            }}
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                            />
                        ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-400 bg-gray-100 dark:bg-slate-800">
                            <ImageIcon size={48} />
                        </div>
                        )}
                    </div>

                    {selectedExercise.notes && (
                        <div className="bg-yellow-50 dark:bg-yellow-900/10 p-4 rounded-xl border border-yellow-100 dark:border-yellow-900/20">
                        <h3 className="text-sm font-bold text-yellow-700 dark:text-yellow-500 uppercase mb-1">{tCommon.notes}</h3>
                        <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">{selectedExercise.notes}</p>
                        </div>
                    )}

                    <div className="pt-4 border-t border-gray-100 dark:border-slate-800">
                        <h3 className="font-bold text-lg mb-3">{t.appearsIn}</h3>
                        
                        <div className="sticky top-0 z-10 bg-white dark:bg-dark pb-2">
                            <div className="relative">
                                <Search className="absolute left-3 top-3 text-gray-400" size={16} />
                                <input 
                                    className="w-full pl-9 p-2.5 rounded-xl bg-gray-100 dark:bg-slate-800 border-none text-sm outline-none"
                                    placeholder={tCommon.search}
                                    value={workoutSearchTerm}
                                    onChange={e => setWorkoutSearchTerm(e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            {relatedWorkouts.length > 0 ? (
                                relatedWorkouts.map(w => {
                                    const ct = w.coverTransform || { x: 0, y: 0, scale: 1 };
                                    return (
                                        <button 
                                            key={w.id}
                                            onClick={() => onNavigateToWorkout && onNavigateToWorkout(w.id)}
                                            className="w-full text-left bg-gray-50 dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700 flex items-center justify-between hover:bg-gray-100 dark:hover:bg-slate-700 transition group"
                                        >
                                            <div className="flex items-center gap-3 min-w-0">
                                                <div className="w-16 h-10 rounded-lg overflow-hidden relative bg-black flex-shrink-0">
                                                    {w.coverImage ? (
                                                        <img 
                                                            src={w.coverImage} 
                                                            alt="" 
                                                            className="w-full h-full object-contain"
                                                            style={{ transform: `translate(${ct.x}%, ${ct.y}%) scale(${ct.scale})`}}
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = 'none';
                                                                e.currentTarget.parentElement?.classList.add('flex', 'items-center', 'justify-center', 'bg-gray-200');
                                                                if(e.currentTarget.parentElement) e.currentTarget.parentElement.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-gray-400"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>';
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center bg-gray-200 dark:bg-slate-900">
                                                            <Activity size={16} className="text-gray-400"/>
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="font-medium text-sm truncate">{w.name}</span>
                                            </div>
                                            <ChevronRight size={16} className="text-gray-400 group-hover:text-primary transition-colors flex-shrink-0"/>
                                        </button>
                                    );
                                })
                            ) : (
                                <div className="text-center text-gray-400 py-4 text-sm">
                                    {workoutSearchTerm ? t.noMatchingWorkouts : t.notUsed}
                                </div>
                            )}
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
            {...(selectedExercise ? subModalVariants : mainModalVariants)}
            className="fixed inset-0 z-50 bg-white dark:bg-dark flex flex-col h-full"
          >
            {/* Standardized Modal Header */}
            <div className="flex-none bg-white/95 dark:bg-dark/95 backdrop-blur-md z-20 px-4 py-3 border-b border-gray-100 dark:border-slate-800 grid grid-cols-[40px_1fr_40px] items-center shadow-sm">
                <div className="flex justify-start">
                    {selectedExercise && (
                        <button onClick={() => setMode('detail')} className="w-10 h-10 flex items-center justify-center rounded-full -ml-2 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                            <ChevronLeft size={24} />
                        </button>
                    )}
                </div>
                <h2 className="text-xl font-bold truncate text-center">{selectedExercise ? t.editExercise : tCommon.create}</h2>
                <div className="flex justify-end">
                     {!selectedExercise && (
                        <button onClick={() => setMode('list')} className="w-10 h-10 flex items-center justify-center rounded-full -mr-2 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors">
                            <X size={24} />
                        </button>
                     )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">{t.name}</label>
                <input 
                className="w-full p-3 rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent focus:border-primary outline-none"
                value={formData.name || ''}
                onChange={e => setFormData({...formData, name: e.target.value})}
                placeholder={t.namePlaceholder}
                />
            </div>

            <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-2">{t.muscleGroups}</label>
                <div className="flex flex-wrap gap-2">
                {MUSCLE_GROUPS.map(muscle => {
                    const isSelected = (formData.muscleGroups as string[])?.includes(muscle);
                    return (
                    <button
                        key={muscle}
                        onClick={() => toggleMuscle(muscle)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isSelected 
                            ? 'bg-primary text-white shadow-md' 
                            : 'bg-gray-100 dark:bg-slate-800 text-gray-500 hover:bg-gray-200 dark:hover:bg-slate-700'
                        }`}
                    >
                        {tMuscles[muscle as keyof typeof tMuscles] || muscle}
                    </button>
                    );
                })}
                </div>
            </div>

            {/* Default Values Section - Grouped */}
            <div className="bg-gray-50 dark:bg-slate-900/50 rounded-xl p-4 border border-gray-100 dark:border-slate-700 space-y-3">
                <div className="text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-200 dark:border-slate-700 pb-2 mb-2">
                    {t.defaults}
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{t.defWeight}</label>
                        <input 
                            type="number"
                            className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 focus:border-primary outline-none text-sm shadow-sm"
                            value={formData.defaultWeight || ''}
                            onChange={e => setFormData({...formData, defaultWeight: Number(e.target.value)})}
                            placeholder="0"
                        />
                    </div>
                    <div>
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{t.defReps}</label>
                        <div className="flex shadow-sm">
                            <button 
                                onClick={() => setFormData({...formData, defaultSetType: formData.defaultSetType === 'reps' ? 'time' : 'reps'})}
                                className="px-3 bg-gray-100 dark:bg-slate-700 rounded-l-xl font-bold text-[10px] uppercase border-y border-l border-gray-200 dark:border-slate-700 hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                            >
                                {formData.defaultSetType === 'reps' ? tWorkouts.reps : tWorkouts.time}
                            </button>
                            <input 
                                type="number"
                                className="w-full p-3 rounded-r-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 focus:border-primary outline-none text-sm"
                                value={formData.defaultRepValue || ''}
                                onChange={e => setFormData({...formData, defaultRepValue: Number(e.target.value)})}
                                placeholder="10"
                            />
                        </div>
                    </div>
                    <div className="col-span-2">
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">{t.defRest}</label>
                        <input 
                            type="number"
                            className="w-full p-3 rounded-xl bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 focus:border-primary outline-none text-sm shadow-sm"
                            value={formData.defaultRestTime || ''}
                            onChange={e => setFormData({...formData, defaultRestTime: Number(e.target.value)})}
                            placeholder="60"
                        />
                    </div>
                </div>
            </div>

            <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">{t.imageUrl}</label>
                <div className="flex gap-2 mb-2">
                    <div className="relative flex-1">
                         <input 
                            className="w-full p-3 pr-10 rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent focus:border-primary outline-none"
                            value={formData.imageUrl || ''}
                            onChange={e => setFormData({...formData, imageUrl: e.target.value})}
                            placeholder="https://..."
                        />
                    </div>
                   
                    <button
                    onClick={handlePaste}
                    className="px-4 bg-gray-200 dark:bg-slate-700 rounded-xl flex items-center justify-center hover:bg-gray-300 dark:hover:bg-slate-600"
                    title="Paste from Clipboard"
                    type="button"
                    >
                    <Clipboard size={20} />
                    </button>
                    <a 
                        href={`https://www.google.com/search?q=${encodeURIComponent(formData.name || '')}+gif&tbm=isch`}
                        target="_blank"
                        rel="noreferrer"
                        className="p-3 bg-gray-200 dark:bg-slate-700 rounded-xl flex items-center justify-center"
                        title="Search Images"
                    >
                        <Search size={20} />
                    </a>
                </div>
                
                {formData.imageUrl && (
                <div className="space-y-2 p-4 bg-gray-50 dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-700">
                    <div className="flex items-center justify-between text-xs text-gray-500 uppercase">
                        <span>{t.preview}</span>
                        <div className="flex items-center gap-1"><Move size={12}/> {t.dragPan}</div>
                    </div>
                    
                    <div 
                        className="w-full aspect-[4/3] bg-black rounded-lg overflow-hidden relative cursor-move touch-none"
                        onPointerDown={handlePointerDown}
                        onPointerMove={handlePointerMove}
                        onPointerUp={handlePointerUp}
                        onPointerLeave={handlePointerUp}
                    >
                        <img 
                            src={formData.imageUrl} 
                            alt="Preview" 
                            className="w-full h-full object-contain pointer-events-none select-none" 
                            style={{
                                transform: `translate(${transform.x}%, ${transform.y}%) scale(${transform.scale})`,
                                transformOrigin: 'center',
                            }}
                            onError={(e) => e.currentTarget.style.display = 'none'}
                        />
                    </div>

                    <div className="flex items-center gap-3 pt-2 justify-between">
                        <div className="flex items-center gap-2">
                            <button 
                                onClick={() => setTransform(prev => ({ ...prev, scale: Math.max(0.1, prev.scale - 0.1) }))}
                                className="p-2 bg-gray-200 dark:bg-slate-700 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600"
                            >
                                <ZoomOut size={16} />
                            </button>
                            <span className="text-xs text-gray-500 w-12 text-center font-mono">{transform.scale.toFixed(1)}x</span>
                            <button 
                                onClick={() => setTransform(prev => ({ ...prev, scale: prev.scale + 0.1 }))}
                                className="p-2 bg-gray-200 dark:bg-slate-700 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600"
                            >
                                <ZoomIn size={16} />
                            </button>
                        </div>
                        
                        <button 
                            onClick={() => setTransform(DEFAULT_TRANSFORM)}
                            className="p-2 bg-gray-200 dark:bg-slate-700 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-500"
                            title="Reset Transform"
                        >
                            <RotateCcw size={16} />
                        </button>
                    </div>
                </div>
                )}
            </div>

            <div>
                <label className="block text-xs font-medium text-gray-500 uppercase mb-1">{tCommon.notes}</label>
                <textarea 
                className="w-full p-3 rounded-xl bg-gray-100 dark:bg-slate-800 border border-transparent focus:border-primary outline-none"
                value={formData.notes || ''}
                onChange={e => setFormData({...formData, notes: e.target.value})}
                placeholder={t.notesPlaceholder}
                rows={4}
                />
            </div>
            </div>

            <div className="flex-none p-4 border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-dark pb-safe-area">
            <button 
                onClick={handleSave}
                className="w-full p-4 rounded-xl text-white font-bold bg-primary hover:bg-indigo-600 shadow-lg shadow-indigo-500/20"
            >
                {t.saveExercise}
            </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <TextImportModal 
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImport={handleMassImport}
        prompt={generateAIPrompt(language, exercises.map(e => e.name))}
        language={language}
      />

      <AnimatePresence>
        {exerciseToDelete && (
             <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 dark:border-slate-700 transform transition-all"
                >
                   <h3 className="font-bold text-xl mb-2">{t.deleteTitle}</h3>
                   <p className="text-gray-500 dark:text-gray-400 mb-6">
                      {tCommon.confirmDelete} <span className="font-bold">"{exercises.find(e => e.id === exerciseToDelete)?.name}"</span>? {tCommon.cannotUndo}
                   </p>
                   <div className="flex gap-3">
                      <button 
                         onClick={() => setExerciseToDelete(null)} 
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
                className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 dark:border-slate-700 max-h-[80vh] flex flex-col"
            >
                <div className="flex-none flex flex-col items-center text-center mb-4">
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
                </div>

                <div className="flex-1 overflow-y-auto mb-6 w-full text-left">
                    <p className="text-gray-500 dark:text-gray-400 text-sm whitespace-pre-wrap">
                        {alertState.message}
                    </p>
                </div>
                
                <div className="flex-none w-full">
                    <button 
                        onClick={closeAlert} 
                        className="w-full py-3 bg-gray-100 dark:bg-slate-700 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors"
                    >
                        {tCommon.close}
                    </button>
                </div>
            </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
};
