# The Marginalia

> A quiet, private space for capturing thoughts and remembering what matters.

The Marginalia is a personal notes application built with React, TypeScript,
Vite, and Supabase. Users can create an account, write private notes, attach
reminders, and manage their notes from a simple reading-room-style interface.

## 📌 Problem

Small ideas, personal reflections, and important follow-ups are easy to lose
among chat messages, browser tabs, and scattered paper notes.

Many note-taking tools are also overloaded with features when someone simply
wants a private place to write something down and remember it later.

The Marginalia addresses this by providing a focused, private space where users
can:

- Create an account and sign in securely
- Write and save personal notes
- Add a date and time reminder
- Receive a browser notification when a reminder is due
- Delete notes they no longer need

---

## 💡 Solution

The Marginalia combines:

- **React and TypeScript** for the interactive web interface
- **Vite** for fast local development and production builds
- **Supabase Auth** for email/password authentication
- **Supabase Postgres** for persistent note storage
- **Postgres Row-Level Security** to isolate each user's notes
- **Browser Notifications** for reminders while the app is open
- **Supabase Edge Functions and Resend** for email reminders
- **Vercel** for hosting and deployment

The browser communicates with Supabase using the public anon key. Database
policies ensure that a signed-in user can read, create, and delete only notes
belonging to that user.

---

## ✨ Features

### 🔐 Authentication

- Email/password sign up
- Email/password sign in
- Email confirmation support through Supabase Auth
- User identity and sign-out control in the header

### 📝 Personal Notes

Users can:

- Add a title and body to a note
- View their saved notes in reverse chronological order
- Delete their own notes
- Keep notes private through database-level security policies

### ⏰ Browser Reminders

- Add a reminder date and time to a note
- Request browser notification permission when reminders are used
- Check due reminders every 30 seconds while the application is open
- Avoid showing the same reminder more than once in the browser

### 📧 Email Reminders

The `send-reminders` Supabase Edge Function:

1. Find notes whose reminder time has passed
2. Look up the note owner's email address
3. Send a reminder through Resend
4. Mark the reminder as sent

requires a scheduler to call the function periodically and works alongside
browser notifications.

---

## 🏗️ Architecture

```text
                         ┌──────────────────────┐
                         │        USER          │
                         │  Sign in and write   │
                         │       personal notes │
                         └──────────┬───────────┘
                                    │
                                    ▼
                         ┌──────────────────────┐
                         │      Vercel          │
                         │  React + Vite client │
                         └──────────┬───────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
          ┌──────────────────┐            ┌────────────────────┐
          │  Supabase Auth   │            │  Supabase Postgres │
          │ Email/password   │            │ notes + RLS        │
          └────────┬─────────┘            └─────────┬──────────┘
                   │                               │
                   │                               │
                   ▼                               ▼
          ┌──────────────────┐            ┌────────────────────┐
          │ Authenticated    │            │ Browser reminders  │
          │ user session      │            │ Notification API   │
          └──────────────────┘            └────────────────────┘
                                                   │
                                                   │ scheduled
                                                   ▼
                                      ┌────────────────────────┐
                                      │ Supabase Edge Function  │
                                      │    send-reminders       │
                                      └───────────┬────────────┘
                                                  │
                                                  ▼
                                      ┌────────────────────────┐
                                      │       Resend API        │
                                      │  Background email       │
                                      └────────────────────────┘
```

### Application flow

1. Vercel serves the compiled React/Vite application.
2. The browser creates a Supabase client using the `VITE_*` environment
   variables.
3. Supabase Auth manages the user's session.
4. The client reads, inserts, and deletes notes through Supabase.
5. Postgres RLS checks `auth.uid() = user_id` for every user-facing operation.
6. The browser checks due reminders locally every 30 seconds.
7. A scheduler calls the Edge Function for email reminders.

---

## 🗄️ Supabase PostgreSQL Database

Supabase provides the hosted PostgreSQL database and dashboard used by the
project. The database definition is in
[`supabase/schema.sql`](./supabase/schema.sql).

### `notes`

The `notes` table stores each user's personal notes and reminder state.

Important fields include:

- `id` - UUID primary key
- `user_id` - Supabase Auth user ID
- `title` - Note title
- `body` - Note contents
- `created_at` - Creation timestamp
- `reminder_at` - Reminder timestamp
- `reminder_sent_at` - Timestamp used by the email reminder function

### Database security

Row-level security is enabled on `notes` with policies that allow users to:

- Read only their own notes
- Insert notes only with their own `user_id`
- Delete only their own notes

The reminder index makes it efficient for the Edge Function to find notes that
are due and have not yet been sent.

---

## 🛠️ Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, TypeScript |
| Build tool | Vite |
| Authentication | Supabase Auth |
| Database | PostgreSQL through Supabase |
| Database security | PostgreSQL Row-Level Security |
| Browser reminders | Web Notifications API |
| Email reminders | Supabase Edge Functions and Resend |
| Hosting | Vercel |

---

## ⚙️ Local Setup

### Prerequisites

- Node.js 20 or newer
- npm
- A Supabase project

### 1. Clone the repository

