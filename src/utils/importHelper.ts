


// Definition of the Schema for the AI Prompt

import { MUSCLE_GROUPS, Language, Exercise, Workout, WorkoutExercise, WorkoutSet } from "@/types";

// This ensures the prompt always matches the current data structure
const SCHEMA_DEFINITIONS = {
  exercise: {
    format: 'JSON Array of Objects',
    fields: {
      name: 'String (Required, Unique name of the exercise)',
      muscleGroups: `Array of Strings (Allowed values: ${MUSCLE_GROUPS.join(', ')})`,
      imageUrl: 'String (Optional, URL to a GIF or Image)',
      notes: 'String (Optional, Technique tips)',
    }
  },
  workout: {
    format: 'JSON Array of Objects',
    fields: {
      name: 'String (Required, Name of the routine)',
      description: 'String (Optional)',
      exercises: {
        type: 'Array of Objects',
        fields: {
          name: 'String (Must match an existing exercise name EXACTLY)',
          sets: 'Number (Count of sets)',
          reps: 'Number (Target reps per set) OR String "10s" for time',
          restBetweenSets: 'Number (Seconds)',
          restAfterExercise: 'Number (Seconds)',
        }
      }
    }
  }
};

export const generateAIPrompt = (type: 'exercise' | 'workout', language: Language, existingExercises: string[] = []): string => {
  const schema = type === 'exercise' ? SCHEMA_DEFINITIONS.exercise : SCHEMA_DEFINITIONS.workout;
  
  let exercisesContext = "";
  if (type === 'workout' && existingExercises.length > 0) {
      exercisesContext = `
AVAILABLE_EXERCISES = ${JSON.stringify(existingExercises)}

IMPORTANT: Use ONLY exercise names found in the AVAILABLE_EXERCISES list. Do not invent new exercises or use variations. The names must match exactly.
`;
  }

  return `
You are a fitness data assistant. I need you to generate ${type}s for my app.
LANGUAGE = ${language}
Please output ONLY valid JSON data. No markdown, no conversational text.
${exercisesContext}
Structure:
${JSON.stringify(schema, null, 2)}

Instructions:
1. Output a valid JSON Array.
2. Follow the allowed values strictly (especially for muscleGroups).
3. For Workouts, YOU MUST ONLY USE EXERCISES FROM THE "AVAILABLE_EXERCISES" LIST provided above. DO NOT create exercises that are not in that list.
4. Do not include comments in the JSON.
5. IMPORTANT: I can include my specific requests immediately in this prompt OR wait for my next message. If I provide additional information immediately, respond with the JSON. Otherwise, respond with a message equivalent to 'Waiting for your information to generate the JSON!' in the language specified below. All your responses, including the JSON and any messages, must be in the language specified.
`.trim();
};

// -- Parsing & Validation Logic --

export const parseAndValidateExercises = (jsonString: string): Exercise[] => {
  try {
    const raw = JSON.parse(jsonString);
    if (!Array.isArray(raw)) throw new Error("Root must be an array");

    return raw.map((item: any) => {
      if (!item.name) throw new Error("Missing name in exercise");
      
      // Validate/Sanitize Muscle Groups
      const muscles = (Array.isArray(item.muscleGroups) ? item.muscleGroups : [])
        .filter((m: string) => MUSCLE_GROUPS.includes(m));

      return {
        id: crypto.randomUUID(),
        name: String(item.name),
        muscleGroups: muscles.length > 0 ? muscles : ['Other'],
        imageUrl: item.imageUrl || '',
        imageTransform: { x: 0, y: 0, scale: 1 }, // Default
        notes: item.notes || ''
      };
    });
  } catch (e) {
    console.error("Parse error", e);
    throw e;
  }
};

export const parseAndValidateWorkouts = (jsonString: string, existingExercises: Exercise[]): Workout[] => {
  try {
    const raw = JSON.parse(jsonString);
    if (!Array.isArray(raw)) throw new Error("Root must be an array");

    return raw.map((item: any): Workout | null => {
      if (!item.name) throw new Error("Missing workout name");

      const workoutExercises: WorkoutExercise[] = [];

      if (Array.isArray(item.exercises)) {
        item.exercises.forEach((exItem: any) => {
          // Fuzzy Match Exercise
          const targetName = String(exItem.name).toLowerCase();
          const match = existingExercises.find(e => e.name.toLowerCase().includes(targetName));

          if (match) {
            const setCount = Number(exItem.sets) || 3;
            const repValRaw = String(exItem.reps || '10');
            const isTime = repValRaw.toLowerCase().includes('s');
            const repVal = parseInt(repValRaw.replace(/\D/g, '')) || 10;

            const sets: WorkoutSet[] = Array.from({ length: setCount }).map(() => ({
              id: crypto.randomUUID(),
              type: isTime ? 'time' : 'reps',
              value: repVal,
              weight: 0
            }));

            workoutExercises.push({
              id: crypto.randomUUID(),
              exerciseId: match.id,
              sets: sets,
              restTime: Number(exItem.restBetweenSets) || 60,
              restAfterExercise: Number(exItem.restAfterExercise) || 60
            });
          }
        });
      }

      if (workoutExercises.length === 0) return null; // Skip empty workouts

      return {
        id: crypto.randomUUID(),
        name: String(item.name),
        description: item.description || '',
        coverImage: '', // Will use fallback or user can add later
        coverTransform: { x: 0, y: 0, scale: 1 },
        exercises: workoutExercises,
        createdAt: Date.now()
      };
    }).filter((w): w is Workout => w !== null);

  } catch (e) {
    console.error("Parse error", e);
    throw e;
  }
};
