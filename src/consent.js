// Privacy policy agreement. Bump PRIVACY_VERSION when the policy changes in a
// way people should re-agree to; everyone is then asked again once.
// The agreement is saved on the Supabase user (user_metadata), so it follows
// the account across devices and there's a record of when it was given.
import { supabase } from "./supabase";

export const PRIVACY_VERSION = "2026-10-05";
const PENDING = "send.privacyAgreed";

export function hasAgreed(user) {
  return user?.user_metadata?.privacy_version === PRIVACY_VERSION;
}

// Called when the box is ticked on the sign-in screen, just before the Google
// redirect, so the agreement can be saved once the user exists.
export function rememberAgreement() {
  try { localStorage.setItem(PENDING, PRIVACY_VERSION); } catch { /* storage blocked */ }
}

export function agreedBeforeSignIn() {
  try { return localStorage.getItem(PENDING) === PRIVACY_VERSION; } catch { return false; }
}

export async function saveAgreement() {
  const { data, error } = await supabase.auth.updateUser({
    data: { privacy_version: PRIVACY_VERSION, privacy_agreed_at: new Date().toISOString() },
  });
  if (!error) {
    try { localStorage.removeItem(PENDING); } catch { /* storage blocked */ }
  }
  return { user: data?.user, error };
}
