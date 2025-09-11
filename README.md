# Campus Shuttle - Smart PWA

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A modern, responsive Progressive Web App (PWA) for a campus shuttle service. This application connects students and drivers with a feature-rich platform that includes real-time booking, live map tracking, an AI-powered eco-incentive system, and data-driven insights for drivers.

The UI is designed with a sleek, dark aesthetic, featuring dynamic background effects for an immersive user experience.

<!-- Add a live demo link here if available -->
<!-- **Live Demo:** [https://your-campus-shuttle.web.app](https://your-campus-shuttle.web.app) -->

---

## ✨ Key Features

### For Students
- **Dual Booking Modes:** Book rides for immediate pickup ("ASAP") or schedule them for a future time.
- **Flexible Ride Options:** Choose between a private "Solo" ride or a cost-effective "Shared" ride.
- **Live Map Tracking:** See your driver's location in real-time on an integrated Google Map.
- **Driver Ratings & Feedback:** Rate your driver after each ride to ensure service quality.
- **AI-Powered Eco-Nudges:** Receive suggestions for greener ride options (like switching to a shared ride) with fare discounts as an incentive.
- **Eco-Analytics:** Track your personal environmental impact with statistics on CO2 savings.
- **Ride History:** View a list of your recent trips.
- **Safety Features:** Placeholder buttons for "Share Ride Details" and "Emergency Contact".

### For Drivers
- **Real-time Status:** Toggle between "Online" and "Offline" states to manage availability.
- **Ride Request Management:** Receive and respond to student ride requests in real-time.
- **Student Activity Heatmap:** Visualize peak hours and popular locations with a dynamic heatmap, helping you maximize earnings by identifying high-demand periods.
- **AI-Powered Eco-Bonuses:** Earn extra bonuses for completing rides with an Electric Vehicle (EV) or by taking shared rides.
- **Dashboard Analytics:** Track daily rides, earnings, and average rating at a glance.
- **Eco-Analytics:** See your positive environmental impact through CO2 savings.

### General & Technical
- **Modern UI/UX:** A sleek, dark-themed interface with custom-styled components, gradient buttons, and an atmospheric "Tyndall effect" background.
- **Responsive Design:** Fully functional and aesthetically pleasing on both mobile and desktop devices.
- **Secure Authentication:** Firebase-powered email and password authentication for students and drivers.
- **Real-time Database:** All ride data, user profiles, and requests are synced in real-time using Firebase Realtime Database.
- **PWA Ready:** Configured as a Progressive Web App for a native-like app experience.

---

## 📸 Screenshots

<!-- Add screenshots of the application here -->
| Student Dashboard | Driver Dashboard |
| :---: | :---: |
| *<img src="path/to/student_dashboard.png" width="400" alt="Student Dashboard"></img>* | *<img src="path/to/driver_dashboard.png" width="400" alt="Driver Dashboard"></img>* |
| **Ride Request Heatmap** | **Rating Modal** |
| *<img src="path/to/heatmap.png" width="400" alt="Student Activity Heatmap"></img>* | *<img src="path/to/rating_modal.png" width="400" alt="Rating Modal"></img>* |


---

## 🛠️ Tech Stack

- **Frontend:** React, TypeScript
- **Backend & Database:** Firebase (Realtime Database, Authentication)
- **Mapping:** Google Maps API
- **Styling:** Custom CSS, Bootstrap 5, Font Awesome
- **AI Simulation:** Rule-based engine in TypeScript (`EcoNudgeEngine.ts`)

---

## 🚀 Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or later)
- `npm` or `yarn` package manager

### Installation & Configuration

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/your-username/campus-shuttle.git
    cd campus-shuttle
    ```

2.  **Install dependencies:**
    ```sh
    npm install
    ```

3.  **Configure Firebase:**
    - Create a new project on the [Firebase Console](https://console.firebase.google.com/).
    - Enable **Authentication** (Email/Password method).
    - Create a **Realtime Database**.
    - In your project settings, find your web app's Firebase configuration object.
    - Replace the placeholder configuration in `src/firebase.ts` with your own.

4.  **Configure Google Maps API:**
    - Go to the [Google Cloud Console](https://console.cloud.google.com/).
    - Create a new project and enable the **Maps JavaScript API** and **Maps SDK for Android/iOS**.
    - Get your API key.
    - Open `index.html` and replace the placeholder `YOUR_API_KEY` in the Google Maps script URL with your actual key.
    ```html
    <script src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&libraries=marker&callback=initMap" async defer></script>
    ```

5.  **Run the application:**
    ```sh
    npm start
    ```
    The application should now be running on `http://localhost:3000`.

### Demo Accounts
To log in, use the following credentials:
- **Student:** `student@test.com` (Password: `password`)
- **Driver:** `driver@test.com` (Password: `password`)

---

## 📂 Project Structure

The project follows a standard React application structure, organizing files by feature and type.
/
├── public/
│ └── index.html # Main HTML file, Google Maps API key
├── src/
│ ├── ai/ # AI simulation logic (EcoNudgeEngine)
│ ├── components/ # Reusable React components (Header, Map, etc.)
│ ├── contexts/ # React Context for global state (Firebase)
│ ├── hooks/ # Custom hooks (e.g., useMockData)
│ ├── views/ # Main screen components (Dashboards, Auth)
│ ├── App.tsx # Main application component and routing
│ ├── firebase.ts # Firebase configuration and initialization
│ ├── index.tsx # Application entry point
│ └── types.ts # TypeScript type definitions
├── .gitignore
├── metadata.json # PWA configuration
├── package.json
└── README.md
