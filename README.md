# The Marginalia

The Marginalia is a small blogging app built with React, TypeScript, Vite, and Supabase Auth. Signed-in users can create, view, and delete personal notes, optionally attach a reminder time, and receive browser notifications while the app is open.

## Features

- Email/password sign up and sign in with Supabase Auth
- User details and sign-out control in the header
- Notes stored in Supabase with row-level security
- Optional reminder date and time on every note
- Browser notifications for due reminders while the app is open
- Optional background email reminders through a Supabase Edge Function and Resend

## Local Setup

1. Create a Supabase project and enable **Email** under **Authentication > Providers**.
2. Copy `.env.example` to `.env.local`.
3. Put your Supabase project URL and anon key in `.env.local`.
4. Open the Supabase **SQL Editor**, paste all of `supabase/schema.sql`, and run it once.
5. Start the app:

```bash
npm install
npm run dev
```

When email confirmation is enabled in Supabase, users must confirm their email before signing in.

## Background Email Reminders

The `supabase/functions/send-reminders` Edge Function finds due notes, sends an email through Resend, and marks each reminder as sent. Browser reminders do not require this function, but background email reminders do.

Install or run the Supabase CLI through `npx`, then authenticate and link the project:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase functions deploy send-reminders
```

Configure the function secrets:

```bash
npx supabase secrets set RESEND_API_KEY=your-resend-key REMINDER_FROM_EMAIL=reminders@your-domain.com CRON_SECRET=choose-a-secret
```

Configure a scheduler to send a `POST` request every minute to:

```text
https://YOUR_PROJECT_REF.supabase.co/functions/v1/send-reminders
```

Include this header:

```text
x-cron-secret: choose-a-secret
```

Supabase Cron, GitHub Actions, or another scheduler can call the endpoint.

## Commands

- `npm run dev` starts the local development server.
- `npm run build` runs TypeScript and creates a production build.
- `npm run lint` checks the source files.
