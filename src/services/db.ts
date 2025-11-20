import { AppSettings, Exercise, Workout, ActiveSessionState } from "@/types";

const DB_NAME = 'FitMyWayDB';
const DB_VERSION = 2; // Incremented for active_session

// Initial Data
const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  unit: 'kg',
  language: 'en',
};

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains('exercises')) {
        const exerciseStore = db.createObjectStore('exercises', { keyPath: 'id' });
        exerciseStore.createIndex('name', 'name', { unique: false });
      }

      if (!db.objectStoreNames.contains('workouts')) {
        const workoutStore = db.createObjectStore('workouts', { keyPath: 'id' });
        workoutStore.createIndex('name', 'name', { unique: false });
      }

      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'id' });
      }

      if (!db.objectStoreNames.contains('active_session')) {
        db.createObjectStore('active_session', { keyPath: 'id' });
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

export const db = {
  async getSettings(): Promise<AppSettings> {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('settings', 'readonly');
      const store = tx.objectStore('settings');
      const request = store.get('app-settings');

      request.onsuccess = () => {
        resolve(request.result || DEFAULT_SETTINGS);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async saveSettings(settings: AppSettings): Promise<void> {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('settings', 'readwrite');
      const store = tx.objectStore('settings');
      const request = store.put({ ...settings, id: 'app-settings' });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async getExercises(): Promise<Exercise[]> {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('exercises', 'readonly');
      const store = tx.objectStore('exercises');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async saveExercise(exercise: Exercise): Promise<void> {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('exercises', 'readwrite');
      const store = tx.objectStore('exercises');
      const request = store.put(exercise);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async deleteExercise(id: string): Promise<void> {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('exercises', 'readwrite');
      const store = tx.objectStore('exercises');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async getWorkouts(): Promise<Workout[]> {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('workouts', 'readonly');
      const store = tx.objectStore('workouts');
      const request = store.getAll();
      request.onsuccess = () => {
        const raw = request.result as any[];
        // Sanitize legacy data on read
        const workouts = raw.map(w => ({
          ...w,
          exercises: (w.exercises || []).map((e: any) => {
            // Ensure new sets array structure
            let sets = e.sets;
            if (!Array.isArray(sets)) {
              // Legacy conversion (sets was a number)
              const count = typeof e.sets === 'number' ? e.sets : 3;
              const repStr = String(e.reps || '10');
              const isTime = repStr.toLowerCase().includes('s') || repStr.toLowerCase().includes('min');
              const val = parseInt(repStr.replace(/\D/g, '')) || 10;

              sets = Array.from({ length: count }).map(() => ({
                id: crypto.randomUUID(),
                type: isTime ? 'time' : 'reps',
                value: val,
                weight: 0
              }));
            }

            return {
              ...e,
              sets,
              reps: undefined, // cleanup legacy
              restTime: e.restTime || 60, // Default Inter-set rest
              restAfterExercise: e.restAfterExercise ?? 60 // Default Inter-exercise rest
            };
          })
        }));
        resolve(workouts);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async saveWorkout(workout: Workout): Promise<void> {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('workouts', 'readwrite');
      const store = tx.objectStore('workouts');
      const request = store.put(workout);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async deleteWorkout(id: string): Promise<void> {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('workouts', 'readwrite');
      const store = tx.objectStore('workouts');
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  // --- Active Session Management ---
  async saveActiveSession(session: ActiveSessionState): Promise<void> {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('active_session', 'readwrite');
      const store = tx.objectStore('active_session');
      const request = store.put(session);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async getActiveSession(): Promise<ActiveSessionState | undefined> {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('active_session', 'readonly');
      const store = tx.objectStore('active_session');
      const request = store.get('current');
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async clearActiveSession(): Promise<void> {
    const database = await openDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('active_session', 'readwrite');
      const store = tx.objectStore('active_session');
      const request = store.delete('current');
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  },

  async exportData(): Promise<string> {
    const exercises = await this.getExercises();
    const workouts = await this.getWorkouts();
    const settings = await this.getSettings();
    return JSON.stringify({ exercises, workouts, settings });
  },

  async importData(jsonString: string): Promise<void> {
    try {
      const data = JSON.parse(jsonString);
      const database = await openDB();
      const tx = database.transaction(['exercises', 'workouts', 'settings'], 'readwrite');

      if (data.exercises) {
        data.exercises.forEach((e: Exercise) => tx.objectStore('exercises').put(e));
      }
      if (data.workouts) {
        data.workouts.forEach((w: Workout) => tx.objectStore('workouts').put(w));
      }
      if (data.settings) {
        tx.objectStore('settings').put({ ...data.settings, id: 'app-settings' });
      }

      return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch (e) {
      console.error("Import failed", e);
      throw new Error("Invalid data format");
    }
  },

  async clearAll(): Promise<void> {
    const database = await openDB();
    const tx = database.transaction(['exercises', 'workouts', 'settings', 'active_session'], 'readwrite');
    tx.objectStore('exercises').clear();
    tx.objectStore('workouts').clear();
    tx.objectStore('settings').clear();
    tx.objectStore('active_session').clear();
    return new Promise((resolve) => {
      tx.oncomplete = () => resolve();
    });
  }
};