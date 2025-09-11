import { Ride, RideType, Driver } from '../types';

// Define the state for our RL model
interface RLState {
    timeOfDay: 'day' | 'night';
    isSoloRide: boolean;
}

// Define the action the RL model can take
type RLAction = 'nudge' | 'do_nothing';

export interface Nudge {
    message: string;
    modifiedRideDetails: Omit<Ride, 'id' | 'studentId' | 'date' | 'status'>;
}

/**
 * Simulates a trained Proximal Policy Optimization (PPO) model.
 * In a real-world scenario, this would be a call to a TensorFlow.js model or a backend service.
 * Here, we use a simple rule-based system to mimic its decision-making process.
 * 
 * @param state The current state of the booking request.
 * @returns The best action determined by the "model".
 */
const decideAction = (state: RLState): RLAction => {
    // PPO Policy: Nudge late-night solo riders towards shared EV rides.
    // This is a high-reward scenario: it's late, so the user may be more price-sensitive,
    // and converting a solo ride to shared has a high environmental impact.
    if (state.timeOfDay === 'night' && state.isSoloRide) {
        return 'nudge';
    }

    // Default action for all other states
    return 'do_nothing';
};

/**
 * The main function for the student-facing nudge system.
 * It analyzes the ride details and decides whether to offer an eco-friendly alternative.
 * 
 * @param rideDetails The original ride details requested by the student.
 * @returns A Nudge object if an eco-friendly alternative is offered, otherwise null.
 */
export const getStudentNudge = (rideDetails: Omit<Ride, 'id' | 'studentId' | 'date' | 'status'>): Nudge | null => {
    const currentHour = new Date().getHours();
    
    // 1. Define the current state based on the input
    const state: RLState = {
        timeOfDay: (currentHour >= 21 || currentHour < 6) ? 'night' : 'day',
        isSoloRide: rideDetails.type === RideType.SOLO,
    };

    // 2. Get the action from our simulated PPO model
    const action = decideAction(state);

    // 3. If the action is to nudge, create the nudge details
    if (action === 'nudge') {
        // Create a compelling offer
        const newFare = rideDetails.fare * 0.75; // 25% discount
        const co2Savings = 1.5; // Estimated 1.5kg CO2 saved

        const modifiedRideDetails: Omit<Ride, 'id' | 'studentId' | 'date' | 'status'> = {
            ...rideDetails,
            type: RideType.SHARED,
            fare: newFare,
            groupSize: 2,
            co2Savings: co2Savings,
        };

        const message = `Save the planet & your wallet! Switch to a shared EV ride?`;
        
        return {
            message,
            modifiedRideDetails,
        };
    }

    return null; // Do nothing
};

/**
 * Calculates bonuses and CO2 savings for a completed ride.
 * @param ride The completed ride object.
 * @param driver The driver who completed the ride.
 * @returns An object with the calculated bonus and CO2 savings.
 */
export const calculateDriverBonus = (ride: Ride, driver: Driver): { bonus: number; co2Savings: number } => {
    let bonus = 0;
    let co2Savings = 0;

    // Reward for using an EV
    if (driver.isEV) {
        bonus += 10; // ₹10 EV bonus
        co2Savings += 1.5; // Base saving for an EV ride
    }

    // Additional reward for a shared ride
    if (ride.type === RideType.SHARED) {
        co2Savings += 0.8; // Extra saving for a shared ride
    }

    return { bonus, co2Savings };
};