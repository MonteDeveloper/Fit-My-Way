
import React, { useState, useEffect, useRef } from 'react';
import { Workout, Exercise, WorkoutExercise, WORKOUT_COVERS, ActiveSessionState, ImageTransform, MUSCLE_GROUPS, WorkoutSet, Language } from '../../types';
import { db } from '../services/db';
import { Plus, Play, Pencil, Trash2, ChevronUp, ChevronDown, X, ChevronLeft, Search, Copy, Clock, Dumbbell, Image as ImageIcon, Move, ZoomIn, ZoomOut, RotateCw, Clipboard, ChevronRight, Activity, RotateCcw, Check, FileText, Sparkles, AlertCircle, CheckCircle, Info } from 'lucide-react';
import { getTranslation } from '../utils/i18n';
import { AnimatePresence, motion } from 'framer-motion';
import { TextImportModal } from './TextImportModal';
import { generateAIPrompt, parseUniversalData, validateImageUrls } from '../utils/importHelpers';
import { OptimizedImage } from './OptimizedImage';
import { useModalRegistry } from '../contexts/ModalContext';
import { SearchBar } from './Searchbar';

interface WorkoutManagerProps {
  onStartWorkout: (workout: Workout, resume?: boolean) => void;
  initialWorkoutId?: string | null;
  onClearPendingId?: () => void;
  onNavigateToExercise?: (id: string) => void;
  language: Language;
  onViewModeChange?: (isList: boolean) => void;
}

type ViewMode = "list" | "detail" | "edit";
const DEFAULT_COVER_TRANSFORM: ImageTransform = { x: 0, y: 0, scale: 1 };

const listVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, x: 0, scale: 1, zIndex: 0, transition: { duration: 0.2 } },
  exit: { opacity: 0.5, scale: 0.98, x: '-5%', zIndex: 0, transition: { duration: 0.2 } }
};

const detailVariants = {
  initial: { x: '100%', opacity: 0, zIndex: 20 },
  animate: { 
      x: '0%', 
      opacity: 1, 
      zIndex: 20, 
      transition: { type: 'tween', ease: 'easeInOut', duration: 0.3 }
  },
  exit: { 
      x: '100%', 
      opacity: 0, 
      zIndex: 20, 
      transition: { type: 'tween', ease: 'easeInOut', duration: 0.3 }
  }
};

interface AlertState {
  isOpen: boolean;
  title: string;
  message: string;
  type: "success" | "error" | "info";
}

const AutoResizeTextarea = ({ value, onChange, placeholder, className, style, rows = 1 }: any) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className={className}
      style={{ ...style, resize: 'none', overflow: 'hidden' }}
      rows={rows}
    />
  );
};

