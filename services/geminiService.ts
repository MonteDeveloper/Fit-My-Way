import { GoogleGenAI, Type } from "@google/genai";
import { AIWorkoutSuggestion } from '../types';

const getAI = () => {
  if (!process.env.API_KEY) return null;
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

export const generateWorkoutPlan = async (prompt: string): Promise<AIWorkoutSuggestion | null> => {
  const ai = getAI();
  if (!ai) {
    console.error("API Key not found");
    return null;
  }

  const modelId = "gemini-2.5-flash";

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: `Create a structured workout routine based on this request: "${prompt}". 
      Focus on standard gym exercises. 
      If the user asks for something specific, follow it. 
      The output must be strictly JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING, description: "A catchy name for the workout" },
            description: { type: Type.STRING, description: "Brief description of goals" },
            exercises: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING, description: "Standard name of the exercise" },
                  sets: { type: Type.INTEGER },
                  reps: { type: Type.STRING, description: "Rep range e.g. 8-12" },
                  restTime: { type: Type.INTEGER, description: "Rest time in seconds" }
                },
                required: ["name", "sets", "reps", "restTime"]
              }
            }
          },
          required: ["name", "description", "exercises"]
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as AIWorkoutSuggestion;
    }
    return null;
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw error;
  }
};