// Push notifications: turning them on for this phone or browser, and the reminder settings.
// The reminders themselves are sent by /api/notify (see supabase/notifications.sql).
import { supabase } from "./supabase";
import { isInstalled } from "./install";
import { readGoals } from "./food";

export const DEFAULT_SETTINGS = { daily: true, days: [0, 1, 2, 3, 4, 5, 6], hour: 18, streak: true, comeback: true, food_meals: ["breakfast", "lunch", "dinner"], food_eod: true };

const timeZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } };
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

// "ok", "install" (iPhone and iPad only allow it once SendIt is on the Home Screen) or "unsupported".
export function pushSupport() {
  if (typeof window === "undefined") return "unsupported";
  const has = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  if (isIOS() && !isInstalled()) return "install";
  return has ? "ok" : "unsupported";
}

export const permission = () => (typeof Notification === "undefined" ? "default" : Notification.permission);

async function registration() {
  return (await navigator.serviceWorker.getRegistration()) || navigator.serviceWorker.register("/sw.js");
}

// This browser's subscription, if notifications are on here.
export async function currentSubscription() {
  if (pushSupport() !== "ok") return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}

function keyBytes(base64) {
  const s = (base64 + "=".repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}

function weeklyGoal() {
  try { return Math.min(7, Math.max(1, Number(localStorage.getItem("send.weeklyGoal")) || 3)); } catch { return 3; }
}

const setupError = error =>
  /notify_settings|push_subscription|schema cache|does not exist/i.test(error?.message || "")
    ? "Notifications aren't set up yet. Run supabase/notifications.sql in Supabase."
    : "Couldn't save that. Check your connection and try again.";

export async function loadSettings(userId) {
  const { data, error } = await supabase.from("notify_settings").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw new Error(setupError(error));
  return data ? { ...DEFAULT_SETTINGS, ...data } : null;
}

export async function saveSettings(userId, settings) {
  const row = {
    user_id: userId,
    daily: settings.daily, days: settings.days, hour: settings.hour, streak: settings.streak, comeback: settings.comeback,
    food_meals: settings.food_meals, food_eod: settings.food_eod,
    week_goal: weeklyGoal(), kcal_goal: readGoals().kcal, tz: timeZone(), updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("notify_settings").upsert(row);
  if (error) throw new Error(setupError(error));
}

// Asks for permission, subscribes this browser and saves it. Throws with a message to show.
export async function turnOn(userId, settings) {
  const r = await fetch("/api/push").then(x => x.json()).catch(() => ({}));
  if (!r.publicKey) throw new Error("Notifications aren't set up on the server yet.");
  const answer = await Notification.requestPermission();
  if (answer !== "granted") throw new Error(answer === "denied" ? "blocked" : "Allow notifications to get reminders.");

  const reg = await registration();
  await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub && sub.options?.applicationServerKey) {
    // A subscription made with an older key can't receive anything new.
    const old = btoa(String.fromCharCode(...new Uint8Array(sub.options.applicationServerKey)));
    if (old.replace(/=+$/, "") !== btoa(String.fromCharCode(...keyBytes(r.publicKey))).replace(/=+$/, "")) {
      await sub.unsubscribe();
      sub = null;
    }
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(r.publicKey) });

  const json = sub.toJSON();
  const { error } = await supabase.rpc("save_push_subscription", { p_endpoint: json.endpoint, p_p256dh: json.keys.p256dh, p_auth: json.keys.auth });
  if (error) throw new Error(setupError(error));
  await saveSettings(userId, settings);
}

// Stops notifications on this phone or browser (other devices keep theirs).
export async function turnOff() {
  const sub = await currentSubscription();
  if (!sub) return;
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe().catch(() => {});
}

// Before signing out, so the next person to sign in here doesn't get this person's reminders.
export function forgetDevice() {
  return Promise.race([turnOff().catch(() => {}), new Promise(r => setTimeout(r, 1500))]);
}

export async function sendTest() {
  const { data } = await supabase.auth.getSession();
  const r = await fetch("/api/push", { method: "POST", headers: { Authorization: `Bearer ${data.session?.access_token}` } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || "Couldn't send a test right now.");
}

// Keeps the server's copy of the weekly goal (Lifting Home), calorie goal (Food Home) and time
// zone in step, so streak and calorie alerts match what the app shows and reminders arrive at
// the right local time.
export function syncReminderInfo(userId, goal = weeklyGoal()) {
  supabase.from("notify_settings").update({ week_goal: goal, kcal_goal: readGoals().kcal, tz: timeZone() }).eq("user_id", userId).then(() => {}, () => {});
}
