import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
const fromEmail = Deno.env.get("REMINDER_FROM_EMAIL")!;
const cronSecret = Deno.env.get("CRON_SECRET")!;

const supabase = createClient(
  supabaseUrl,
  supabaseServiceKey
);

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");

    if (authHeader !== `Bearer ${cronSecret}`) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { data: reminders, error } = await supabase
      .from("notes")
      .select("id, title, body, reminder_at, user_id")
      .is("reminder_sent_at", null)
      .not("reminder_at", "is", null)
      .lte("reminder_at", new Date().toISOString());

    if (error) {
      throw error;
    }

    let sent = 0;

    for (const reminder of reminders ?? []) {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.admin.getUserById(
        reminder.user_id
      );

      if (userError || !user?.email) {
        console.error(
          "Could not find email for user:",
          reminder.user_id
        );
        continue;
      }

      const emailResponse = await fetch(
        "https://api.resend.com/emails",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [user.email],
            subject: `🔔 Reminder: ${reminder.title}`,
            html: `
              <h2>🔔 ${reminder.title}</h2>
              <p>${reminder.body}</p>
              <p>This is your scheduled reminder.</p>
            `,
          }),
        }
      );

      if (!emailResponse.ok) {
        console.error(
          "Resend error:",
          await emailResponse.text()
        );
        continue;
      }

      const { error: updateError } = await supabase
        .from("notes")
        .update({
          reminder_sent_at: new Date().toISOString(),
        })
        .eq("id", reminder.id);

      if (updateError) {
        console.error(
          "Could not mark reminder as sent:",
          updateError
        );
        continue;
      }

      sent++;
    }

    return new Response(
      JSON.stringify({
        success: true,
        remindersSent: sent,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error(error);

    return new Response(
      JSON.stringify({
        error: "Something went wrong",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
});