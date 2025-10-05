# Gemini Project Context: GoGoBike Bike Rental

## Project Overview

This project is **GoGoBike**, a full-stack electric bike rental service. The system is designed to operate primarily within the Telegram ecosystem as a **Telegram Mini App**.

The architecture consists of three main components:
1.  **Frontend**: A static vanilla JavaScript, HTML, and CSS application located in the `site/` directory. It serves as the main user interface for both regular users and administrators and is designed to be launched from within Telegram.
2.  **Backend**: A serverless API built with Node.js and hosted on Vercel. The function handlers are located in the `api/` directory.
3.  **Database**: **Supabase** is used as the primary database for storing all application data, including users, bikes, rentals, and payments. The backend interacts with it using the `@supabase/supabase-js` library.

### Key Technologies
- **Frontend**: HTML, CSS, Vanilla JavaScript
- **Backend**: Node.js (Vercel Serverless Functions)
- **Database**: Supabase
- **Payments**: YooKassa (inferred from API calls in `api/payments.js` and `api/admin.js`)
- **OCR**: Google Gemini API for document processing (`api/gemini-ocr.js`)
- **Telegram Integration**: The application is designed as a Telegram Mini App, and a companion bot (`telegram-bot.js`) is included to assist users.

## Building and Running

### 1. Backend & Frontend (Local Development)

The project is configured for Vercel. The standard way to run the frontend and backend locally is using the Vercel CLI.

```bash
# Install Vercel CLI if you haven't already
npm install -g vercel

# Run the development server from the project root
vercel dev
```
This command will serve the static frontend from the `site/` directory and run the serverless functions from the `api/` directory.

### 2. Telegram Bot

The companion Telegram bot can be run separately.

```bash
# Install dependencies for the bot
npm install

# Run the bot
npm start

# Or run in development mode with auto-reloading
npm run dev
```

**Note**: The bot requires a valid Telegram Bot Token to be set in `telegram-bot.js`.

## Development Conventions

*   **API Structure**: The backend API follows an action-based pattern. Single API files (e.g., `api/admin.js`) handle multiple functionalities distinguished by an `action` field in the POST request body.
*   **Database Interaction**: All backend services interact with the Supabase database via the official `@supabase/supabase-js` client. Several custom RPC functions (e.g., `add_to_balance`, `assign_bike_to_rental`) are defined in Supabase and called from the backend.
*   **Authentication**: User authentication seems to be handled via custom tokens stored in the `clients` table. The `/api/user` endpoint has a `verify-token` action.
*   **Configuration**: The project uses Vercel for deployment, with cron jobs and function settings defined in `vercel.json`. An older `netlify.toml` file is present but may be deprecated.
*   **Frontend Modularity**: The frontend JavaScript is split into modules for different concerns (e.g., `api.js` for Supabase calls, `ui.js` for rendering components, `main.js` for the main application logic).
*   **Telegram Mini App**: The frontend is intended to be used as a Telegram Mini App. The file `docu.txt` contains extensive documentation on the Mini App platform, which should be consulted when making frontend changes.
