
import { GoogleGenAI, Type } from "@google/genai";
import { ScheduledEvent, RidePlan } from "../types";

// Ensure this is handled securely and not exposed on the client-side in a real app.
// For this environment, we can assume process.env.API_KEY is available.
const API_KEY = process.env.API_KEY;
if (!API_KEY) {
    throw new Error("API_KEY is not defined in environment variables");
}
const ai = new GoogleGenAI({ apiKey: API_KEY });

const responseSchema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        day: {
          type: Type.STRING,
          description: 'The day of the week for the ride (e.g., "Monday", "Wednesday").',
        },
        pickupTime: {
          type: Type.STRING,
          description: 'The suggested pickup time in HH:MM format (24-hour).',
        },
        destination: {
            type: Type.STRING,
            description: "The destination for this ride, taken from the event's location.",
        },
        forEvent: {
          type: Type.STRING,
          description: "The name of the event this ride is for.",
        },
        reason: {
            type: Type.STRING,
            description: "A brief, friendly explanation for the suggested time (e.g., 'To arrive 15 minutes early for your 10:00 AM lecture.').",
        }
      },
      required: ["day", "pickupTime", "destination", "forEvent", "reason"],
    },
};


export const generateRideSuggestions = async (schedule: ScheduledEvent[]): Promise<Omit<RidePlan, 'id'>[]> => {
    
    const scheduleString = schedule.map(event => 
        `- Event: "${event.name}" at "${event.location}" on ${event.days.join(', ')} at ${event.time}.`
    ).join('\n');

    const prompt = `
        You are a smart ride scheduling assistant for a campus shuttle service.
        Your goal is to help a student by creating an optimized, recurring ride plan based on their weekly schedule.
        The student's default pickup location is always their hostel. You only need to schedule rides TO their events.

        RULES:
        1. For each event in the student's schedule, create a separate ride suggestion for EACH day the event occurs.
        2. Suggest a pickup time that gets them to their event approximately 15 minutes early.
        3. Assume all rides are "Shared" by default to promote eco-friendly travel.
        4. The output must be a valid JSON array matching the provided schema.

        Here is the student's schedule:
        ${scheduleString}

        Now, generate the ride plan.
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: responseSchema,
            },
        });

        const jsonText = response.text.trim();
        const suggestions: Omit<RidePlan, 'id'>[] = JSON.parse(jsonText);
        return suggestions;

    } catch (error) {
        console.error("Error calling Gemini API:", error);
        // In case of an API error, return an empty array or handle it appropriately
        return [];
    }
};