import { Exercise, MUSCLE_GROUPS, Workout, WorkoutExercise, WorkoutSet, Language } from '../../types';

// Definition of the Schema for the AI Prompt
const UNIVERSAL_SCHEMA = {
  exercises: {
    type: 'Array of Objects',
    fields: {
      name: 'String (Required, Unique)',
      muscleGroups: `Array of Strings (Allowed: ${MUSCLE_GROUPS.join(', ')})`,
      imageUrl: 'String (Direct URL)',
      notes: 'String'
    }
  },
  workouts: {
    type: 'Array of Objects',
    fields: {
      name: 'String (Required)',
      description: 'String',
      exercises: {
        type: 'Array of Objects',
        fields: {
          name: 'String (Must match exercise name)',
          sets: 'Number',
          type: 'String ("reps" or "time")',
          value: 'Number (Integer for reps count OR Seconds for time). MUST BE A NUMBER.',
          restBetweenSets: 'Number (Seconds)',
          restAfterExercise: 'Number (Seconds)'
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

RULES FOR IMAGES:
1. Use ONLY direct URLs to real images (jpg, png, webp, gif).
2. **DO NOT** use placeholder sites, fake paths, or mockups.
3. If you cannot find a REAL, direct image URL, omit the "imageUrl" field.

${contextSection}

Structure:
${JSON.stringify(UNIVERSAL_SCHEMA, null, 2)}

INSTRUCTIONS:
1. Analyze request. Generate "workouts" or "exercises" or both.
2. **Workouts:** Prioritize existing names from CONTEXT. Only create new exercises if necessary.
3. **Exercises:** Populate "exercises" array.
4. **Values:** Strict types. "muscleGroups" must match schema. "value" for sets must ALWAYS be a number (e.g. 30 for 30s plank, 10 for 10 reps).
5. **Formatting:** STRICT JSON. No comments. Use double quotes. Do NOT use smart quotes.

IMPORTANT:
- If I provide specific instructions, follow them.
- Otherwise, respond with a waiting message in ${language}.
`.trim();
};

export const validateImageUrls = async (exercises: Exercise[]): Promise<Exercise[]> => {
    const validated = await Promise.all(exercises.map(async (ex) => {
        if (!ex.imageUrl) return ex;
        try {
            await new Promise((resolve, reject) => {
                const img = new Image();
                img.onload = resolve;
                img.onerror = reject;
                img.src = ex.imageUrl!;
            });
            return ex;
        } catch {
            return { ...ex, imageUrl: '' }; 
        }
    }));
    return validated;
};

// --- ROBUST PARSING LOGIC ---

const cleanJSON = (str: string): string => {
    // Remove Markdown
    let clean = str.replace(/^```(?:json)?|```$/g, '').replace(/```/g, '').trim();
    
    // Remove Comments
    clean = clean.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');

    // Replace Smart Quotes with Standard Quotes (Crucial for mobile input)
    clean = clean.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");

    // Fix Trailing Commas (Regex looks for comma followed by closing bracket)
    clean = clean.replace(/,(\s*[\]}])/g, '$1');

    return clean;
};

export const parseUniversalData = (jsonString: string, existingExercises: Exercise[] = [], existingWorkouts: Workout[] = []): { newExercises: Exercise[], newWorkouts: Workout[] } => {
  const cleaned = cleanJSON(jsonString);
  let raw: any;

  try {
    raw = JSON.parse(cleaned);
  } catch (e: any) {
    // Recover Strategies
    try {
       // Check for missing brackets
       if (cleaned.trim().startsWith('[') && !cleaned.trim().endsWith(']')) raw = JSON.parse(cleaned + ']');
       else if (cleaned.trim().startsWith('{') && !cleaned.trim().endsWith('}')) raw = JSON.parse(cleaned + '}');
       else {
           // Try to extract first valid JSON object or array from chaos
           const match = cleaned.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
           if (match) raw = JSON.parse(match[0]);
           else throw e;
       }
    } catch (finalErr) {
       // Detailed Error Message Construction
       let msg = "Invalid generation: Syntax error in JSON.";
       if (e.message.includes("Unexpected token")) msg = "Invalid generation: Unexpected character or missing symbol.";
       if (e.message.includes("JSON")) msg = "Invalid generation: Malformed JSON.";
       
       throw new Error(`${msg} Details: ${e.message}`);
    }
  }

  // Normalize Structure
  let rawExercises: any[] = [];
  let rawWorkouts: any[] = [];

  if (Array.isArray(raw)) {
      // Heuristics to identify mixed arrays
      const possibleWorkouts = raw.filter(i => i.name && Array.isArray(i.exercises));
      const possibleExercises = raw.filter(i => i.name && !i.exercises && (i.muscleGroups || i.imageUrl));
      
      if (possibleWorkouts.length > 0) rawWorkouts = possibleWorkouts;
      if (possibleExercises.length > 0) rawExercises = possibleExercises;
      
      // Check if it's the {exercises:[], workouts:[]} array wrapper
      if (raw.length === 1 && (raw[0].exercises || raw[0].workouts)) {
          if (raw[0].exercises) rawExercises = raw[0].exercises;
          if (raw[0].workouts) rawWorkouts = raw[0].workouts;
      }
  } else if (typeof raw === 'object' && raw !== null) {
      if (Array.isArray(raw.exercises)) rawExercises = raw.exercises;
      if (Array.isArray(raw.workouts)) rawWorkouts = raw.workouts;
      
      // Handle single object case
      if (!raw.exercises && !raw.workouts) {
          if (raw.muscleGroups) rawExercises = [raw];
          else if (raw.exercises) rawWorkouts = [raw]; // obj with exercises prop = workout
      }
  } else {
      throw new Error("Invalid generation: Output is not a valid Object or Array.");
  }

  // --- Process Exercises ---
  const newExercises: Exercise[] = [];
  const processedExNames = new Set<string>();
  const existingExMap = new Map<string, Exercise>();
  existingExercises.forEach(e => existingExMap.set(e.name.toLowerCase().trim(), e));

  const createExercise = (item: any): Exercise | null => {
      if (!item.name || (typeof item.name !== 'string' && typeof item.name !== 'number')) return null;
      const name = String(item.name).trim();
      const normName = name.toLowerCase();
      
      // DUPLICATE CHECK: If exists, we do NOT return a new exercise, we skip it.
      if (existingExMap.has(normName)) return null; 
      if (processedExNames.has(normName)) return null; 

      const muscles = Array.isArray(item.muscleGroups) 
          ? item.muscleGroups.filter((m: any) => typeof m === 'string' && MUSCLE_GROUPS.includes(m))
          : [];
      
      const ex: Exercise = {
          id: crypto.randomUUID(),
          name: name,
          muscleGroups: muscles.length > 0 ? muscles : ['Other'],
          imageUrl: typeof item.imageUrl === 'string' ? item.imageUrl : undefined,
          imageTransform: { x: 0, y: 0, scale: 1 },
          notes: typeof item.notes === 'string' ? item.notes : undefined,
          defaultRepValue: 10,
          defaultSetType: 'reps',
          defaultWeight: 0,
          defaultRestTime: 60
      };
      processedExNames.add(normName);
      // Add to map so subsequent references in this batch find it
      existingExMap.set(normName, ex); 
      return ex;
  };

  rawExercises.forEach(item => {
      const ex = createExercise(item);
      if (ex) newExercises.push(ex);
  });

  // --- Process Workouts ---
  const newWorkouts: Workout[] = [];
  // Map is already populated with Existing + Newly Created from this batch
  
  rawWorkouts.forEach((item: any) => {
      if (!item.name || typeof item.name !== 'string') return; // Skip invalid
      
      let finalName = item.name.trim();
      
      // WORKOUT DUPLICATE HANDLING: Progressive Naming
      const isTaken = (n: string) => {
          const low = n.toLowerCase();
          return existingWorkouts.some(w => w.name.toLowerCase() === low) ||
                 newWorkouts.some(w => w.name.toLowerCase() === low);
      };

      if (isTaken(finalName)) {
          let counter = 2;
          while(isTaken(`${finalName} ${counter}`)) counter++;
          finalName = `${finalName} ${counter}`;
      }

      const workoutExercises: WorkoutExercise[] = [];
      
      if (Array.isArray(item.exercises)) {
          item.exercises.forEach((exItem: any) => {
              if (!exItem.name) return;
              const exName = String(exItem.name).trim();
              const normExName = exName.toLowerCase();
              
              let exerciseId = '';
              
              if (existingExMap.has(normExName)) {
                  exerciseId = existingExMap.get(normExName)!.id;
              } else {
                  // Auto-recover missing exercise (Salvage Strategy)
                  // If the workout mentions an exercise we don't have, create it on the fly as a fallback
                  const newEx = createExercise({ name: exName, muscleGroups: ['Other'] });
                  if (newEx) {
                      newExercises.push(newEx);
                      existingExMap.set(newEx.name.toLowerCase(), newEx);
                      exerciseId = newEx.id;
                  } else {
                      // Only fail if salvage fails (rare)
                      return; 
                  }
              }

              // Parse Sets, Type and Value
              const setCount = Number(exItem.sets) || 3;
              
              let setType: 'reps' | 'time' = 'reps';
              let setValue = 10;

              // Intelligent type detection
              if (exItem.type === 'time' || exItem.type === 'reps') {
                  setType = exItem.type;
              } else if (typeof exItem.reps === 'string' && (exItem.reps.includes('s') || exItem.reps.includes('min'))) {
                  setType = 'time';
              }

              // Intelligent value parsing
              if (typeof exItem.value === 'number') {
                  setValue = exItem.value;
              } else if (typeof exItem.reps === 'number') {
                  setValue = exItem.reps;
              } else if (typeof exItem.reps === 'string') {
                  setValue = parseInt(exItem.reps.replace(/\D/g, '')) || 10;
              }
              
              const sets: WorkoutSet[] = Array.from({length: setCount}).map(() => ({
                  id: crypto.randomUUID(),
                  type: setType,
                  value: setValue,
                  weight: 0
              }));

              workoutExercises.push({
                  id: crypto.randomUUID(),
                  exerciseId: exerciseId,
                  sets: sets,
                  restTime: Number(exItem.restBetweenSets) || 60,
                  restAfterExercise: Number(exItem.restAfterExercise) || 60
              });
          });
      }
      
      // Only add workout if it has exercises (or we can allow empty, but generally better to have content)
      if (workoutExercises.length > 0) {
          newWorkouts.push({
              id: crypto.randomUUID(),
              name: finalName,
              description: typeof item.description === 'string' ? item.description : '',
              coverImage: typeof item.coverImage === 'string' ? item.coverImage : '',
              coverTransform: { x: 0, y: 0, scale: 1 },
              exercises: workoutExercises,
              createdAt: Date.now()
          });
      }
  });

  if (newExercises.length === 0 && newWorkouts.length === 0) {
      // It's possible the user pasted empty arrays, or our salvage logic found nothing valid.
      // Check if we had raw data to begin with to give a better error.
      if (rawExercises.length > 0 || rawWorkouts.length > 0) {
          // If we had raw items but created nothing, it implies strictly duplicates (for exercises) and empty workouts?
          // Or duplication handling prevented exercise creation but we might have valid workouts using existing ones.
          // If rawWorkouts > 0 and newWorkouts == 0, then workout parsing failed.
          if (rawWorkouts.length > 0) {
             throw new Error("Invalid generation: Workouts found but failed to parse valid exercises within them.");
          }
          // If only exercises and all were duplicates, we return empty arrays, which is technically valid (nothing new).
          return { newExercises: [], newWorkouts: [] };
      }
      throw new Error("Invalid generation: No valid exercises or workouts found in JSON.");
  }

  return { newExercises, newWorkouts };
};