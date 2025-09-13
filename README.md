# Campus Shuttle PWA

Welcome to Campus Shuttle, a modern Progressive Web App designed to streamline transportation within a university campus. This application connects students needing a ride with available drivers, featuring real-time booking, live tracking, an intelligent wallet system, and powerful AI-driven features for scheduling and fare calculation.

## ✨ Key Features

### For Students:
- **Seamless Booking:** Book `Solo` or `Shared` rides for now (`ASAP`) or schedule them for later.
- **Live Ride Tracking:** See your driver's location in real-time on an integrated Google Map.
- **Integrated Wallet:** Easily manage your funds, view detailed transaction history, and add money to your wallet.
- **AI Ride Scheduler:** Input your weekly class schedule, and let our Gemini-powered AI suggest an optimized, recurring ride plan that accounts for the academic calendar.
- **Eco-Nudge System:** Receive smart suggestions to switch to a shared ride, saving you money and reducing your carbon footprint.
- **Profile Management:** Update your personal details and upload a profile picture.
- **Emergency SOS:** A dedicated SOS button to alert campus security and your emergency contact during a ride.
- **Waitlist for Shared Rides:** If no shared rides are immediately available, join a waitlist to be automatically matched with a driver.

### For Drivers:
- **Flexible Availability:** Toggle your online/offline status with a single switch to start receiving requests.
- **Ride Request Management:** View and accept or decline incoming ride requests from students.
- **Student Activity Heatmap:** A dynamic heatmap shows the busiest times and locations for student ride requests, helping you maximize earnings.
- **Automated Earnings & Incentives:**
    - Earnings are instantly credited upon ride completion.
    - Earn bonuses for night shifts, completing shared rides, and using an Electric Vehicle (EV).
    - A generous **₹250 sign-up bonus** is awarded after completing your first 10 rides.
- **Driver Onboarding:** A simple, multi-step process to get new drivers verified and ready to drive.
- **Profile & Vehicle Management:** Keep your personal and vehicle details up-to-date.

---

## 🤖 AI & Machine Learning Integration

This project leverages the Google Gemini API and simulated ML models to create a smart and efficient user experience.

1.  **AI Ride Scheduler (`ai/Scheduler.ts`)**
    - **Model:** `gemini-2.5-flash`
    - **Functionality:** Takes a student's weekly schedule (e.g., "CS101 Lecture on Mon, Wed at 10:00 AM") and cross-references it with the university's academic calendar (`data/academicCalendar.ts`).
    - **Output:** It generates a structured JSON object containing a list of suggested recurring ride plans. The AI calculates the optimal pickup time to ensure the student arrives ~15 minutes early and provides a friendly reason for its suggestion (e.g., "To get you to your exam on time.").

2.  **Dynamic Fare Calculator (`ai/FareCalculator.ts`)**
    - **Method:** Simulates a predictive model using historical data for popular campus routes.
    - **Functionality:** Calculates a fare estimate based on:
        - Base fare (different for Solo vs. Shared).
        - Estimated distance and time charges.
        - A dynamic **surge multiplier** that increases fares during peak hours (e.g., 8-10 AM) and late at night, capped at 1.5x to ensure fairness.

3.  **Eco-Nudge Engine (`ai/EcoNudgeEngine.ts`)**
    - **Method:** Simulates a simple Reinforcement Learning (PPO) model.
    - **Functionality:** Identifies specific high-impact scenarios (like a student booking a solo ride late at night) and "nudges" them with a discount to choose a more eco-friendly shared ride instead. This system also calculates driver bonuses for eco-friendly actions.

---

## 🛠️ Tech Stack

- **Frontend:** React, TypeScript, Vite/esbuild (via import maps)
- **Styling:** Bootstrap 5, Font Awesome, Custom CSS with theming variables for Light/Dark modes.
- **Backend & Database:** Firebase (Authentication, Realtime Database, Cloud Storage).
- **APIs:**
    - **Google Gemini API:** For the AI Ride Scheduler.
    - **Google Maps JavaScript API:** For live map tracking.
- **State Management:** React Context API for centralized state management (`FirebaseContext`, `ThemeContext`).
- **PWA Features:** Offline support via a booking queue stored in `localStorage`.

---

## 🚀 Getting Started

This application is designed to run in a web-based development environment where Firebase and Google Cloud API keys can be securely managed.

### Demo Accounts

You can test the application using the following pre-configured demo accounts:

-   **Student Account:**
    -   **Email:** `student@test.com`
    -   **Password:** `password`

-   **Driver Account:**
    -   **Email:** `driver@test.com`
    -   **Password:** `password`

---

## 📁 Project Structure

```
.
├── ai/
│   ├── FareCalculator.ts   # Calculates ride fares with surge pricing.
│   ├── EcoNudgeEngine.ts   # Suggests eco-friendly options and calculates driver bonuses.
│   └── Scheduler.ts        # Interfaces with Gemini API to generate ride plans.
├── components/
│   ├── GoogleMap.tsx       # Renders the live map.
│   ├── StudentHeatmap.tsx  # Visualizes ride request density for drivers.
│   └── ...                 # Other reusable UI components.
├── contexts/
│   ├── FirebaseContext.tsx # Manages all Firebase interactions and application state.
│   ├── ThemeContext.tsx    # Manages light/dark mode.
│   └── ...                 # Other context providers.
├── data/
│   └── academicCalendar.ts # Static data for the AI scheduler.
├── views/
│   ├── StudentDashboard.tsx # Main interface for students.
│   ├── DriverDashboard.tsx  # Main interface for drivers.
│   ├── AuthScreen.tsx       # Login and registration view.
│   └── ...                  # Other top-level screen components.
├── firebase.ts               # Firebase SDK initialization.
├── types.ts                  # Core TypeScript type definitions.
├── App.tsx                   # Main app component, handles routing and layout.
└── index.html                # The entry point of the PWA.
```
