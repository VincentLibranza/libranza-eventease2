# EventEase – Event Registration & Attendance System

EventEase is a modern, web-based system designed for schools, student organizations, and small event organizers to manage event registrations and attendance digitally.

## 🚀 Features

- **Admin Dashboard**: Real-time monitoring of event stats and participant trends.
- **AI Attendance Prediction**: Uses Gemini AI to predict attendance for future events based on historical data.
- **Digital Registration**: Easy-to-use forms for participants.
- **Attendance Tracking**: Digital check-in system with CSV report export.
- **AI Assistant**: Built-in chatbot to answer event-related FAQs.
- **SDG Aligned**: Supports SDG 9 (Innovation) and SDG 11 (Sustainable Communities) by reducing paper waste.

## 🛠️ Tech Stack

- **Frontend**: React 19, Tailwind CSS 4, Motion, Lucide Icons.
- **Backend**: Node.js, Express.
- **Database**: SQLite (`better-sqlite3`).
- **AI**: Google Gemini API (`@google/genai`).

## 📦 Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/YOUR_USERNAME/eventease.git
   cd eventease
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file based on `.env.example` and add your `GEMINI_API_KEY`.

4. Start the development server:
   ```bash
   npm run dev
   ```

## 📄 License

This project is licensed under the Apache-2.0 License.
