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
- Open **Customer pipeline**. Your website enquiry appears as an Opportunity. Use **Add opportunity** for a phone call/referral without knowing the address yet. Move it to **Contacted for details** or **Quote given**, record a note and optionally set a next contact date. Add the home details with **Create customer profile**, or explicitly link a returning enquiry to an existing customer to avoid duplicates. Expand **Book first cleaning**; the booking moves the stage automatically. Cancel it to return to the earlier stage, or reschedule to change the follow-up date. A synthetic visit on a past date immediately moves to **Contact for recurring agreement**; contacts due also appear on the overview. Confirm **Onboarded regular client** only after agreeing the recurring arrangement. Reload to check the stage/history remain. Acquisition data stays admin-only. The local server clock runs every minute with the browser closed; the app must be running. Live deployments need the scheduler described in the README.
- Try creating a customer and visit, moving an occurrence and publishing a draft article. For recurrence, choose Weekly or Fortnightly and set **Booking period (1–52 weeks)**. At 52 weeks, the preview shows 52 weekly or 26 fortnightly visits and the exact end date. Open **Recurring bookings** to review start/end dates, search/filter the list and add a renewal follow-up task. A short booking ending within a month also appears on the overview. Use the explicitly labelled sample-call action to populate synthetic conversation events; there are no real calls or playable sample audio.
- When creating a booking, enter **Customer hourly rate (£)**, **Admin hourly share (£)** and **Cleaner hourly cash pay (£)**. For example £18 / £3 / £15 over 1.5 hours previews £27 customer charge, £4.50 admin share and £22.50 cleaner cash. Try an incorrect split to check validation. The same rates apply to each recurring visit. Select a visit in the calendar and use **Save visit rates** to price or adjust that occurrence. Existing visits initially have no rates. In **Recurring bookings**, review the original agreed split per regular visit.
- Open **Finances** in the admin navigation. Review completed earnings, future booked forecast and past visits awaiting completion. Try date shortcuts/custom boundaries together with a customer and cleaner filter, switch the breakdown between customers and cleaners, and select a month. Review unpriced visits, edit a visit’s rates and refresh after a cancellation. CSV exports every matching visit across pages; its figures follow the selected filters. Payment receipts and Stripe are still future work.
- Under **Cleaners**, create a synthetic profile with selected working days and times. Add a second period to test a lunch break, then use **Edit hours** to change the schedule. Under **Calendar**, select one or several cleaners: free hours turn green, and shared free time becomes a deeper shade. Bookings and approved leave remove free time; **Available time slots** lists the times and cleaner names.
- Sign out, return to the login page and click **Cleaner demo**. Check both **List view** and **Calendar view**, switch between day/week/month and select a visit for its details. The calendar is read-only; admins manage the schedule. Each priced visit shows the cleaner’s cash rate and cash amount; customer prices and admin shares stay private. Cash collection and Stripe subscription billing are not connected yet. Started/completed actions and availability/leave requests still work.
- The cleaner's **Your weekly availability** panel is read-only. Requests do not change approved hours until an admin approves them. Restarting the app automatically upgrades the existing demo schema and preserves its records; do not delete `.local/database` to install this update.
- Book a few synthetic one-off/recurring cleans for Jamie, then sign in as **Cleaner demo** and use **Request time off** for dates covering those visits. Return to **Admin demo**: the overview links to pending requests. Under **Cleaners → Time-off requests & cover**, check every affected customer, address, date/time and duration. **Approve** stays disabled while cover is needed. Use **Assign cover** to see only cleaners free for the whole visit. A lunch break, partial booking overlap, approved leave or insufficient working hours excludes a cleaner. The options refresh on opening; cancelling a conflicting booking and using **Refresh** makes a fully available cleaner appear again. If nobody qualifies, a clear message replaces the dropdown. A booking created after selection still rejects the save. **Open visit** selects that visit and opens its calendar week for rescheduling. Covering, moving or cancelling an occurrence removes it from the list. Once clear, approve the request and confirm the cleaner cannot be booked on approved leave. Completed/cancelled visits need no cover, and reassigning an occurrence preserves its agreed rates and sibling visits. Requests stay pending until explicitly approved or declined. Existing local data automatically receives the additive migration; live Supabase needs `202610030005_leave_cover.sql` applied separately.
- Check red circles beside admin menu links. A pending leave or availability request increases **Cleaners**; reviewing it decreases the count, while simply opening the page leaves it unchanged. Keep an admin window on **Customers**, submit a cleaner request in a separate private browser window, then return to the admin window to see its badge update. Counts also refresh every minute while visible. Add a due follow-up on the overview and complete it to check the **Overview** badge clears. Hover/focus each flagged link for the type of work it counts.
- Cleaner names should have a pink background and customer/contact names a gold background across profiles, pipeline, recurring bookings, financial reports, cover requests, both calendars and name selection fields. Check both desktop and mobile; names remain readable and calendar actions still work.
- In **Recurring bookings**, choose **Delete series** on a synthetic booking. Check the customer, cleaner, period and visit counts in the popup. Try **Go back** and Escape: the booking should remain and focus should return to its button. Confirm deletion, reload, then check upcoming unstarted occurrences are gone while past/completed/in-progress visits and their cash/rate history remain. Other bookings are unaffected. The local app applies the new migration automatically; a live Supabase project needs `202610030006_series_deletion.sql`.
- Try saving a customer, booking or rate, reviewing a cleaner request, changing a pipeline stage, publishing/unpublishing content and dragging a calendar visit. Each write waits for the confirmation popup. Cancelling retains form entries, keeps the original calendar position and creates no success message. Image/section/working-period removals and call-recording deletion also require confirmation.
- Under **Customers** or **Cleaners**, try **Delete customer** / **Delete cleaner** on a synthetic profile. Upcoming/in-progress cleans appear in a blocking list with **Open visit** links; cancel them, finish active work or assign cleaner cover first. The options check fresh assignments, and the server rejects a booking added while confirmation is open. Try Go back/Escape, then confirm: the profile leaves active lists and booking dropdowns. **Show deleted customer/cleaner profiles** reveals the retained history without editing controls. Finances still offers deleted profiles for reporting. Deleted customers' pipeline records close and follow-up reminders stop; deleted cleaners lose access even with an existing session and pending requests are declined. Local startup applies `202610030007_profile_deletion.sql` without resetting data; apply it separately to live Supabase. Avoid deleting Jamie in your normal demo if you want to keep using the fixed Cleaner demo sign-in.
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

