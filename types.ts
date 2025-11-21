
export interface ImageTransform {
  x: number; // percentage
  y: number; // percentage
  scale: number; // 1 to 3
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroups: string[];
  imageUrl?: string;
  imageTransform?: ImageTransform;
  notes?: string;
  // New Default fields
  defaultWeight?: number;
  defaultRepValue?: number; // e.g. 10 (reps) or 30 (seconds)
  defaultSetType?: SetType; // 'reps' or 'time'
  defaultRestTime?: number; // Rest BETWEEN sets
}

export type SetType = 'reps' | 'time';

export interface WorkoutSet {
  id: string;
  type: SetType;
  value: number; // reps count or seconds
  weight: number;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  sets: WorkoutSet[];
  restTime: number; // Rest BETWEEN SETS
  restAfterExercise?: number; // Rest AFTER LAST SET (before next exercise)
}

export interface Workout {
  id: string;
  name: string;
  description?: string;
  coverImage?: string;
  coverTransform?: ImageTransform;
  exercises: WorkoutExercise[];
  createdAt: number;
}

export interface ActiveSessionState {
  id: 'current';
  workoutId: string;
  currentExIndex: number;
  currentSetIndex: number;
  timer: number;
  startTime: number;
}

export type Language = 'en' | 'it';

export interface AppSettings {
  theme: 'light' | 'dark';
  unit: 'kg' | 'lbs';
  language: Language;
}

export type ViewState = 'dashboard' | 'exercises' | 'workouts' | 'active-workout' | 'settings';

// AI Generation Types
export interface AIWorkoutExercise {
  name: string;
  sets: number;
  reps: string;
  restTime: number;
}

export interface AIWorkoutSuggestion {
  name: string;
  description: string;
  exercises: AIWorkoutExercise[];
}

// Constants
export const MUSCLE_GROUPS = [
  'Chest', 'Back', 'Legs', 'Shoulders', 'Biceps', 'Triceps', 'Core', 'Cardio', 'Full Body', 'Other'
];

// Curated list of stable Unsplash IDs for fitness covers
// EASILY MODIFIABLE: Add or remove URLs here.
export const WORKOUT_COVERS = [
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80', // Dumbbells row
  'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=800&q=80', // Barbell lifting
  'https://images.unsplash.com/photo-1599058945522-28d584b6f0ff?auto=format&fit=crop&w=800&q=80', // Home workout
  'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=800&q=80', // Dumbbells
  'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=800&q=80', // Pushup
  'https://images.unsplash.com/photo-1571388208497-71bedc66e932?auto=format&fit=crop&w=800&q=80', // Kettlebell
  'https://images.unsplash.com/photo-1595078475328-1ab05d0a6a0e?auto=format&fit=crop&w=800&q=80', // Weights
  'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?auto=format&fit=crop&w=800&q=80', // Gym dark
  'https://images.unsplash.com/photo-1579126038374-6064e9370f0f?auto=format&fit=crop&w=800&q=80', // Woman lifting
  'https://images.unsplash.com/photo-1434596922112-19c563067271?auto=format&fit=crop&w=800&q=80', // Running shoes
  'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=800&q=80', // Yoga pose
  'https://images.unsplash.com/photo-1576678927484-cc907957088c?auto=format&fit=crop&w=800&q=80', // Gym equipment
  'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80', // Dark gym
  'https://images.unsplash.com/photo-1532384748853-8f54a8f476e2?auto=format&fit=crop&w=800&q=80', // Treadmill running
  'https://images.unsplash.com/photo-1522898467493-49726bf28798?auto=format&fit=crop&w=800&q=80', // Team workout
  'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80', // Crossfit
  'https://images.unsplash.com/photo-1580086319619-3ed498161c77?auto=format&fit=crop&w=800&q=80', // Stretching
  'https://images.unsplash.com/photo-1518310383802-640c2de311b2?auto=format&fit=crop&w=800&q=80', // Woman running
  'https://images.unsplash.com/photo-1521804906057-1df8fdb718b7?auto=format&fit=crop&w=800&q=80', // Boxing
  'https://images.unsplash.com/photo-1534367610401-9f5ed68180aa?auto=format&fit=crop&w=800&q=80', // Outdoor running
  'https://images.unsplash.com/photo-1518459031867-a89b944bffe4?auto=format&fit=crop&w=800&q=80',  // Planking
  'https://www.mensfitness.com/.image/c_fill,g_faces:center/MjEyMTg3NTY0NjM3OTU1NzEy/chest-workout-home.jpg' //chest
];
