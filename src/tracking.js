// Product analytics and session replay with PostHog.
// The project key is a public client key (it ships in every page anyway);
// VITE_POSTHOG_KEY in Vercel overrides it. Local builds stay quiet unless
// localStorage "send.analytics" is "on", so developing doesn't add fake visits.
import posthog from "posthog-js";

const KEY = import.meta.env.VITE_POSTHOG_KEY || "phc_mMfaKrnG5d2ffhBYFoja382FEGvV2xypDTwXThKZJHoN";
const HOST = import.meta.env.VITE_POSTHOG_HOST || "https://us.i.posthog.com";

function wanted() {
  if (!KEY) return false;
  try { if (localStorage.getItem("send.analytics") === "on") return true; } catch { /* storage blocked */ }
  return !["localhost", "127.0.0.1"].includes(location.hostname);
}

let on = false;

export function startAnalytics() {
  if (on || !wanted()) return;
  posthog.init(KEY, {
    api_host: HOST,
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
    session_recording: { maskAllInputs: false, maskInputOptions: { password: true, email: true } },
  });
  on = true;
}

export function identify(user) {
  if (!on || !user) return;
  const meta = user.user_metadata || {};
  posthog.identify(user.id, { email: user.email, name: meta.full_name || meta.name });
}

export function track(event, props) {
  if (on) posthog.capture(event, props);
}

export function forget() {
  if (on) posthog.reset();
}
