
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
export const WORKOUT_COVERS = [
  'https://images.unsplash.com/photo-1517836357463-c25dfe94c0de?auto=format&fit=crop&w=800&q=80', // Gym generic
  'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=800&q=80', // Dumbbells row
  'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=800&q=80', // Barbell lifting
  'https://images.unsplash.com/photo-1599058945522-28d584b6f0ff?auto=format&fit=crop&w=800&q=80', // Home workout
  'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?auto=format&fit=crop&w=800&q=80', // Dumbbells
  'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=800&q=80', // Pushup
  'https://images.unsplash.com/photo-1552674605-46d957454d91?auto=format&fit=crop&w=800&q=80', // Running/Cardio
  'https://images.unsplash.com/photo-1571388208497-71bedc66e932?auto=format&fit=crop&w=800&q=80', // Kettlebell
  'https://images.unsplash.com/photo-1595078475328-1ab05d0a6a0e?auto=format&fit=crop&w=800&q=80', // Weights
  'https://images.unsplash.com/photo-1574680178051-55ae54a519ec?auto=format&fit=crop&w=800&q=80', // Gym machines
  'https://images.unsplash.com/photo-1517963843495-111a90b161a6?auto=format&fit=crop&w=800&q=80', // Cardio motion
  'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?auto=format&fit=crop&w=800&q=80', // Gym dark
  'https://images.unsplash.com/photo-1507398941165-84184036f95b?auto=format&fit=crop&w=800&q=80', // Weights rack
  'https://images.unsplash.com/photo-1534258936925-c81474d5817e?auto=format&fit=crop&w=800&q=80', // Yoga/Stretching
  'https://images.unsplash.com/photo-1579126038374-6064e9370f0f?auto=format&fit=crop&w=800&q=80', // Woman lifting
  'https://images.unsplash.com/photo-1584863265045-f9f1037d07e2?auto=format&fit=crop&w=800&q=80', // Man lifting
  'https://images.unsplash.com/photo-1517963683444-980354c7c4d5?auto=format&fit=crop&w=800&q=80', // Treadmill
  'https://images.unsplash.com/photo-1594737625785-16bcb811690c?auto=format&fit=crop&w=800&q=80', // Dumbbell close up
  'https://images.unsplash.com/photo-1535743682480-e4df74a6e185?auto=format&fit=crop&w=800&q=80', // Woman back
  'https://images.unsplash.com/photo-1516481151784-19898c45ae16?auto=format&fit=crop&w=800&q=80', // Kickboxing/Active
  'https://images.unsplash.com/photo-1574680376344-8219cb57e851?auto=format&fit=crop&w=800&q=80', // Gym interior
  'https://images.unsplash.com/photo-1599552683573-9dc48255b7ef?auto=format&fit=crop&w=800&q=80', // Plate loading
  'https://images.unsplash.com/photo-1434596922112-19c563067271?auto=format&fit=crop&w=800&q=80', // Running shoes
  'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?auto=format&fit=crop&w=800&q=80', // Yoga pose
  'https://images.unsplash.com/photo-1576678927484-cc907957088c?auto=format&fit=crop&w=800&q=80', // Gym equipment
  'https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=800&q=80', // Dark gym
  'https://images.unsplash.com/photo-1532384748853-8f54a8f476e2?auto=format&fit=crop&w=800&q=80', // Treadmill running
  'https://images.unsplash.com/photo-1522898467493-49726bf28798?auto=format&fit=crop&w=800&q=80', // Team workout
  'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?auto=format&fit=crop&w=800&q=80', // Crossfit
  'https://images.unsplash.com/photo-1550345332-097335827333?auto=format&fit=crop&w=800&q=80', // Dumbbell hand
  'https://images.unsplash.com/photo-1571731977946-88aaef92b0f4?auto=format&fit=crop&w=800&q=80', // Pushup woman
  'https://images.unsplash.com/photo-1580086319619-3ed498161c77?auto=format&fit=crop&w=800&q=80', // Stretching
  'https://images.unsplash.com/photo-1548690324-f8b5537f1514?auto=format&fit=crop&w=800&q=80', // Crossfit ropes
  'https://images.unsplash.com/photo-1533560840595-86c542e21c42?auto=format&fit=crop&w=800&q=80', // Abs
  'https://images.unsplash.com/photo-1518310383802-640c2de311b2?auto=format&fit=crop&w=800&q=80', // Woman running
  'https://images.unsplash.com/photo-1521804906057-1df8fdb718b7?auto=format&fit=crop&w=800&q=80', // Boxing
  'https://images.unsplash.com/photo-1599447331226-2ba324897980?auto=format&fit=crop&w=800&q=80', // Weights floor
  'https://images.unsplash.com/photo-1534367610401-9f5ed68180aa?auto=format&fit=crop&w=800&q=80', // Outdoor running
  'https://images.unsplash.com/photo-1518459031867-a89b944bffe4?auto=format&fit=crop&w=800&q=80'  // Planking
];