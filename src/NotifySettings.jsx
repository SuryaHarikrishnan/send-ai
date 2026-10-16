import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS, currentSubscription, loadSettings, permission, pushSupport, saveSettings, sendTest, turnOff, turnOn } from "./notify";
import { track } from "./tracking";

const WEEK = [[1, "M", "Monday"], [2, "T", "Tuesday"], [3, "W", "Wednesday"], [4, "T", "Thursday"], [5, "F", "Friday"], [6, "S", "Saturday"], [0, "S", "Sunday"]];
const HOURS = Array.from({ length: 18 }, (_, i) => i + 5);
const hourLabel = h => `${h % 12 || 12}:00 ${h < 12 ? "AM" : "PM"}`;

function Switch({ on, onChange, label, disabled }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} className={`switch${on ? " on" : ""}`} disabled={disabled} onClick={() => onChange(!on)}>
      <i />
    </button>
  );
}

export default function NotifySettings({ user, onInstallHelp }) {
  const support = pushSupport();
  const [on, setOn] = useState(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [blocked, setBlocked] = useState(permission() === "denied");

  useEffect(() => {
    if (support !== "ok") return;
    let live = true;
    Promise.all([currentSubscription().catch(() => null), loadSettings(user.id).catch(() => null)]).then(([sub, saved]) => {
      if (!live) return;
      setOn(Boolean(sub) && permission() === "granted");
      if (saved) setSettings(saved);
    });
    return () => { live = false; };
  }, [support, user.id]);

  async function toggle(next) {
    setBusy(true);
    setMsg(null);
    try {
      if (next) {
        await turnOn(user.id, settings);
        track("notifications_on");
        setMsg({ ok: true, text: "You're all set. Reminders will arrive at the time below." });
      } else {
        await turnOff();
        track("notifications_off");
      }
      setOn(next);
      setBlocked(false);
    } catch (e) {
      if (e.message === "blocked") setBlocked(true);
      else setMsg({ text: e.message || "Couldn't turn notifications on." });
    }
    setBusy(false);
  }

  function change(patch) {
    const next = { ...settings, ...patch };
    setSettings(next);
    setMsg(null);
    saveSettings(user.id, next).catch(e => setMsg({ text: e.message }));
  }

  async function test() {
    setBusy(true);
    setMsg(null);
    try {
      await sendTest();
      setMsg({ ok: true, text: "Test sent. It should show up in a few seconds." });
    } catch (e) {
      setMsg({ text: e.message });
    }
    setBusy(false);
  }

  const toggleDay = d => {
    const days = settings.days.includes(d) ? settings.days.filter(x => x !== d) : [...settings.days, d];
    change({ days, daily: days.length > 0 && settings.daily });
  };

  return (
    <div className="you notify">
      <div>
        <h1 className="notify-title">Notifications</h1>
        <p className="notify-lead">A nudge to train, and a heads-up before your weekly streak breaks.</p>
      </div>

      {support === "install" && (
        <div className="notify-card">
          <b>Add SendIt to your Home Screen first</b>
          <p>On iPhone and iPad, notifications only work when SendIt is opened from the Home Screen. Add it, open it from there, then come back here.</p>
          <button className="notify-btn" onClick={onInstallHelp}>Show me how</button>
        </div>
      )}
      {support === "unsupported" && (
        <div className="notify-card">
          <b>This browser can't show notifications</b>
          <p>Try SendIt in Chrome, Edge, Firefox or Safari, or add it to your Home Screen.</p>
        </div>
      )}

      {support === "ok" && (
        <>
          <div className="you-list">
            <div className="notify-row">
              <span>Notifications<small>{on ? "On for this device" : "Off for this device"}</small></span>
              <Switch on={Boolean(on)} disabled={busy || on === null} label="Notifications" onChange={toggle} />
            </div>
          </div>

          {blocked && (
            <div className="notify-card">
              <b>Notifications are blocked</b>
              <p>Allow notifications for SendIt in your phone or browser settings, then turn them on here.</p>
            </div>
          )}

          {on && (
            <>
              <div className="notify-group">
                <h2>Reminders</h2>
                <div className="you-list">
                  <div className="notify-row">
                    <span>Daily reminder<small>On days you haven't logged anything yet</small></span>
                    <Switch on={settings.daily} label="Daily reminder" onChange={v => change({ daily: v, days: v && !settings.days.length ? DEFAULT_SETTINGS.days : settings.days })} />
                  </div>
                  {settings.daily && (
                    <div className="notify-days" role="group" aria-label="Reminder days">
                      {WEEK.map(([d, letter, name]) => (
                        <button key={d} type="button" aria-label={name} aria-pressed={settings.days.includes(d)} className={settings.days.includes(d) ? "on" : ""} onClick={() => toggleDay(d)}>{letter}</button>
                      ))}
                    </div>
                  )}
                  <div className="notify-row">
                    <span>Streak alerts<small>When your weekly streak is about to break</small></span>
                    <Switch on={settings.streak} label="Streak alerts" onChange={v => change({ streak: v })} />
                  </div>
                  <div className="notify-row">
                    <span>Missed workouts<small>After 3, 7, 14 and 30 days without training</small></span>
                    <Switch on={settings.comeback} label="Missed workouts" onChange={v => change({ comeback: v })} />
                  </div>
                </div>
              </div>

              <div className="notify-group">
                <h2>Time</h2>
                <div className="you-list">
                  <label className="notify-row">
                    <span>Send reminders at<small>Your local time</small></span>
                    <select className="notify-time" value={settings.hour} onChange={e => change({ hour: Number(e.target.value) })}>
                      {HOURS.map(h => <option key={h} value={h}>{hourLabel(h)}</option>)}
                    </select>
                  </label>
                </div>
                <p className="notify-note">At most one notification a day.</p>
              </div>

              <button className="you-signout" disabled={busy} onClick={test}>Send a test notification</button>
            </>
          )}

          {msg && <p className={`notify-msg${msg.ok ? " ok" : ""}`} role="status">{msg.text}</p>}
        </>
      )}
    </div>
  );
}
