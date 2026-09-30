import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

Deno.serve(async (request) => {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const cronSecret = Deno.env.get('CRON_SECRET')
  if (cronSecret && request.headers.get('x-cron-secret') !== cronSecret) {
    return new Response('Unauthorized', { status: 401 })
  }

  const resendKey = Deno.env.get('RESEND_API_KEY')
  const fromEmail = Deno.env.get('REMINDER_FROM_EMAIL')
  if (!resendKey || !fromEmail) return new Response('Email service is not configured', { status: 500 })

  const { data: notes, error: notesError } = await supabase
    .from('notes')
    .select('id, user_id, title, body, reminder_at')
    .lte('reminder_at', new Date().toISOString())
    .is('reminder_sent_at', null)
    .limit(100)

  if (notesError) return Response.json({ error: notesError.message }, { status: 500 })

  let sent = 0
  for (const note of notes ?? []) {
    const { data: userResult, error: userError } = await supabase.auth.admin.getUserById(note.user_id)
    const email = userResult.user?.email
    if (userError || !email) continue

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: fromEmail,
        to: [email],
        subject: `Reminder: ${note.title}`,
        text: `${note.body}\n\nThis reminder was scheduled in The Marginalia.`,
      }),
    })
    if (!emailResponse.ok) continue

    await supabase.from('notes').update({ reminder_sent_at: new Date().toISOString() }).eq('id', note.id)
    sent += 1
  }

  return Response.json({ sent })
})