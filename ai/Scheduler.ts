import { ScheduledEvent, RidePlan } from "../types";
import { academicCalendar } from '../data/academicCalendar';

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

const dayFullName = (day: string): string => {
    const map: {[key:string]: string} = { 'Mon': 'Monday', 'Tue': 'Tuesday', 'Wed': 'Wednesday', 'Thu': 'Thursday', 'Fri': 'Friday', 'Sat': 'Saturday', 'Sun': 'Sunday' };
    return map[day] || day;
}

export const generateRideSuggestions = async (schedule: ScheduledEvent[]): Promise<Omit<RidePlan, 'id'>[]> => {
    
    const upcomingWeekDates = getNextWeekDates();
    let hasValidEvents = false;

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

                if (dayStatus && (dayStatus.includes('Working') || dayStatus.includes('Exams') || dayStatus.includes('Mohana Mantra'))) {
                    hasValidEvents = true;
                    break;
                }
            }
        }
        if(hasValidEvents) break;
    }

    if (!hasValidEvents) {
        // No valid working days for any scheduled events in the next week.
        return [];
    }

    // Simulate API call delay
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    const mockSuggestions: Omit<RidePlan, 'id'>[] = [];
    
    // A simple mock generator
    const firstEvent = schedule[0];
    if(firstEvent) {
        const firstDay = firstEvent.days[0];
        const eventTime = firstEvent.time.split(':').map(Number);
        const pickupDate = new Date();
        pickupDate.setHours(eventTime[0], eventTime[1] - 15); // 15 mins before

        mockSuggestions.push({
            day: dayFullName(firstDay),
            pickupTime: `${pickupDate.getHours().toString().padStart(2, '0')}:${pickupDate.getMinutes().toString().padStart(2, '0')}`,
            destination: firstEvent.location,
            forEvent: firstEvent.name,
            reason: `To arrive 15 minutes early for your ${firstEvent.time} event.`,
        });
    }

    const secondEvent = schedule.find(e => e.days.length > 1);
    if(secondEvent && secondEvent.id !== firstEvent.id) {
        const secondDay = secondEvent.days[1] || secondEvent.days[0];
        const eventTime = secondEvent.time.split(':').map(Number);
        const pickupDate = new Date();
        pickupDate.setHours(eventTime[0], eventTime[1] - 15); // 15 mins before

        mockSuggestions.push({
            day: dayFullName(secondDay),
            pickupTime: `${pickupDate.getHours().toString().padStart(2, '0')}:${pickupDate.getMinutes().toString().padStart(2, '0')}`,
            destination: secondEvent.location,
            forEvent: secondEvent.name,
            reason: `Planning ahead for your afternoon session.`,
        });
    }

    return mockSuggestions;
};
