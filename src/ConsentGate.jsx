import { useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";

// Shown to a signed-in user who hasn't agreed to the current privacy policy:
// people who signed up before the agreement existed, or after the policy
// changed. If they ticked the box on the sign-in screen, it is saved here
// without asking again.
export default function ConsentGate({ user, auto, onAgreed, save }) {
  const [busy, setBusy] = useState(auto);
  const [error, setError] = useState("");
  const tried = useRef(false);

  async function agree() {
    setBusy(true);
    setError("");
    const { user: updated, error } = await save();
    if (error || !updated) {
      setError("Couldn't save that. Check your connection and try again.");
      setBusy(false);
      return;
    }
    onAgreed(updated);
  }

  useEffect(() => {
    if (auto && !tried.current) { tried.current = true; agree(); }
  }, [auto]); // eslint-disable-line react-hooks/exhaustive-deps

  if (auto && busy && !error) return <div style={{ background: "#062a63", minHeight: "100vh" }} />;

  return (
    <div className="root start-root">
      <div className="grain" />
      <div className="consent">
        <img src="/logo.png" width="44" height="44" alt="" />
        <h1>Our Privacy Policy</h1>
        <p>Before you keep using SendIt, please read and agree to our Privacy Policy. It explains what we collect, why, who we share it with, and how to delete your data.</p>
        <a className="consent-read" href="/privacy.html" target="_blank" rel="noopener">Read the Privacy Policy</a>
        {error && <div className="auth-error">{error}</div>}
        <button className="start-google consent-yes" onClick={agree} disabled={busy}>
          {busy ? "Saving..." : "I agree"}
        </button>
        <button className="consent-out" onClick={() => supabase.auth.signOut()} disabled={busy}>
          Don't agree, sign out
        </button>
        <small>Signed in as {user.email}</small>
      </div>
    </div>
  );
}