```bash
git clone https://github.com/Pavani3001/postgres-project-The-Marginalia.git
cd postgres-project-The-Marginalia
```

### 2. Configure Supabase

1. Create a Supabase project.
2. Open **Authentication > Providers** and enable **Email**.
3. Open **Project Settings > API** and copy the project URL and anon key.
4. Open the Supabase **SQL Editor**, create a new query, paste the complete
   contents of [`supabase/schema.sql`](./supabase/schema.sql), and click
   **Run**.
5. Open **Table Editor** and refresh the page. You should now see the
   `public.notes` table.

The table is not created automatically when you clone or deploy this
repository. The SQL script must be executed in the same Supabase project used
by `VITE_SUPABASE_URL`.

To verify that the table was created, run this query in the Supabase SQL
Editor:

```sql
select table_schema, table_name
from information_schema.tables
where table_schema = 'public'
  and table_name = 'notes';
```

The expected result is `public | notes`. An empty table is normal until the
first user creates a note.

### 3. Configure environment variables

Copy the example file:

```bash
copy .env.example .env.local
```

On macOS/Linux:

```bash
cp .env.example .env.local
```

Set the values in `.env.local`:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Only use the public Supabase anon key in this file. Never expose the
Supabase service-role key in the browser or commit it to Git.

### 4. Install and run

```bash
npm install
npm run dev
```

Open the local URL printed by Vite, usually `http://localhost:5173`.

If email confirmation is enabled, confirm the email address before signing
in.

---

### 5. Configure email delivery

Browser reminders require the app to remain open. Email reminders use the
already included `send-reminders` Supabase Edge Function, so they can arrive
even when the application is closed.

#### Create a Resend sender

1. Create an account at [Resend](https://resend.com/).
2. Add and verify a sending domain, or use a verified Resend testing sender.
3. Create a Resend API key and keep it private.

The `REMINDER_FROM_EMAIL` address must belong to a verified Resend domain.

#### Link and deploy the Edge Function

Find the project reference in the Supabase dashboard URL or under
**Project Settings > General**, then run:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy send-reminders
```

#### Add the function secrets

Generate a long random value for `CRON_SECRET`, then set all three secrets:

```bash
npx supabase secrets set \
  RESEND_API_KEY=re_xxxxxxxxx \
  REMINDER_FROM_EMAIL=reminders@your-verified-domain.com \
  CRON_SECRET=replace-with-a-long-random-secret
```

These are server-side secrets. Do not add them to `.env.local`, Vercel
environment variables, or any `VITE_*` variable.

#### Schedule the function

Use Supabase Cron, GitHub Actions, or another scheduler to send a `POST`
request every minute to:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-reminders
```

The request must include the secret header:

```text
x-cron-secret: replace-with-a-long-random-secret
```

For example, a scheduler using cURL can run:

```bash
curl -X POST \
  -H "x-cron-secret: replace-with-a-long-random-secret" \
  https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-reminders
```

The function finds due notes, sends each reminder through Resend, and sets
`reminder_sent_at` only after the email and database update succeed. Check
**Supabase Dashboard > Edge Functions > send-reminders > Logs** if an email
does not arrive.

---

## 📁 Project Structure

```text
.
├── src/
│   ├── lib/supabase.ts       # Supabase client configuration
│   ├── App.tsx               # Authentication, notes, and reminders
│   ├── App.css               # Application styles
│   └── main.tsx              # React entry point
├── supabase/
│   ├── schema.sql            # Notes table and RLS policies
│   └── functions/
│       └── send-reminders/   # Email reminder function
├── public/                   # Static assets
├── .env.example              # Client environment variable template
└── package.json              # Scripts and dependencies
```

---

## ▶️ Available Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local Vite development server |
| `npm run build` | Run TypeScript checks and build for production |
| `npm run lint` | Check source files with Oxlint |
| `npm run preview` | Preview the production build locally |

Run the checks before deployment:

```bash
npm run lint
npm run build
```

---

## 🐛 Troubleshooting

- **Authentication is disabled:** Check both `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_ANON_KEY` in `.env.local`, then restart the dev server.
- **The `notes` table is not visible:** Confirm that the SQL script was run in
  the correct Supabase project, refresh **Table Editor**, and check that the
  table is under the `public` schema. The project URL in `.env.local` must
  match the Supabase project you are viewing.
- **Notes cannot be loaded or saved:** Run the full
  [`supabase/schema.sql`](./supabase/schema.sql) script and confirm the app
  points to the same Supabase project.
- **Browser reminders do not appear:** Allow notifications for the deployed
  site and keep the application tab open.
- **Email reminders do not arrive:** Check Edge Function logs, function
  secrets, the Resend sender domain, and the scheduler's `POST` request and
  `x-cron-secret` header.

---

## 🚀 Live Demo

https://postgres-plum.vercel.app/

---

## 🎥 Demo Video

https://youtu.be/mZMH92CJXbs?si=pRusw6pBDA2HrudD

---

## 📝 Medium Article

https://medium.com/@rithikamalthumkar1/the-marginalia-building-a-smart-notes-app-with-postgresql-supabase-automated-email-reminders-815afb3d6b96?postPublishedType=initial
