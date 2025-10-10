import { GoogleGenAI, Type } from "@google/genai";
import { ScheduledEvent, RidePlan } from "../types";
import { academicCalendar } from '../data/academicCalendar';

// IMPORTANT: API keys should not be stored in source code.
// This key should be loaded from a secure environment variable or secrets manager.
// FIX: Replaced hardcoded API key with process.env.API_KEY as per guidelines.
// This also resolves the TypeScript error regarding non-overlapping types.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });

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

// Helper function to get the dates for the next 7 days starting from tomorrow
const getNextWeekDates = (): Date[] => {
    const dates: Date[] = [];
    const today = new Date();
    for (let i = 1; i <= 7; i++) {
        const nextDate = new Date(today);
        nextDate.setDate(today.getDate() + i);
        dates.push(nextDate);
    }
    return dates;
};

// Helper to format date as YYYY-MM
const getYearMonth = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    return `${year}-${month}`;
};

// Helper to format date as DD
const getDayOfMonth = (date: Date): string => {
    return date.getDate().toString().padStart(2, '0');
};

const dayStringToNumber: { [key: string]: number } = {
    'Sun': 0, 'Mon': 1, 'Tue': 2, 'Wed': 3, 'Thu': 4, 'Fri': 5, 'Sat': 6
};

export const generateRideSuggestions = async (schedule: ScheduledEvent[]): Promise<Omit<RidePlan, 'id'>[]> => {
    
    const upcomingWeekDates = getNextWeekDates();
    const eventsForPrompt: string[] = [];

    for (const event of schedule) {
        for (const dayStr of event.days) { // e.g., "Mon", "Tue"
            const dayNumber = dayStringToNumber[dayStr];
            if (dayNumber === undefined) continue;

            const matchingDate = upcomingWeekDates.find(date => date.getDay() === dayNumber);

            if (matchingDate) {
                const yearMonth = getYearMonth(matchingDate);
                const dayOfMonth = getDayOfMonth(matchingDate);
                
                const calendarYearMonth = academicCalendar[yearMonth as keyof typeof academicCalendar];
                const dayStatus = calendarYearMonth ? calendarYearMonth[dayOfMonth as keyof typeof calendarYearMonth] : "Working";

                // Only schedule rides on working days, exam days, or fest days
                if (dayStatus && (dayStatus.includes('Working') || dayStatus.includes('Exams') || dayStatus.includes('Mohana Mantra'))) {
                    const dateString = matchingDate.toLocaleDateString('en-CA'); // YYYY-MM-DD
                    let eventString = `- Event: "${event.name}" at "${event.location}" on ${dayStr} (${dateString}) at ${event.time}.`;
                    
                    // Add context if it's not a standard working day
                    if (dayStatus !== "Working") {
                        eventString += ` Note: This day is marked as "${dayStatus}".`;
                    }
                    eventsForPrompt.push(eventString);
                }
            }
        }
    }

    if (eventsForPrompt.length === 0) {
        // No valid working days for any scheduled events in the next week.
        return [];
    }

    const contextualScheduleString = eventsForPrompt.join('\n');

    const prompt = `
        You are a smart ride scheduling assistant for AutoMate, a campus ride-hailing service.
        Your goal is to help a student by creating an optimized, recurring ride plan based on their weekly schedule for the upcoming week.
        The student's default pickup location is always their hostel. You only need to schedule rides TO their events.

        RULES:
        1. For each event in the student's contextual schedule, create a single ride suggestion.
        2. Suggest a pickup time that gets them to their event approximately 15 minutes early.
        3. Acknowledge any special notes about the day (like exams or fests) in your "reason".
        4. The output must be a valid JSON array matching the provided schema.

        Here is the student's contextual schedule for the next 7 days. Only create suggestions for these events:
        ${contextualScheduleString}

        Now, generate the ride plan.
    `;
    
    try {
        // FIX: Removed check for placeholder API key. The key is now sourced from
        // environment variables and assumed to be valid as per guidelines.
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