The production build from step 5 is required. Browser tests start their own server on port 3001 and use a separate fresh database. On Linux, install Chromium system dependencies if Playwright reports missing libraries. The current cloud checks passed 149 automated tests and all 52 desktop/mobile browser journeys, including history-preserving profile deletion, assigned-work blocking, stale-write rejection, removed cleaner access, confirmations and whole-visit candidate filtering, empty results, stale-selection rejection, cleaner time-off requests, complete affected-clean lists, conflicting cover rejection, rescheduling, approval after cover, preserved recurring rates, website/manual acquisition, linked profiles, automatic first-clean follow-up, stage history and access controls, admin financial reports, date/customer/cleaner filters, monthly drill-down, full CSV exports, private booking rates, cash pay, partial-hour totals, full-year recurring bookings, renewal follow-ups, recurring hours and free-capacity shading. Earlier public refinements passed delivered-image, motion and responsive-layout checks. See [verification.md](verification.md).

## Make changes later

Stop the production server with **Ctrl+C**, then use:

```sh
npm run dev
```

This enables automatic updates when you edit source files. Keep only one application process using the normal demo database at a time. After editing, stop development mode and run `npm run build` followed by `npm run start` to review the production version again.

To get subsequent GitHub updates, stop the app, run `git pull origin main` followed by `npm ci`, then rebuild and restart. Your ignored `.env.local` and `.local/` demo data remain on your computer.

For the next design iteration, record the page/section, viewport size and desired change. Live Supabase, phone routing, recording/transcription and deployment can be connected separately after reviewing the local foundation.
