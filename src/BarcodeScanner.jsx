import { useEffect, useRef, useState } from "react";

const FORMATS = ["ean_13", "ean_8", "upc_a", "upc_e"];

// Use the browser's own barcode reader where there is one (Chrome on Android).
// Everywhere else (iPhone Safari, desktop) load a ZXing-based reader on demand,
// with its WebAssembly file served from this site.
async function makeDetector() {
  if ("BarcodeDetector" in window) {
    try {
      const supported = await window.BarcodeDetector.getSupportedFormats();
      const formats = FORMATS.filter(f => supported.includes(f));
      if (formats.length) return new window.BarcodeDetector({ formats });
    } catch { /* fall through to the bundled reader */ }
  }
  const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
    import("barcode-detector/ponyfill"),
    import("zxing-wasm/reader/zxing_reader.wasm?url"),
  ]);
  await prepareZXingModule({
    overrides: { locateFile: (path, prefix) => (path.endsWith(".wasm") ? wasmUrl : prefix + path) },
    fireImmediately: true,
  });
  return new BarcodeDetector({ formats: FORMATS });
}

function cameraMessage(err) {
  if (!navigator.mediaDevices?.getUserMedia) return "This browser can't open the camera here. Type the barcode number instead.";
  if (err?.name === "NotAllowedError" || err?.name === "SecurityError")
    return "Camera access is off for SendIt. Allow the camera in your browser or phone settings, or type the barcode number.";
  if (err?.name === "NotFoundError" || err?.name === "OverconstrainedError") return "No camera found. Type the barcode number instead.";
  return "The camera didn't start. Type the barcode number instead.";
}

const Close = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M6 6l12 12M18 6L6 18" /></svg>;

// Full-screen camera view. Calls onCode once a barcode is read or typed.
// The parent looks the code up and passes back `status` while it does.
export default function BarcodeScanner({ status, onCode, onRetry, onManual, onClose }) {
  const video = useRef(null);
  const [camError, setCamError] = useState("");
  const [ready, setReady] = useState(false);
  const [typing, setTyping] = useState(false);
  const [typed, setTyped] = useState("");
  const paused = useRef(false);
  const report = useRef(onCode);
  const close = useRef(onClose);
  useEffect(() => {
    report.current = onCode;
    close.current = onClose;
    paused.current = !!status || typing;
  });

  useEffect(() => {
    let stream = null;
    let timer = 0;
    let stopped = false;

    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("no camera api");
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
        });
        if (stopped) return;
        const v = video.current;
        v.srcObject = stream;
        await v.play().catch(() => {});
        const detector = await makeDetector();
        if (stopped) return;
        setReady(true);
        const tick = async () => {
          if (stopped) return;
          if (!paused.current && v.readyState >= 2) {
            try {
              const found = await detector.detect(v);
              const code = found.find(b => /^\d{8,14}$/.test(b.rawValue))?.rawValue;
              if (code && !paused.current && !stopped) {
                paused.current = true;
                try { navigator.vibrate?.(60); } catch { /* no vibration */ }
                report.current(code);
              }
            } catch { /* frame not ready */ }
          }
          timer = setTimeout(tick, 160);
        };
        tick();
      } catch (e) {
        if (!stopped) setCamError(cameraMessage(e));
      }
    })();

    const onKey = e => e.key === "Escape" && close.current();
    window.addEventListener("keydown", onKey);
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach(t => t.stop());
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  function submitTyped(e) {
    e.preventDefault();
    const code = typed.replace(/\D/g, "");
    if (code.length < 8) return;
    setTyping(false);
    onCode(code);
  }

  const showTyping = typing || (camError && !status);

  return (
    <div className="bs" role="dialog" aria-modal="true" aria-label="Scan a barcode">
      <video ref={video} className="bs-video" playsInline muted autoPlay />
      <div className={`bs-frame${ready && !status && !camError ? " live" : ""}`}><i /><i /><i /><i /><b /></div>

      <div className="bs-top">
        <button className="bs-close" onClick={onClose} aria-label="Close scanner"><Close /></button>
        <span>Scan barcode</span>
        <span className="bs-spacer" />
      </div>

      <div className="bs-panel">
        {status?.kind === "looking" && (
          <div className="bs-msg"><span className="fd-spin" />Looking up {status.code}…</div>
        )}
        {status?.kind === "notfound" && (
          <>
            <div className="bs-msg"><b>{status.title}</b><span>{status.detail}</span></div>
            <div className="bs-actions">
              <button onClick={onRetry}>Scan again</button>
              <button className="bs-main" onClick={() => onManual(status.code, status.food)}>Enter it yourself</button>
            </div>
          </>
        )}
        {status?.kind === "error" && (
          <>
            <div className="bs-msg"><b>Couldn't look that up.</b><span>{status.detail}</span></div>
            <div className="bs-actions">
              <button onClick={onRetry}>Scan again</button>
              <button className="bs-main" onClick={() => onCode(status.code)}>Try again</button>
            </div>
          </>
        )}
        {!status && showTyping && (
          <form className="bs-type" onSubmit={submitTyped}>
            {camError && <p>{camError}</p>}
            <div className="bs-type-row">
              <input
                value={typed} onChange={e => setTyped(e.target.value)} inputMode="numeric" autoComplete="off"
                placeholder="Barcode number" aria-label="Barcode number" autoFocus
              />
              <button type="submit" className="bs-main" disabled={typed.replace(/\D/g, "").length < 8}>Look up</button>
            </div>
            {!camError && <button type="button" className="bs-link" onClick={() => setTyping(false)}>Use the camera</button>}
          </form>
        )}
        {!status && !showTyping && (
          <>
            <div className="bs-msg"><span>{ready ? "Line up the barcode inside the frame" : "Starting camera…"}</span></div>
            <button className="bs-link" onClick={() => setTyping(true)}>Type the number instead</button>
          </>
        )}
      </div>
    </div>
  );
}