export const WorkoutManager: React.FC<WorkoutManagerProps> = ({
  onStartWorkout,
  initialWorkoutId,
  onClearPendingId,
  onNavigateToExercise,
  language,
  onViewModeChange
}) => {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [allExercises, setAllExercises] = useState<Exercise[]>([]);
  const [activeSession, setActiveSession] = useState<
    ActiveSessionState | undefined
  >(undefined);

  const [mode, setMode] = useState<ViewMode>("list");
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [editingWorkout, setEditingWorkout] = useState<Partial<Workout>>({});
  const [searchTerm, setSearchTerm] = useState("");

  const [workoutToDelete, setWorkoutToDelete] = useState<string | null>(null);

  const [showAddExModal, setShowAddExModal] = useState(false);
  const [showCoverEditor, setShowCoverEditor] = useState(false);

  const [showImportModal, setShowImportModal] = useState(false);
  const [alertState, setAlertState] = useState<AlertState | null>(null);

  const [exModalSearch, setExModalSearch] = useState("");
  const [exModalSelected, setExModalSelected] = useState<string[]>([]);
  const [exModalFilters, setExModalFilters] = useState<string[]>([]);

  const [coverUrlInput, setCoverUrlInput] = useState("");
  const [coverTransform, setCoverTransform] = useState<ImageTransform>(
    DEFAULT_COVER_TRANSFORM
  );
  const [isDraggingCover, setIsDraggingCover] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const [isTitleExpanded, setIsTitleExpanded] = useState(false);

  const t = getTranslation(language).workouts;
  const tMuscles = getTranslation(language).muscles;
  const tCommon = getTranslation(language).common;
  const tEx = getTranslation(language).exercises;

  useModalRegistry(showImportModal);
  useModalRegistry(!!workoutToDelete);
  useModalRegistry(showCoverEditor);
  useModalRegistry(showAddExModal);
  useModalRegistry(!!alertState);

  useEffect(() => {
    if (onViewModeChange) {
        onViewModeChange(mode === 'list');
    }
  }, [mode, onViewModeChange]);

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    if (initialWorkoutId && workouts.length > 0) {
      const w = workouts.find((wk) => wk.id === initialWorkoutId);
      if (w) {
        setSelectedWorkout(w);
        setMode("detail");
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

  const showAlert = (
    title: string,
    message: string,
    type: "success" | "error" | "info"
  ) => {
    setAlertState({ isOpen: true, title, message, type });
  };

  const closeAlert = () => {
    setAlertState(null);
  };

  const handleCreateNew = () => {
    const randomCover =
      WORKOUT_COVERS[Math.floor(Math.random() * WORKOUT_COVERS.length)];
    setSelectedWorkout(null);
    setEditingWorkout({
      id: crypto.randomUUID(),
      name: "",
      coverImage: randomCover,
      coverTransform: DEFAULT_COVER_TRANSFORM,
      exercises: [],
      createdAt: Date.now(),
    });
    setMode("edit");
  };

  const handleMassImport = async (jsonText: string) => {
    try {
      const { newExercises, newWorkouts } = parseUniversalData(jsonText, allExercises, workouts);
      const validatedExercises = await validateImageUrls(newExercises);
      for (const ex of validatedExercises) {
          await db.saveExercise(ex);
      }
      for (const w of newWorkouts) {
          if (!w.coverImage) {
             w.coverImage = WORKOUT_COVERS[Math.floor(Math.random() * WORKOUT_COVERS.length)];
          }
          await db.saveWorkout(w);
      }
      await refreshData();
      setShowImportModal(false);
      const exList = validatedExercises.length > 0 ? validatedExercises.map(e => `• ${e.name}`).join('\n') : tCommon.none;
      const wkList = newWorkouts.length > 0 ? newWorkouts.map(w => `• ${w.name}`).join('\n') : tCommon.none;
      const createdSummary = `${tCommon.createdExercises}\n${exList}\n\n${tCommon.createdWorkouts}\n${wkList}`;
      showAlert(tCommon.importSummaryTitle, createdSummary, 'success');
    } catch (e: any) {
      console.error(e);
      const errorDetail = e.message || "Unknown error";
      const displayMsg = `${tCommon.jsonError}\n\n${tCommon.jsonErrorHelp}\n${errorDetail}`;
      showAlert("Error", displayMsg, 'error');
    }
  };

  const handleEdit = (workout: Workout) => {
    setEditingWorkout(JSON.parse(JSON.stringify(workout)));
    setCoverTransform(workout.coverTransform || DEFAULT_COVER_TRANSFORM);
    setMode("edit");
  };

  const handleDuplicate = async (workout: Workout) => {
    const copy: Workout = {
      ...workout,
      id: crypto.randomUUID(),
      name: `${workout.name} (${t.copy})`,
      createdAt: Date.now(),
      exercises: workout.exercises.map((e) => ({
        ...e,
        id: crypto.randomUUID(),
        sets: e.sets.map((s) => ({ ...s, id: crypto.randomUUID() })),
      })),
    };
    await db.saveWorkout(copy);
    await refreshData();
    setSelectedWorkout(copy);
    setMode("detail");
  };

  const promptDelete = (id: string) => {
    setWorkoutToDelete(id);
  };

  const confirmDelete = async () => {
    if (workoutToDelete) {
      try {
        // CLEANUP: If there is an active session for this workout, clear it.
        const currentSession = await db.getActiveSession();
        if (currentSession && currentSession.workoutId === workoutToDelete) {
           await db.clearActiveSession();
        }

        await db.deleteWorkout(workoutToDelete);
        await refreshData();
        setMode("list");
        setSelectedWorkout(null);
      } catch (e) {
        showAlert("Error", "Error deleting workout", "error");
      } finally {
        setWorkoutToDelete(null);
      }
    }
  };

  const handleSave = async () => {
    if (!editingWorkout.name) {
      showAlert("Error", "Name required", "error");
      return;
    }
    const sanitizedExercises =
      editingWorkout.exercises?.map((ex) => ({
        ...ex,
        restTime: Number(ex.restTime) || 0,
        restAfterExercise: Number(ex.restAfterExercise) || 0,
        sets: ex.sets.map((s) => ({
          ...s,
          value: Number(s.value) || 0,
          weight: Number(s.weight) || 0,
        })),
      })) || [];
    const finalWorkout: Workout = {
      ...(editingWorkout as Workout),
      exercises: sanitizedExercises,
      coverTransform: coverTransform,
    };
    await db.saveWorkout(finalWorkout);
    await refreshData();
    const saved = await db.getWorkouts().then((res) => res.find((w) => w.id === finalWorkout.id));
    if (saved) {
      setSelectedWorkout(saved);
      setMode("detail");
    } else {
      setMode("list");
    }
  };

  const handleAddSelectedExercises = () => {
    const newItems: WorkoutExercise[] = exModalSelected.map((id) => {
      const exDef = allExercises.find((e) => e.id === id);
      const defVal = exDef?.defaultRepValue || 10;
      const defType = exDef?.defaultSetType || "reps";
      const defWeight = exDef?.defaultWeight || 0;
      const defRest = exDef?.defaultRestTime || 60;
      return {
        id: crypto.randomUUID(),
        exerciseId: id,
        sets: Array.from({ length: 3 }).map(() => ({
          id: crypto.randomUUID(),
          type: defType,
          value: defVal,
          weight: defWeight,
        })),
        restTime: defRest,
        restAfterExercise: 60,
      };
    });
    setEditingWorkout((prev) => ({
      ...prev,
      exercises: [...(prev.exercises || []), ...newItems],
    }));
    setExModalSelected([]);
    setShowAddExModal(false);
  };

  const removeExerciseFromWorkout = (idx: number) => {
    const newEx = [...(editingWorkout.exercises || [])];
    newEx.splice(idx, 1);
    setEditingWorkout({ ...editingWorkout, exercises: newEx });
  };

  const moveExercise = (idx: number, dir: number) => {
    const items = [...(editingWorkout.exercises || [])];
    if (idx + dir < 0 || idx + dir >= items.length) return;
    [items[idx], items[idx + dir]] = [items[idx + dir], items[idx]];
    setEditingWorkout({ ...editingWorkout, exercises: items });
  };

  const addSet = (exerciseIdx: number) => {
    const newExs = [...(editingWorkout.exercises || [])];
    const lastSet = newExs[exerciseIdx].sets[newExs[exerciseIdx].sets.length - 1];
    newExs[exerciseIdx].sets.push({
      id: crypto.randomUUID(),
      type: lastSet ? lastSet.type : "reps",
      value: lastSet ? lastSet.value : 10,
      weight: lastSet ? lastSet.weight : 0,
    });
    setEditingWorkout({ ...editingWorkout, exercises: newExs });
  };

  const removeSet = (exerciseIdx: number, setIdx: number) => {
    const newExs = [...(editingWorkout.exercises || [])];
    if (newExs[exerciseIdx].sets.length > 1) {
      newExs[exerciseIdx].sets.splice(setIdx, 1);
      setEditingWorkout({ ...editingWorkout, exercises: newExs });
    }
  };

  const updateSet = (
    exerciseIdx: number,
    setIdx: number,
    field: keyof WorkoutSet,
    value: any
  ) => {
    const newExs = [...(editingWorkout.exercises || [])];
    newExs[exerciseIdx].sets[setIdx] = {
      ...newExs[exerciseIdx].sets[setIdx],
      [field]: value,
    };
    setEditingWorkout({ ...editingWorkout, exercises: newExs });
  };

  const handleCoverPaste = async () => {
    try {
      setCoverUrlInput("");
      const text = await navigator.clipboard.readText();
      if (text) setCoverUrlInput(text);
    } catch (err) {
      showAlert("Error", "Clipboard access denied. Paste manually.", "error");
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
    setCoverTransform((prev) => ({
      ...prev,
      x: prev.x + deltaX * 0.15,
      y: prev.y + deltaY * 0.15,
    }));
    dragStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const toggleExModalFilter = (muscle: string) => {
    if (exModalFilters.includes(muscle)) {
      setExModalFilters(exModalFilters.filter((m) => m !== muscle));
    } else {
      setExModalFilters([...exModalFilters, muscle]);
    }
  };

  const filteredWorkouts = workouts.filter((w) =>
    w.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="h-[100dvh] bg-white dark:bg-dark overflow-hidden flex flex-col relative w-full">
      <AnimatePresence initial={false}>
        {mode === "list" && (
          <motion.div
            key="list"
            variants={listVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute inset-0 w-full h-full flex flex-col bg-white dark:bg-dark"
          >
            <div className="flex-none bg-white/95 dark:bg-dark/95 backdrop-blur-md z-20 px-4 py-3 border-b border-gray-100 dark:border-slate-800 shadow-sm">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-2xl font-bold truncate">{t.title}</h2>
                <div className="flex gap-2 flex-shrink-0">
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="w-11 h-11 rounded-full bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 shadow-md hover:shadow-purple-500/40 transition-all hover:scale-105 group p-[2px]"
                    title={tCommon.generateText}
                  >
                    <div className="w-full h-full bg-white dark:bg-slate-800 rounded-full flex items-center justify-center group-hover:bg-white/90 dark:group-hover:bg-slate-800/90 transition-colors">
                      <Sparkles
                        size={24}
                        className="text-indigo-600 dark:text-indigo-400"
                      />
                    </div>
                  </button>
                  <button
                    onClick={handleCreateNew}
                    className="bg-primary hover:bg-indigo-600 text-white rounded-full shadow-lg transition-all hover:scale-105 w-11 h-11 flex items-center justify-center"
                  >
                    <Plus size={24} />
                  </button>
                </div>
              </div>
              <SearchBar 
                value={searchTerm} 
                onChange={setSearchTerm} 
                placeholder={t.searchPlaceholder} 
              />
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24">
              {activeSession && (
                <div
                  onClick={() => {
                    const w = workouts.find((w) => w.id === activeSession.workoutId);
                    if (w) onStartWorkout(w, true);
                  }}
                  className="bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-900/50 p-4 rounded-xl flex items-center justify-between cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-bold text-primary uppercase mb-1">
                      {t.activeSession}
                    </div>
                    <div className="font-bold truncate max-w-[200px]">
                      {t.resumeSession}
                    </div>
                  </div>
                  <div className="bg-primary text-white p-2 rounded-full flex-shrink-0">
                    <RotateCw size={20} />
                  </div>
                </div>
              )}
              {filteredWorkouts.map((workout) => {
                const estimatedTime =
                  workout.exercises.reduce((acc, ex) => {
                    const sets = Array.isArray(ex.sets) ? ex.sets : [];
                    return acc + sets.length * (30 + (ex.restTime || 0));
                  }, 0) / 60;
                const ct = workout.coverTransform || DEFAULT_COVER_TRANSFORM;
                return (
                  <div
                    key={workout.id}
                    onClick={() => {
                      setSelectedWorkout(workout);
                      setMode("detail");
                      setIsTitleExpanded(false);
                    }}
                    className="relative w-full aspect-[21/9] bg-gray-200 dark:bg-gray-800 rounded-2xl overflow-hidden shadow-md cursor-pointer group"
                    style={{ contentVisibility: 'auto', containIntrinsicSize: '160px' }}
                  >
                    {workout.coverImage ? (
                      <div className="absolute inset-0 z-10">
                        <OptimizedImage
                            src={workout.coverImage}
                            alt={workout.name}
                            className="w-full h-full"
                            style={{
                                transform: `translate(${ct.x}%, ${ct.y}%) scale(${ct.scale})`,
                                transformOrigin: "center",
                            }}
                        />
                      </div>
                    ) : (
                       <div className="absolute inset-0 flex items-center justify-center text-gray-400 bg-gray-200 dark:bg-gray-800">
                           <Activity size={48} />
                       </div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-br from-transparent to-black/50 pointer-events-none z-20"></div>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent pointer-events-none z-20"></div>
                    <div className="absolute bottom-0 left-0 p-4 text-white w-full z-30">
                      <h3 className="font-bold text-xl leading-tight mb-1 truncate pr-4">
                        {workout.name}
                      </h3>
                      <div className="flex items-center gap-3 text-xs font-medium text-gray-300">
                        <span className="flex items-center gap-1">
                          <Dumbbell size={12} /> {workout.exercises.length}{" "}
                          {t.exercisesCount}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> ~{Math.round(estimatedTime)}{" "}
                          {t.estimatedTime}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredWorkouts.length === 0 && (
                <div className="text-center text-gray-400 py-10">
                  {t.noWorkouts}
                </div>
              )}
            </div>
          </motion.div>
        )}
        {mode === "detail" && selectedWorkout && (
          <motion.div
            key="detail"
            variants={detailVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute inset-0 z-20 bg-white dark:bg-dark flex flex-col h-full"
          >
            {(() => {
              const estimatedTime =
                selectedWorkout.exercises.reduce((acc, ex) => {
                  const sets = Array.isArray(ex.sets) ? ex.sets : [];
                  return acc + sets.length * (30 + (ex.restTime || 0));
                }, 0) / 60;
              const ct = selectedWorkout.coverTransform || DEFAULT_COVER_TRANSFORM;
              const isResumable = activeSession?.workoutId === selectedWorkout.id;
              return (
                <>
                  <div className="flex-none z-50 bg-white/95 dark:bg-dark/95 backdrop-blur-md border-b border-gray-100 dark:border-slate-800 px-4 py-3 grid grid-cols-[auto_1fr_auto] items-center shadow-sm gap-4">
                    <button
                      onClick={() => setMode("list")}
                      className="w-10 h-10 flex items-center justify-center rounded-full -ml-2 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                    >
                      <ChevronLeft size={24} />
                    </button>
                    <h2 className="font-bold text-lg truncate text-center">
                      {tCommon.workout}
                    </h2>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => handleDuplicate(selectedWorkout)}
                        className="p-2 text-gray-500 hover:text-primary bg-gray-50 dark:bg-slate-800 rounded-full transition-colors"
                      >
                        <Copy size={20} />
                      </button>
                      <button
                        onClick={() => handleEdit(selectedWorkout)}
                        className="p-2 text-gray-500 hover:text-primary bg-gray-50 dark:bg-slate-800 rounded-full transition-colors"
                      >
                        <Pencil size={20} />
                      </button>
                      <button
                        onClick={() => promptDelete(selectedWorkout.id)}
                        className="p-2 text-gray-500 hover:text-red-500 bg-gray-50 dark:bg-slate-800 rounded-full transition-colors"
                      >
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
                    <div className="relative w-full aspect-[21/9] overflow-hidden bg-gray-200 dark:bg-gray-800">
                      <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                          <Activity size={64} />
                      </div>
                      {selectedWorkout.coverImage && (
                        <div className="absolute inset-0 z-10">
                         <img
                          src={selectedWorkout.coverImage}
                          className="w-full h-full object-contain"
                          alt="Cover"
                          style={{
                            transform: `translate(${ct.x}%, ${ct.y}%) scale(${ct.scale})`,
                            transformOrigin: "center",
                          }}
                          onError={(e) => e.currentTarget.style.display = 'none'}
                        />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent pointer-events-none z-20"></div>
                      <div className="absolute bottom-0 left-0 p-6 text-white z-30 w-full">
                        <h1
                          onClick={() => setIsTitleExpanded(!isTitleExpanded)}
                          className={`text-3xl font-black mb-2 leading-tight cursor-pointer ${isTitleExpanded ? "whitespace-normal" : "truncate"}`}
                          title="Tap to expand"
                        >
                          {selectedWorkout.name}
                        </h1>
                        {selectedWorkout.description && (
                          <p className="text-gray-200 text-sm line-clamp-2">
                            {selectedWorkout.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="p-4 space-y-6 relative z-40 bg-white dark:bg-dark rounded-t-3xl -mt-4 min-h-[calc(100vh-16rem)] shadow-2xl">
                      <div className="flex justify-between items-center px-2">
                        <div className="flex gap-4">
                          <div className="flex items-center gap-2 text-sm font-semibold text-gray-500">
                            <Dumbbell size={16} />{" "}
                            {selectedWorkout.exercises.length}{" "}
                            {t.exercisesCount}
                          </div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-gray-500">
                            <Clock size={16} /> ~{Math.round(estimatedTime)}{" "}
                            {t.estimatedTime}
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
                          <Play size={24} fill="currentColor" />{" "}
                          {isResumable ? t.restartWorkout : t.startWorkout}
                        </button>
                      </div>
                      <div className="space-y-3 pb-8">
                        <h3 className="font-bold uppercase text-xs text-gray-400 tracking-wider pl-2">
                          {t.exercisesCount}
                        </h3>
                        {selectedWorkout.exercises.map((ex, idx) => {
                          const exDef = allExercises.find((e) => e.id === ex.exerciseId);
                          const tImg = exDef?.imageTransform || { x: 0, y: 0, scale: 1 };
                          const sets = Array.isArray(ex.sets) ? ex.sets : [];
                          const setSummary = sets.map((s) => s.type === "time" ? `${s.value}s` : `${s.value}r`).join(" / ") || "No sets";
                          const restLabel = language === "it" ? "Recupero" : "Rest";
                          return (
                            <div key={idx}>
                              <div
                                onClick={() => onNavigateToExercise && onNavigateToExercise(ex.exerciseId)}
                                className="bg-gray-50 dark:bg-slate-800 p-3 rounded-xl border border-gray-100 dark:border-slate-700 flex items-center gap-4 cursor-pointer hover:bg-gray-100 dark:hover:bg-slate-700/80 transition z-0 relative"
                              >
                                <div className="w-20 aspect-[4/3] bg-black rounded-lg overflow-hidden flex-shrink-0 relative">
                                  {exDef?.imageUrl ? (
                                    <OptimizedImage
                                      src={exDef.imageUrl}
                                      className="w-full h-full"
                                      alt=""
                                      style={{ transform: `translate(${tImg.x}%, ${tImg.y}%) scale(${tImg.scale})` }}
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-xs text-gray-500 bg-gray-200 dark:bg-slate-900">
                                      {idx + 1}
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-bold text-base truncate mb-2">
                                    {exDef?.name || "Unknown"}
                                  </h4>
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
                                <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                              </div>
                              {idx < selectedWorkout.exercises.length - 1 && (ex.restAfterExercise || 0) > 0 && (
                                  <div className="flex justify-center -mt-2 -mb-5 relative z-10 pointer-events-none">
                                    <div className="flex items-center gap-2 px-8 py-1.5 rounded-full bg-emerald-50 dark:bg-slate-800 border-2 border-emerald-200 dark:border-slate-600 text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest shadow-sm">
                                      <Clock size={12} />
                                      <span>
                                        {restLabel} {ex.restAfterExercise}s
                                      </span>
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
        {mode === "edit" && (
          <motion.div
            key="edit"
            variants={detailVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="absolute inset-0 z-50 bg-gray-50 dark:bg-dark flex flex-col h-full"
          >
            <div className="flex-none p-4 border-b border-gray-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md grid grid-cols-[40px_1fr_40px] items-center shadow-sm">
              <div className="flex justify-start">
                {selectedWorkout && (
                  <button
                    onClick={() => setMode("detail")}
                    className="w-10 h-10 flex items-center justify-center rounded-full -ml-2 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <ChevronLeft size={24} />
                  </button>
                )}
              </div>
              <h2 className="text-xl font-bold truncate text-center">
                {selectedWorkout ? t.editWorkout : t.newWorkout}
              </h2>
              <div className="flex justify-end">
                {!selectedWorkout && (
                  <button
                    onClick={() => setMode("list")}
                    className="w-10 h-10 flex items-center justify-center rounded-full -mr-2 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    <X size={24} />
                  </button>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6 pb-safe-area">
              <div className="space-y-3">
                <div className="relative w-full aspect-[21/9] bg-gray-200 dark:bg-gray-800 rounded-2xl overflow-hidden border border-gray-300 dark:border-slate-700">
                  <div className="absolute inset-0 flex items-center justify-center text-gray-400">
                      <Activity size={48} />
                  </div>
                  <img
                    key={editingWorkout.coverImage}
                    src={editingWorkout.coverImage}
                    className="w-full h-full object-contain absolute inset-0 bg-black z-10"
                    alt="Cover"
                    style={{
                      transform: `translate(${coverTransform.x}%, ${coverTransform.y}%) scale(${coverTransform.scale})`,
                      transformOrigin: "center",
                    }}
                    onError={(e) => e.currentTarget.style.display = 'none'}
                  />
                  <button
                    onClick={() => setShowCoverEditor(true)}
                    className="absolute bottom-3 right-3 px-4 py-2 bg-white/90 dark:bg-black/60 text-sm font-bold rounded-lg backdrop-blur shadow-sm z-20"
                  >
                    {t.editCover}
                  </button>
                </div>
                <AutoResizeTextarea
                  className="text-2xl font-bold w-full bg-transparent outline-none placeholder-gray-400"
                  placeholder={t.namePlaceholder}
                  value={editingWorkout.name}
                  onChange={(e: any) => setEditingWorkout({ ...editingWorkout, name: e.target.value })}
                />
                <AutoResizeTextarea
                  className="w-full bg-transparent outline-none text-gray-500"
                  placeholder={t.descPlaceholder}
                  value={editingWorkout.description || ""}
                  onChange={(e: any) => setEditingWorkout({ ...editingWorkout, description: e.target.value })}
                />
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-gray-500 uppercase text-xs tracking-wider">
                    {t.exercisesCount}
                  </h3>
                  <span className="text-xs text-gray-400">
                    {editingWorkout.exercises?.length || 0} items
                  </span>
                </div>
                <button
                  onClick={() => setShowAddExModal(true)}
                  className="w-full py-3 border-2 border-dashed border-gray-300 dark:border-slate-700 rounded-xl text-gray-500 font-medium flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-800"
                >
                  <Plus size={20} /> {t.addExercises}
                </button>
                <div className="space-y-4 pb-8">
                  {editingWorkout.exercises?.map((wEx, idx) => {
                    const exDef = allExercises.find((e) => e.id === wEx.exerciseId);
                    const isLastItem = idx === (editingWorkout.exercises?.length || 0) - 1;
                    return (
                      <div
                        key={wEx.id}
                        className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm"
                      >
                        <div className="flex justify-between items-start mb-4 border-b border-gray-100 dark:border-slate-700 pb-2">
                          <div className="font-medium flex items-center gap-2 min-w-0">
                            <span className="text-gray-400 text-xs flex-shrink-0">
                              #{idx + 1}
                            </span>
                            <span className="truncate">
                              {exDef?.name || "Unknown Exercise"}
                            </span>
                          </div>
                          <div className="flex gap-1 flex-shrink-0">
                            <button onClick={() => moveExercise(idx, -1)} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"><ChevronUp size={16} /></button>
                            <button onClick={() => moveExercise(idx, 1)} className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"><ChevronDown size={16} /></button>
                            <button onClick={() => removeExerciseFromWorkout(idx)} className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><X size={16} /></button>
                          </div>
                        </div>
                        <div className="space-y-2 mb-3">
                          <div className="grid grid-cols-[30px_1fr_1fr_1fr_30px] gap-2 text-[10px] uppercase text-gray-400 text-center">
                            <div>#</div><div>Type</div><div>Val</div><div>Kg</div><div></div>
                          </div>
                          {(Array.isArray(wEx.sets) ? wEx.sets : []).map((set, sIdx) => (
                              <div key={set.id} className="grid grid-cols-[30px_1fr_1fr_1fr_30px] gap-2 items-center">
                                <div className="text-center text-xs text-gray-400">{sIdx + 1}</div>
                                <button onClick={() => updateSet(idx, sIdx, "type", set.type === "reps" ? "time" : "reps")} className="text-xs font-bold bg-gray-100 dark:bg-slate-700 p-1 rounded">
                                  {set.type === "reps" ? t.reps : t.time}
                                </button>
                                <input type="text" inputMode="decimal" className="w-full bg-gray-50 dark:bg-slate-900 p-1 rounded text-center" value={set.value === 0 ? "" : set.value} onChange={(e) => updateSet(idx, sIdx, "value", e.target.value)} onBlur={(e) => updateSet(idx, sIdx, "value", Number(e.target.value) || 0)} placeholder="0" />
                                <input type="text" inputMode="decimal" className="w-full bg-gray-50 dark:bg-slate-900 p-1 rounded text-center" value={set.weight === 0 ? "" : set.weight} onChange={(e) => updateSet(idx, sIdx, "weight", e.target.value)} onBlur={(e) => updateSet(idx, sIdx, "weight", Number(e.target.value) || 0)} placeholder="-" />
                                <button onClick={() => removeSet(idx, sIdx)} className="text-red-400 hover:text-red-600 flex justify-center"><X size={14} /></button>
                              </div>
                            )
                          )}
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-slate-700">
                          <button onClick={() => addSet(idx)} className="text-xs font-bold text-primary flex items-center gap-1">+ {t.add} Set</button>
                          <div className="flex flex-col gap-2 items-end">
                            <div className="flex items-center gap-2">
                              <label className="text-[10px] uppercase text-gray-400">{t.restSets}</label>
                              <div className="relative w-16">
                                <input type="text" inputMode="numeric" className="w-full bg-gray-50 dark:bg-slate-900 p-1 rounded text-center text-xs" value={wEx.restTime === 0 ? "" : wEx.restTime} onChange={(e) => { const newExs = [...(editingWorkout.exercises || [])]; (newExs[idx] as any).restTime = e.target.value; setEditingWorkout({ ...editingWorkout, exercises: newExs }); }} onBlur={(e) => { const newExs = [...(editingWorkout.exercises || [])]; newExs[idx].restTime = Number(e.target.value) || 0; setEditingWorkout({ ...editingWorkout, exercises: newExs }); }} placeholder="0" />
                              </div>
                            </div>
                            {!isLastItem && (
                              <div className="flex items-center gap-2">
                                <label className="text-[10px] uppercase text-gray-400">{t.restEnd}</label>
                                <div className="relative w-16">
                                  <input type="text" inputMode="numeric" className="w-full bg-gray-50 dark:bg-slate-900 p-1 rounded text-center text-xs" value={wEx.restAfterExercise === 0 ? "" : wEx.restAfterExercise} onChange={(e) => { const newExs = [...(editingWorkout.exercises || [])]; (newExs[idx] as any).restAfterExercise = e.target.value; setEditingWorkout({ ...editingWorkout, exercises: newExs }); }} onBlur={(e) => { const newExs = [...(editingWorkout.exercises || [])]; newExs[idx].restAfterExercise = Number(e.target.value) || 0; setEditingWorkout({ ...editingWorkout, exercises: newExs }); }} placeholder="0" />
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
            <div className="flex-none p-4 border-t border-gray-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md pb-safe-area">
              <button onClick={handleSave} className="w-full bg-primary text-white p-4 rounded-xl font-bold shadow-lg hover:bg-indigo-600 transition">{t.saveWorkout}</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
        <TextImportModal isOpen={showImportModal} onClose={() => setShowImportModal(false)} onImport={handleMassImport} prompt={generateAIPrompt(language, allExercises.map((e) => e.name))} language={language} />
        <AnimatePresence>
          {showCoverEditor && (
            <motion.div key="coverEditor" variants={detailVariants} initial="initial" animate="animate" exit="exit" className="fixed inset-0 z-[60] bg-white dark:bg-dark flex flex-col h-full">
               <div className="p-4 border-b border-gray-100 dark:border-slate-800 grid grid-cols-[40px_1fr_40px] items-center shadow-sm flex-none">
                <button onClick={() => setShowCoverEditor(false)} className="w-10 h-10 flex items-center justify-center rounded-full -ml-2 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"><ChevronLeft size={24} /></button>
                <h3 className="font-bold text-lg text-center">{t.editCover}</h3><div />
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-6">
                <div>
                  <div className="flex justify-between items-center text-xs text-gray-500 uppercase mb-2"><span>{tEx.preview}</span><span className="flex items-center gap-1"><Move size={12} /> {tEx.dragPan}</span></div>
                  <div className="w-full aspect-[21/9] bg-gray-200 dark:bg-gray-800 rounded-xl overflow-hidden relative touch-none border border-gray-300 dark:border-slate-700" onPointerDown={handleCoverPointerDown} onPointerMove={handleCoverPointerMove} onPointerUp={() => { setIsDraggingCover(false); dragStartRef.current = null; }} onPointerLeave={() => { setIsDraggingCover(false); dragStartRef.current = null; }}>
                    <div className="absolute inset-0 flex items-center justify-center text-gray-400"><Activity size={48} /></div>
                    <img key={editingWorkout.coverImage} src={editingWorkout.coverImage} className="w-full h-full object-contain pointer-events-none select-none bg-black absolute inset-0 z-10" alt="" style={{ transform: `translate(${coverTransform.x}%, ${coverTransform.y}%) scale(${coverTransform.scale})`, transformOrigin: "center" }} onError={(e) => e.currentTarget.style.display = 'none'} />
                  </div>
                  <div className="flex items-center gap-3 pt-3 justify-between">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setCoverTransform((prev) => ({ ...prev, scale: Math.max(0.1, prev.scale - 0.1) }))} className="p-2 bg-gray-200 dark:bg-slate-700 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600"><ZoomOut size={16} /></button>
                      <span className="text-xs text-gray-500 w-12 text-center font-mono">{coverTransform.scale.toFixed(1)}x</span>
                      <button onClick={() => setCoverTransform((prev) => ({ ...prev, scale: prev.scale + 0.1 }))} className="p-2 bg-gray-200 dark:bg-slate-700 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600"><ZoomIn size={16} /></button>
                    </div>
                    <button onClick={() => setCoverTransform(DEFAULT_COVER_TRANSFORM)} className="p-2 bg-gray-200 dark:bg-slate-700 rounded-lg hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-500" title="Reset Transform"><RotateCcw size={16} /></button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">{t.customUrl}</label>
                  <div className="flex gap-2">
                    <input value={coverUrlInput} onChange={(e) => setCoverUrlInput(e.target.value)} placeholder="https://..." className="flex-1 p-3 rounded-xl bg-gray-100 dark:bg-slate-800" />
                    <button onClick={handleCoverPaste} className="px-4 bg-gray-200 dark:bg-slate-700 rounded-xl hover:bg-gray-300 dark:hover:bg-slate-600" type="button"><Clipboard size={20} /></button>
                    <button onClick={() => { if (coverUrlInput) { setEditingWorkout({ ...editingWorkout, coverImage: coverUrlInput }); setCoverUrlInput(""); } }} className="px-4 font-bold bg-gray-200 dark:bg-slate-700 rounded-xl">{t.use}</button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-2">{t.presets}</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {WORKOUT_COVERS.map((url, i) => (<button key={i} onClick={() => setEditingWorkout({ ...editingWorkout, coverImage: url })} className={`aspect-video rounded-lg overflow-hidden relative border-2 ${editingWorkout.coverImage === url ? "border-primary" : "border-transparent"}`}><OptimizedImage src={url} className="w-full h-full" /></button>))}
                  </div>
                </div>
              </div>
              <div className="flex-none p-4 border-t border-gray-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md pb-safe-area">
                <button onClick={() => setShowCoverEditor(false)} className="w-full bg-primary text-white p-4 rounded-xl font-bold shadow-lg hover:bg-indigo-600 transition">{tCommon.done}</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
             {showAddExModal && (
                <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'tween', ease: 'easeInOut', duration: 0.3 }} className="fixed inset-0 z-[60] bg-white dark:bg-dark flex flex-col">
                    <div className="p-4 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
                         <button onClick={() => setShowAddExModal(false)} className="p-2 -ml-2 hover:bg-gray-100 dark:hover:bg-slate-800 rounded-full"><ChevronDown /></button>
                         <h3 className="font-bold text-lg">{t.addExercises}</h3>
                         <button onClick={handleAddSelectedExercises} disabled={exModalSelected.length === 0} className="text-primary font-bold disabled:opacity-50">{t.add} ({exModalSelected.length})</button>
                    </div>
                    <div className="p-3 border-b border-gray-100 dark:border-slate-800 bg-gray-50 dark:bg-slate-900">
                        <div className="mb-3">
                          <SearchBar 
                            value={exModalSearch} 
                            onChange={setExModalSearch} 
                            placeholder={tCommon.search} 
                          />
                        </div>
                         <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                            <button onClick={() => setExModalFilters([])} className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 ${exModalFilters.length === 0 ? 'bg-primary text-white' : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700'}`}>All</button>
                            {MUSCLE_GROUPS.map(m => (<button key={m} onClick={() => toggleExModalFilter(m)} className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap flex-shrink-0 ${exModalFilters.includes(m) ? 'bg-primary text-white' : 'bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700'}`}>{tMuscles[m as keyof typeof tMuscles] || m}</button>))}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {allExercises.filter(e => { const matchSearch = e.name.toLowerCase().includes(exModalSearch.toLowerCase()); const matchFilter = exModalFilters.length === 0 || exModalFilters.some(m => e.muscleGroups.includes(m)); return matchSearch && matchFilter; }).map(e => { const isSelected = exModalSelected.includes(e.id); return ( <div key={e.id} onClick={() => { if (isSelected) setExModalSelected(exModalSelected.filter(id => id !== e.id)); else setExModalSelected([...exModalSelected, e.id]); }} className={`p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all ${isSelected ? 'border-primary bg-indigo-50 dark:bg-indigo-900/20' : 'border-gray-100 dark:border-slate-700 bg-white dark:bg-slate-800'}`} > <div className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${isSelected ? 'bg-primary border-primary' : 'border-gray-300 dark:border-slate-600'}`}> {isSelected && <Check size={12} className="text-white"/>} </div> <div className="w-12 h-12 bg-gray-100 dark:bg-slate-900 rounded-lg overflow-hidden flex-shrink-0"> {e.imageUrl ? <img src={e.imageUrl} className="w-full h-full object-contain" alt=""/> : <div className="w-full h-full flex items-center justify-center"><Activity size={16} className="text-gray-300"/></div>} </div> <div> <div className="font-medium text-sm">{e.name}</div> <div className="text-xs text-gray-500">{e.muscleGroups.join(', ')}</div> </div> </div> ); })}
                    </div>
                </motion.div>
             )}
        </AnimatePresence>

      {/* WORKOUT DELETE MODAL */}
      <AnimatePresence>
        {workoutToDelete && (
             <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                <motion.div 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 dark:border-slate-700"
                >
                   <h3 className="font-bold text-xl mb-2">{t.deleteTitle}</h3>
                   <p className="text-gray-500 dark:text-gray-400 mb-6">
                      {tCommon.confirmDelete} <span className="font-bold">"{workouts.find(w => w.id === workoutToDelete)?.name}"</span>? {tCommon.cannotUndo}
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
                </motion.div>
             </div>
          )}
      </AnimatePresence>

      <AnimatePresence>
        {alertState && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} transition={{ duration: 0.2 }} className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-gray-100 dark:border-slate-700" >
                <div className="flex flex-col items-center text-center mb-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 ${ alertState.type === 'error' ? 'bg-red-100 dark:bg-red-900/30 text-red-500' : alertState.type === 'success' ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-500' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-500' }`}>
                        {alertState.type === 'error' ? <AlertCircle size={24} /> : alertState.type === 'success' ? <CheckCircle size={24} /> : <Info size={24} />}
                    </div>
                    <h3 className="font-bold text-xl mb-2">{alertState.title}</h3>
                    <p className="text-gray-500 dark:text-gray-400 text-sm whitespace-pre-wrap">{alertState.message}</p>
                </div>
                <button onClick={closeAlert} className="w-full py-3 bg-gray-100 dark:bg-slate-700 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-slate-600 transition-colors" >{tCommon.close}</button>
            </motion.div>
            </div>
        )}
      </AnimatePresence>
    </div>
  );
};
