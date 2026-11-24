/* send-reminders: the daily reminder for devices that turned it on while signed in.
   pg_cron calls it every 5 minutes (supabase/reminders-cron.sql). For each device whose reminder time
   has passed today in its own time zone, it reads that user's habits and, if some of today's are still
   unticked, sends a Web Push notification. Each device gets at most one reminder per day.

   Secrets (supabase secrets set --env-file supabase/.local/reminders.env):
     VAPID_KEYS     the VAPID key pair as JSON (JWK); its public half is vapidPublicKey in config.js
     VAPID_SUBJECT  contact URL sent to push services
     CRON_SECRET    the x-cron-secret header pg_cron sends
   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase. Deploy with --no-verify-jwt:
   the function checks CRON_SECRET itself. */
import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import * as webpush from "jsr:@negrel/webpush@0.5.0";
import { isDue, leftToday, localNow, pushHostOk, reminderText, sameSecret } from "./logic.mjs";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let server: webpush.ApplicationServer | null = null;
async function appServer() {
  if (!server) {
    const keys = await webpush.importVapidKeys(JSON.parse(Deno.env.get("VAPID_KEYS")!));
    server = await webpush.ApplicationServer.new({
      contactInformation: Deno.env.get("VAPID_SUBJECT") || "https://legend0x01.github.io/habit-tracker/",
      vapidKeys: keys,
    });
  }
  return server;
}

const forget = (endpoint: string) => db.from("push_subscriptions").delete().eq("endpoint", endpoint);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });
  if (!sameSecret(req.headers.get("x-cron-secret"), Deno.env.get("CRON_SECRET"))) {
    return new Response("Forbidden", { status: 403 });
  }

  const { data: subs, error } = await db.from("push_subscriptions")
    .select("endpoint,user_id,p256dh,auth,remind_at,tz,last_sent");
  if (error) {
    console.error("loading subscriptions failed", error);
    return new Response("Database error", { status: 500 });
  }

  const now = new Date(), years = new Map<string, unknown>();
  const out = { checked: subs.length, sent: 0, allDone: 0, removed: 0, failed: 0 };

  for (const s of subs) {
    let t;
    try { t = localNow(now, s.tz) } catch { continue } // unknown time zone
    if (!isDue(s, t)) continue;

    // claim today's reminder for this device first, so an overlapping run can't send it twice
    const { data: claimed } = await db.from("push_subscriptions").update({ last_sent: t.day })
      .eq("endpoint", s.endpoint).or(`last_sent.is.null,last_sent.neq.${t.day}`).select("endpoint");
    if (!claimed?.length) continue;

    const key = `${s.user_id}:${t.y}`;
    if (!years.has(key)) {
      const { data: row } = await db.from("habit_years").select("data")
        .eq("user_id", s.user_id).eq("year", t.y).maybeSingle();
      years.set(key, row?.data ?? null);
    }
    const left = leftToday(years.get(key), t.y, t.m, t.d);
    if (!left || !left.length) { out.allDone++; continue } // everything's ticked: no nagging

    if (!pushHostOk(s.endpoint)) { await forget(s.endpoint); out.removed++; continue }
    try {
      const sub = (await appServer()).subscribe({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } });
      await sub.pushTextMessage(
        JSON.stringify({ title: "Habit Tracker", body: reminderText(left), tag: "daily-reminder" }),
        { ttl: 4 * 3600, urgency: webpush.Urgency.Normal }, // an evening reminder is pointless the next morning
      );
      out.sent++;
    } catch (e) {
      const status = e instanceof webpush.PushMessageError ? e.response.status : 0;
      if (status === 404 || status === 410) { await forget(s.endpoint); out.removed++ } // the browser dropped it
      else { // temporary failure: release today's claim so the next run (5 minutes later) tries again
        out.failed++; console.warn("push failed", status || e);
        await db.from("push_subscriptions").update({ last_sent: s.last_sent }).eq("endpoint", s.endpoint);
      }
    }
  }

  return Response.json(out);
});
