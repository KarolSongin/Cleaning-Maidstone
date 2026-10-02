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

- Browse the homepage, service page, About, Pricing, Contact and Journal. In browser developer tools, check a narrow/mobile viewport. Click “Explore the room” to activate 3D; its static illustration and HTML task controls remain available if WebGL is unavailable.
- Submit an enquiry using made-up contact details. It persists locally and does not contact the business or confirm a booking.
- Open `http://127.0.0.1:3000/login/` and click **Admin demo**. No password is needed for the demo button. Review enquiries/customers, calendar day/week/month views, assignments, availability/leave, content editor and conversations.
- Try creating a customer and visit, moving an occurrence and publishing a draft article. Use the explicitly labelled sample-call action to populate synthetic conversation events; there are no real calls or playable sample audio.
- Sign out, return to the login page and click **Cleaner demo**. Check both **List view** and **Calendar view**, switch between day/week/month and select a visit for its details. The calendar is read-only; admins manage the schedule. Started/completed actions and availability/leave requests still work.
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

The production build from step 5 is required. Browser tests start their own server on port 3001 and use a separate fresh database. On Linux, install Chromium system dependencies if Playwright reports missing libraries. The verified cloud results were 21 focused tests and 20 browser journeys; see [verification.md](verification.md).

## Make changes later

Stop the production server with **Ctrl+C**, then use:

```sh
npm run dev
```

This enables automatic updates when you edit source files. Keep only one application process using the normal demo database at a time. After editing, stop development mode and run `npm run build` followed by `npm run start` to review the production version again.

To get subsequent GitHub updates, stop the app, run `git pull origin main` followed by `npm ci`, then rebuild and restart. Your ignored `.env.local` and `.local/` demo data remain on your computer.

For the next design iteration, record the page/section, viewport size and desired change. Live Supabase, phone routing, recording/transcription and deployment can be connected separately after reviewing the local foundation.
