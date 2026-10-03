# Test on your own computer

The GitHub repository contains the application and its lockfile. Dependencies, build output, environment credentials and the cloud demo database are excluded from Git. Your computer creates its own synthetic demo data automatically. You do not need a Supabase account, Docker or phone credentials for this review.

## 1. Install Node.js

Install Node.js 24 LTS from https://nodejs.org. npm is included. Reopen your terminal after installation, then check:

```sh
node --version
npm --version
```

Node should report `v24.x`. The cloud checks used Node 24.19.0.

## 2. Clone and open the source

Install Git from https://git-scm.com/downloads if needed. Open a terminal where you want to keep the project, then run:

```sh
git clone https://github.com/KarolSongin/Cleaning-Maidstone.git
cd Cleaning-Maidstone
```

If you already cloned this repository, enter that existing folder and run `git pull origin main` instead. Open the folder in VS Code or another editor. Continue in a terminal in the directory containing `package.json`.

## 3. Install dependencies

```sh
npm ci
```

## 4. Enable the local demo

On macOS/Linux:

```sh
cp .env.example .env.local
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env.local
```

Do this once on the fresh checkout, without overwriting an existing `.env.local`. The supplied example has `DEMO_MODE=local`, blank live integration keys and recording/transcription disabled. Leave those settings as supplied for testing. Canonicals deliberately continue to refer to the business domain; they do not send demo form data there.

## 5. Build and start

```sh
npm run build
npm run start
```

Keep that terminal running. On your own computer, open `http://127.0.0.1:3000` in a browser. This address is your local server, not the cloud preview or the existing business website.

## 6. Try the application

- Browse the homepage, service page, About, Pricing, Contact and Journal. In browser developer tools, check a narrow/mobile viewport. Check the matching photo heroes and their links to page details or the enquiry form. The room explorer is removed from the homepage.
- Submit an enquiry using made-up contact details. It persists locally and does not contact the business or confirm a booking.
- Open `http://127.0.0.1:3000/login/` and click **Admin demo**. No password is needed for the demo button. Review enquiries/customers, calendar day/week/month views, assignments, availability/leave, content editor and conversations.
- Try creating a customer and visit, moving an occurrence and publishing a draft article. For recurrence, choose Weekly or Fortnightly and set **Booking period (1–52 weeks)**. At 52 weeks, the preview shows 52 weekly or 26 fortnightly visits and the exact end date. Open **Recurring bookings** to review start/end dates, search/filter the list and add a renewal follow-up task. A short booking ending within a month also appears on the overview. Use the explicitly labelled sample-call action to populate synthetic conversation events; there are no real calls or playable sample audio.
- When creating a booking, enter **Customer hourly rate (£)**, **Admin hourly share (£)** and **Cleaner hourly cash pay (£)**. For example £18 / £3 / £15 over 1.5 hours previews £27 customer charge, £4.50 admin share and £22.50 cleaner cash. Try an incorrect split to check validation. The same rates apply to each recurring visit. Select a visit in the calendar and use **Save visit rates** to price or adjust that occurrence. Existing visits initially have no rates. In **Recurring bookings**, review the original agreed split per regular visit.
- Under **Cleaners**, create a synthetic profile with selected working days and times. Add a second period to test a lunch break, then use **Edit hours** to change the schedule. Under **Calendar**, select one or several cleaners: free hours turn green, and shared free time becomes a deeper shade. Bookings and approved leave remove free time; **Available time slots** lists the times and cleaner names.
- Sign out, return to the login page and click **Cleaner demo**. Check both **List view** and **Calendar view**, switch between day/week/month and select a visit for its details. The calendar is read-only; admins manage the schedule. Each priced visit shows the cleaner’s cash rate and cash amount; customer prices and admin shares stay private. Cash collection and Stripe subscription billing are not connected yet. Started/completed actions and availability/leave requests still work.
- The cleaner's **Your weekly availability** panel is read-only. Requests do not change approved hours until an admin approves them. Restarting the app automatically upgrades the existing demo schema and preserves its records; do not delete `.local/database` to install this update.
- Restart the app and confirm changes remain. Demo data lives under `.local/` on your computer.

Use synthetic data. The server binds to your computer's loopback interface; keep demo access local.

## Optional automated checks

Stop the app with **Ctrl+C**, then run:

```sh
npm run lint
npm run typecheck
npm run test
```

For the browser journeys, install Playwright's Chromium and point the existing configuration at its executable.

macOS/Linux:

```sh
npx playwright install chromium
export CHROMIUM_PATH="$(node -p 'require("@playwright/test").chromium.executablePath()')"
npm run test:e2e
```

Windows PowerShell:

```powershell
npx playwright install chromium
$env:CHROMIUM_PATH = node -p "require('@playwright/test').chromium.executablePath()"
npm run test:e2e
```

The production build from step 5 is required. Browser tests start their own server on port 3001 and use a separate fresh database. On Linux, install Chromium system dependencies if Playwright reports missing libraries. The current cloud checks passed 66 focused tests and 28 desktop/mobile browser journeys, including private booking rates, cash pay, partial-hour totals, full-year recurring bookings, renewal follow-ups, recurring hours and free-capacity shading. Earlier public refinements passed delivered-image, motion and responsive-layout checks. See [verification.md](verification.md).

## Make changes later

Stop the production server with **Ctrl+C**, then use:

```sh
npm run dev
```

This enables automatic updates when you edit source files. Keep only one application process using the normal demo database at a time. After editing, stop development mode and run `npm run build` followed by `npm run start` to review the production version again.

To get subsequent GitHub updates, stop the app, run `git pull origin main` followed by `npm ci`, then rebuild and restart. Your ignored `.env.local` and `.local/` demo data remain on your computer.

For the next design iteration, record the page/section, viewport size and desired change. Live Supabase, phone routing, recording/transcription and deployment can be connected separately after reviewing the local foundation.
