// "Add to Home Screen" help: a button that opens a sheet with the steps for
// iPhone (Safari) and Android (Chrome). Hidden when SendIt is already running
// from the home screen.
import { useEffect, useState } from "react";
import { track } from "./tracking";
import { isInstalled } from "./install";
import "./Nav.css";

// Chrome on Android fires this once, early, when the app can be installed.
// Keep it so the sheet can offer a one-tap Install button.
let deferredPrompt = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); deferredPrompt = e; });
  window.addEventListener("appinstalled", () => { deferredPrompt = null; });
}

function guessPlatform() {
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "android";
  return "iphone";
}

const Dots = ({ vertical }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    {vertical
      ? <><circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" /></>
      : <><circle cx="5" cy="12" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="19" cy="12" r="2" /></>}
  </svg>
);
const Share = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3v12M7.5 7.5L12 3l4.5 4.5" /><path d="M7 11H5.5A1.5 1.5 0 0 0 4 12.5v7A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5v-7a1.5 1.5 0 0 0-1.5-1.5H17" />
  </svg>
);
const AddBox = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="4" width="16" height="16" rx="4" /><path d="M12 8.5v7M8.5 12h7" />
  </svg>
);
const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>
);
const PhoneIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" /><path d="M11 18.5h2" />
  </svg>
);

const STEPS = {
  iphone: [
    [<Dots key="i" />, <>Tap the <b>three dots</b> in Safari</>],
    [<Share key="i" />, <>Tap <b>Share</b></>],
    [<AddBox key="i" />, <>Tap <b>Add to Home Screen</b>, then <b>Add</b></>],
  ],
  android: [
    [<Dots key="i" vertical />, <>Tap the <b>three dots</b> in Chrome</>],
    [<AddBox key="i" />, <>Tap <b>Add to Home screen</b> (or <b>Install app</b>)</>],
    [<Check key="i" />, <>Tap <b>Install</b> to confirm</>],
  ],
};

export function InstallSheet({ onClose }) {
  const [platform, setPlatform] = useState(guessPlatform);
  const [canPrompt, setCanPrompt] = useState(!!deferredPrompt);

  useEffect(() => {
    track("install_help_opened", { platform });
    const onKey = e => { if (e.key === "Escape") onClose(); };
    const onPrompt = () => setCanPrompt(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => { window.removeEventListener("keydown", onKey); window.removeEventListener("beforeinstallprompt", onPrompt); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function installNow() {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    track("install_prompt", { outcome });
    deferredPrompt = null;
    setCanPrompt(false);
    if (outcome === "accepted") onClose();
  }

  return (
    <div className="sheet-wrap" onClick={onClose}>
      <div className="sheet ih-sheet" role="dialog" aria-modal="true" aria-label="Add SendIt to your home screen" onClick={e => e.stopPropagation()}>
        <span className="sheet-grab" />
        <h2>Add SendIt to your home screen</h2>
        <p className="ih-lead">It opens full screen like any other app. No app store needed.</p>

        <div className="ih-tabs" role="tablist" aria-label="Phone">
          {[["iphone", "iPhone"], ["android", "Android"]].map(([id, name]) => (
            <button key={id} role="tab" aria-selected={platform === id} className={platform === id ? "on" : ""} onClick={() => setPlatform(id)}>{name}</button>
          ))}
        </div>

        <ol className="ih-steps">
          {STEPS[platform].map(([icon, text], i) => (
            <li key={i}>
              <span className="ih-num">{i + 1}</span>
              <span className="ih-txt">{text}</span>
              <span className="ih-ic">{icon}</span>
            </li>
          ))}
        </ol>

        {platform === "android" && canPrompt && (
          <button className="ih-install" onClick={installNow}>Install SendIt now</button>
        )}
        <p className="ih-note">
          {platform === "iphone"
            ? "Use Safari. On older iPhones, the Share button sits right in the bottom bar, so skip step 1."
            : "Use Chrome. Then open SendIt from its new icon on your home screen."}
        </p>
        <button className="ih-done" onClick={onClose} autoFocus>Got it</button>
      </div>
    </div>
  );
}

// Landing page link. Renders nothing when the app is already installed.
export function InstallLink() {
  const [open, setOpen] = useState(false);
  if (isInstalled()) return null;
  return (
    <>
      <button className="start-install" onClick={() => setOpen(true)}>
        <PhoneIcon />
        <span>Add SendIt to your home screen</span>
      </button>
      {open && <InstallSheet onClose={() => setOpen(false)} />}
    </>
  );
}
