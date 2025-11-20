import { MUSCLE_GROUPS, Language, Exercise, Workout, WorkoutExercise, WorkoutSet } from "@/types";

// Definition of the Schema for the AI Prompt
const UNIVERSAL_SCHEMA = {
  exercises: {
    type: 'Array of Objects (Optional, create only if requested or missing)',
    fields: {
      name: 'String (Required, Unique name)',
      muscleGroups: `Array of Strings (Allowed: ${MUSCLE_GROUPS.join(', ')})`,
      imageUrl: 'String (Optional, URL to GIF/Image)',
      notes: 'String (Optional)',
    }
  },
  workouts: {
    type: 'Array of Objects (Optional)',
    fields: {
      name: 'String (Required)',
      description: 'String (Optional)',
      exercises: {
        type: 'Array of Objects',
        fields: {
          name: 'String (Must match an existing exercise name OR one created in the "exercises" array)',
          sets: 'Number (Count)',
          reps: 'Number (e.g. 10) OR String "10s" for time',
          restBetweenSets: 'Number (Seconds)',
          restAfterExercise: 'Number (Seconds)',
        }
      }
    }
  }
};

export const generateAIPrompt = (language: Language, existingExercises: string[] = []): string => {
  
  const hasExercises = existingExercises.length > 0;
  
  let contextSection = "";
  if (hasExercises) {
      contextSection = `
CONTEXT - EXERCISES CURRENTLY IN DATABASE:
${JSON.stringify(existingExercises)}
`;
  } else {
      contextSection = `
CONTEXT:
The database is currently EMPTY. You must generate full exercise details (including muscleGroups) for any exercise you use in a workout.
`;
  }

  return `
You are an expert fitness AI assistant for the "Fit My Way" app.
LANGUAGE = ${language}
Please output ONLY valid JSON data matching the structure below. No markdown.

${contextSection}

Structure:
${JSON.stringify(UNIVERSAL_SCHEMA, null, 2)}

INSTRUCTIONS FOR THE AI:
1. Analyze the user's request to decide what to generate (Workouts, Exercises, or both).
2. **If the user wants a Workout/Routine:**
   - Create it in the "workouts" array.
   - **CRITICAL:** You must prioritize using the exact names found in the CONTEXT list above.
   - **ONLY** create a new entry in the "exercises" array if the workout strictly requires a movement that is NOT in the CONTEXT list.
   - If the CONTEXT is empty, you MUST create every exercise used in the "exercises" array.
3. **If the user wants a list of Exercises:**
   - Populate the "exercises" array. Leave "workouts" empty.
4. **If the user provides vague input:**
   - Infer the best course of action (e.g., "Chest day" implies a chest workout).
5. For "muscleGroups", use strict allowed values found in the schema.
6. Do not include comments in the JSON.

IMPORTANT INTERACTION RULE:
I can include my specific requests immediately in this prompt OR wait for my next message. 
- If I provide additional information immediately (e.g., "Create a HIIT workout"), respond with the JSON. 
- Otherwise, respond with a message equivalent to 'Waiting for your instructions! Tell me if you want a specific workout or a list of exercises.' in the language specified. 
- All your responses, including the JSON and any messages, must be in the language specified.
`.trim();
};

// -- Universal Parsing Logic --

export const parseUniversalData = (jsonString: string, existingExercises: Exercise[] = []): { newExercises: Exercise[], newWorkouts: Workout[] } => {
  try {
    const raw = JSON.parse(jsonString);
    
    // Handle case where AI might return just an array (legacy behavior) or the new object
    let rawExercises: any[] = [];
    let rawWorkouts: any[] = [];

    if (Array.isArray(raw)) {
        // Heuristic: check first item to see if it looks like a workout or exercise
        if (raw.length > 0) {
            if (raw[0].exercises && Array.isArray(raw[0].exercises)) {
                rawWorkouts = raw;
            } else {
                rawExercises = raw;
            }
        }
    } else {
        if (raw.exercises && Array.isArray(raw.exercises)) rawExercises = raw.exercises;
        if (raw.workouts && Array.isArray(raw.workouts)) rawWorkouts = raw.workouts;
    }

    // 1. Parse Exercises
    const parsedExercises: Exercise[] = rawExercises.map((item: any): Exercise | null => {
        if (!item.name) return null;
        const muscles = (Array.isArray(item.muscleGroups) ? item.muscleGroups : [])
            .filter((m: string) => MUSCLE_GROUPS.includes(m));
        
        return {
            id: crypto.randomUUID(),
            name: String(item.name),
            muscleGroups: muscles.length > 0 ? muscles : ['Other'],
            imageUrl: item.imageUrl || '',
            imageTransform: { x: 0, y: 0, scale: 1 },
            notes: item.notes || '',
            defaultRepValue: 10,
            defaultSetType: 'reps',
            defaultWeight: 0,
            defaultRestTime: 60
        };
    }).filter((e): e is Exercise => e !== null);

    // Merge new exercises with existing for workout validation
    const combinedExercises = [...existingExercises, ...parsedExercises];

    // 2. Parse Workouts
    const parsedWorkouts: Workout[] = rawWorkouts.map((item: any): Workout | null => {
        if (!item.name) return null;

        const workoutExercises: WorkoutExercise[] = [];
        if (Array.isArray(item.exercises)) {
            item.exercises.forEach((exItem: any) => {
                const targetName = String(exItem.name).toLowerCase();
                // Check both existing DB and newly parsed exercises
                const match = combinedExercises.find(e => e.name.toLowerCase() === targetName || e.name.toLowerCase().includes(targetName));

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

        if (workoutExercises.length === 0) return null;

        return {
            id: crypto.randomUUID(),
            name: String(item.name),
            description: item.description || '',
            coverImage: '', 
            coverTransform: { x: 0, y: 0, scale: 1 },
            exercises: workoutExercises,
            createdAt: Date.now()
        };
    }).filter((w): w is Workout => w !== null);

    return { newExercises: parsedExercises, newWorkouts: parsedWorkouts };

  } catch (e) {
    console.error("Parse error", e);
    throw new Error("Invalid JSON format");
  }
};
