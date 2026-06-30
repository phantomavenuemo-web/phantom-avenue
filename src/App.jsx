import { useState, useEffect, useRef, useCallback } from "react";

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const ADMIN_PASSWORD  = "phantom2024";
const STORE_KEY       = "pa_store_state";
const VIEWERS_KEY     = "pa_viewers";
const SESSION_KEY     = "pa_session_id";
const SMS_KEY         = "pa_sms_list";
const WAITLIST_KEY    = "pa_waitlist";
const MEMBERS_KEY     = "pa_members";
const AUTH_KEY        = "pa_auth";

// ─── SCHEDULE ─────────────────────────────────────────────────────────────────
function getEstNow() {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utcMs - 5 * 3600000);
}
function nextWeekday(est, targetDay, targetHour) {
  const day = est.getDay();
  let daysUntil = (targetDay - day + 7) % 7;
  if (daysUntil === 0 && est.getHours() >= targetHour) daysUntil = 7;
  const next = new Date(est);
  next.setDate(next.getDate() + daysUntil);
  next.setHours(targetHour, 0, 0, 0);
  return next;
}
function getSchedule() {
  const est  = getEstNow();
  const day  = est.getDay();
  const hour = est.getHours();
  const min  = est.getMinutes();
  const pastTime = h => hour > h || (hour === h && min >= 0);
  const isStoreLive     = day === 6 && pastTime(8);
  const isImageRevealed = isStoreLive || day === 5 || (day === 4 && pastTime(20));
  const isNameRevealed  = isImageRevealed || (day === 3 && pastTime(20));
  const isStockRevealed = isNameRevealed  || (day === 2 && pastTime(20));
  let stage = 0;
  if (isStoreLive) stage = 4;
  else if (isImageRevealed) stage = 3;
  else if (isNameRevealed)  stage = 2;
  else if (isStockRevealed) stage = 1;
  const msUntilStock = isStockRevealed ? 0 : nextWeekday(est, 2, 20).getTime() - est.getTime();
  const msUntilName  = isNameRevealed  ? 0 : nextWeekday(est, 3, 20).getTime() - est.getTime();
  const msUntilImage = isImageRevealed ? 0 : nextWeekday(est, 4, 20).getTime() - est.getTime();
  const msUntilDrop  = isStoreLive     ? 0 : nextWeekday(est, 6, 8).getTime()  - est.getTime();
  const nextMs    = stage === 0 ? msUntilStock : stage === 1 ? msUntilName : stage === 2 ? msUntilImage : stage === 3 ? msUntilDrop : 0;
  const nextLabel = stage === 0 ? "STOCK REVEALS TUE 8PM" : stage === 1 ? "COLLECTION NAME REVEALS WED 8PM" : stage === 2 ? "PRODUCTS REVEAL THU 8PM" : stage === 3 ? "DROP GOES LIVE SAT 8AM" : "LIVE NOW";
  return { stage, isStoreLive, isImageRevealed, isNameRevealed, isStockRevealed, msUntilStock, msUntilName, msUntilImage, msUntilDrop, nextMs, nextLabel };
}
function formatCountdown(ms) {
  if (ms <= 0) return { d: "00", h: "00", m: "00", s: "00" };
  const t = Math.floor(ms / 1000);
  return {
    d: String(Math.floor(t / 86400)).padStart(2, "0"),
    h: String(Math.floor((t % 86400) / 3600)).padStart(2, "0"),
    m: String(Math.floor((t % 3600) / 60)).padStart(2, "0"),
    s: String(t % 60).padStart(2, "0"),
  };
}

// ─── DEFAULT DATA ─────────────────────────────────────────────────────────────
const DEFAULT_PRODUCTS = [
  { id: 1, name: "PHANTOM OVERSIZED TEE", subtitle: "Drop 001 — Carbon Black", price: 89, stock: 30, maxStock: 30, description: "400gsm heavyweight cotton. Garment dyed. Dropped shoulder. One size fits all.", tags: ["HEAVYWEIGHT", "LIMITED", "UNISEX"], image: null },
  { id: 2, name: "AVENUE CARGO PANT",     subtitle: "Drop 001 — Washed Slate",  price: 149, stock: 15, maxStock: 15, description: "Ripstop nylon shell. Six functional pockets. Adjustable ankle cinch. Pre-washed.", tags: ["TECHNICAL", "LIMITED", "UNISEX"], image: null },
];
const DEFAULT_COLLECTION = { name: "DEAD OF NIGHT" };

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const getSessionId   = () => { let id = sessionStorage.getItem(SESSION_KEY); if (!id) { id = Math.random().toString(36).slice(2); sessionStorage.setItem(SESSION_KEY, id); } return id; };
const loadStore      = () => { try { const r = localStorage.getItem(STORE_KEY);    return r ? JSON.parse(r) : { products: DEFAULT_PRODUCTS, collection: DEFAULT_COLLECTION }; } catch { return { products: DEFAULT_PRODUCTS, collection: DEFAULT_COLLECTION }; } };
const saveStore      = s  => { try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch {} };
const loadViewers    = () => { try { const r = localStorage.getItem(VIEWERS_KEY);  return r ? JSON.parse(r) : {}; } catch { return {}; } };
const saveViewers    = v  => { try { localStorage.setItem(VIEWERS_KEY, JSON.stringify(v)); } catch {} };
const loadSMS        = () => { try { const r = localStorage.getItem(SMS_KEY);      return r ? JSON.parse(r) : []; } catch { return []; } };
const saveSMS        = l  => { try { localStorage.setItem(SMS_KEY, JSON.stringify(l)); } catch {} };
const loadWaitlist   = () => { try { const r = localStorage.getItem(WAITLIST_KEY); return r ? JSON.parse(r) : []; } catch { return []; } };
const saveWaitlist   = l  => { try { localStorage.setItem(WAITLIST_KEY, JSON.stringify(l)); } catch {} };
const loadMembers    = () => { try { const r = localStorage.getItem(MEMBERS_KEY);  return r ? JSON.parse(r) : []; } catch { return []; } };
const saveMembers    = l  => { try { localStorage.setItem(MEMBERS_KEY, JSON.stringify(l)); } catch {} };
const loadAuth       = () => { try { const r = sessionStorage.getItem(AUTH_KEY);   return r ? JSON.parse(r) : null; } catch { return null; } };
const saveAuth       = a  => { try { sessionStorage.setItem(AUTH_KEY, JSON.stringify(a)); } catch {} };
const getLiveViewers = () => { const v = loadViewers(); const now = Date.now(); return { count: Object.entries(v).filter(([, ts]) => now - ts < 90000).length }; };

// ─── ICONS ────────────────────────────────────────────────────────────────────
const IconCart  = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>;
const IconLock  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>;
const IconClose = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;
const IconCheck = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>;
const IconPhone = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.8a19.79 19.79 0 01-3.07-8.7A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 14.92z"/></svg>;
const IconImage = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
const IconUsers = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>;
const IconCopy  = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>;

// ─── STOCK BAR ────────────────────────────────────────────────────────────────
function StockBar({ stock, maxStock }) {
  const pct   = maxStock > 0 ? (stock / maxStock) * 100 : 0;
  const color = pct > 50 ? "#39FF14" : pct > 20 ? "#FFD600" : "#FF3B30";
  return <div style={{ height: 2, background: "#1A1A1A", marginTop: 8 }}><div style={{ height: "100%", width: `${pct}%`, background: color, transition: "width 0.6s ease, background 0.4s ease" }} /></div>;
}

// ─── WAITLIST POPUP ───────────────────────────────────────────────────────────
function WaitlistPopup({ onJoin, onLogin, waitlistCount }) {
  const [mode,       setMode]       = useState("join");   // "join" | "login"
  const [name,       setName]       = useState("");
  const [phone,      setPhone]      = useState("");
  const [error,      setError]      = useState("");
  const [submitted,  setSubmitted]  = useState(false);

  const cleanPhone = p => p.replace(/\D/g, "");

  const handleJoin = () => {
    if (!name.trim()) { setError("ENTER YOUR NAME"); return; }
    const cp = cleanPhone(phone);
    if (cp.length < 10) { setError("ENTER A VALID 10-DIGIT NUMBER"); return; }
    const wl = loadWaitlist();
    const members = loadMembers();
    if (members.find(m => m.phone === cp)) { setError("YOU'RE ALREADY A MEMBER — USE LOGIN"); return; }
    if (wl.find(w => w.phone === cp)) { setError("YOU'RE ALREADY ON THE WAITLIST"); return; }
    wl.push({ name: name.trim(), phone: cp, date: new Date().toLocaleDateString(), status: "pending" });
    saveWaitlist(wl);
    setSubmitted(true);
    setError("");
  };

  const handleLogin = () => {
    if (!name.trim()) { setError("ENTER YOUR NAME"); return; }
    const cp = cleanPhone(phone);
    if (cp.length < 10) { setError("ENTER A VALID 10-DIGIT NUMBER"); return; }
    const members = loadMembers();
    const match = members.find(m => m.phone === cp && m.name.toLowerCase() === name.trim().toLowerCase());
    if (match) { saveAuth(match); onLogin(match); }
    else { setError("NOT FOUND — CHECK YOUR NAME & NUMBER"); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(0,0,0,0.96)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 420, background: "#0A0A0A", border: "1px solid #1C1C1C", padding: "36px 32px" }}>

        {/* Logo */}
        <div style={{ fontFamily: "'Arial Black', sans-serif", fontSize: "clamp(13px, 2.2vw, 17px)", fontWeight: 900, letterSpacing: "0.3em", color: "#FAFAFA", textAlign: "center", marginBottom: 28 }}>
          PHANTOM AVENUE
        </div>

        {/* Waitlist count */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "#111", border: "1px solid #1C1C1C", padding: "8px 16px" }}>
            <IconUsers />
            <span style={{ fontFamily: "'Arial Black', sans-serif", fontSize: 18, fontWeight: 900, color: "#FAFAFA" }}>{waitlistCount}</span>
            <span style={{ fontFamily: "monospace", fontSize: 8, color: "#444", letterSpacing: "0.15em" }}>ON WAITLIST</span>
          </div>
        </div>

        {/* Mode tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #1C1C1C", marginBottom: 24 }}>
          {["join", "login"].map(m => (
            <button key={m} onClick={() => { setMode(m); setError(""); setName(""); setPhone(""); setSubmitted(false); }} style={{
              flex: 1, background: "none", border: "none", cursor: "pointer",
              fontFamily: "monospace", fontSize: 9, letterSpacing: "0.15em",
              color: mode === m ? "#FAFAFA" : "#333",
              padding: "10px 0",
              borderBottom: mode === m ? "1px solid #FAFAFA" : "1px solid transparent",
              marginBottom: -1, textTransform: "uppercase",
            }}>
              {m === "join" ? "JOIN WAITLIST" : "MEMBER LOGIN"}
            </button>
          ))}
        </div>

        {submitted && mode === "join" ? (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ color: "#39FF14", display: "flex", justifyContent: "center", marginBottom: 12 }}><IconCheck /></div>
            <div style={{ fontFamily: "'Arial Black', sans-serif", fontSize: 14, color: "#FAFAFA", fontWeight: 900, letterSpacing: "0.05em", marginBottom: 6 }}>
              YOU'RE ON THE LIST.
            </div>
            <div style={{ fontFamily: "monospace", fontSize: 9, color: "#444", letterSpacing: "0.12em", lineHeight: 1.6 }}>
              WE'LL REVIEW YOUR REQUEST AND TEXT<br />YOU WHEN YOU'RE ACCEPTED.
            </div>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontFamily: "monospace", fontSize: 8, color: "#444", letterSpacing: "0.15em", marginBottom: 6 }}>
                {mode === "join" ? "FULL NAME" : "NAME"}
              </div>
              <input
                type="text"
                placeholder={mode === "join" ? "YOUR NAME" : "NAME YOU SIGNED UP WITH"}
                value={name}
                onChange={e => { setName(e.target.value); setError(""); }}
                style={{ width: "100%", background: "#111", border: "1px solid #1C1C1C", color: "#FAFAFA", padding: "12px 14px", fontFamily: "monospace", fontSize: 12, outline: "none", boxSizing: "border-box", letterSpacing: "0.05em" }}
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontFamily: "monospace", fontSize: 8, color: "#444", letterSpacing: "0.15em", marginBottom: 6 }}>PHONE NUMBER</div>
              <input
                type="tel"
                placeholder="10-DIGIT NUMBER"
                value={phone}
                onChange={e => { setPhone(e.target.value); setError(""); }}
                onKeyDown={e => e.key === "Enter" && (mode === "join" ? handleJoin() : handleLogin())}
                style={{ width: "100%", background: "#111", border: `1px solid ${error ? "#FF3B30" : "#1C1C1C"}`, color: "#FAFAFA", padding: "12px 14px", fontFamily: "monospace", fontSize: 12, outline: "none", boxSizing: "border-box", letterSpacing: "0.08em" }}
              />
            </div>
            {error && <div style={{ fontFamily: "monospace", fontSize: 8, color: "#FF3B30", letterSpacing: "0.1em", marginBottom: 14 }}>{error}</div>}
            <button
              onClick={mode === "join" ? handleJoin : handleLogin}
              style={{ width: "100%", background: "#FAFAFA", color: "#000", border: "none", padding: 14, fontFamily: "'Arial Black', sans-serif", fontSize: 10, fontWeight: 900, letterSpacing: "0.2em", cursor: "pointer", transition: "background 0.15s ease" }}
              onMouseEnter={e => { e.currentTarget.style.background = "#39FF14"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#FAFAFA"; }}
            >
              {mode === "join" ? "REQUEST ACCESS" : "ENTER SITE"}
            </button>
            {mode === "join" && (
              <div style={{ fontFamily: "monospace", fontSize: 7, color: "#222", letterSpacing: "0.1em", marginTop: 10, textAlign: "center" }}>
                MEMBERS ONLY — MANUAL REVIEW REQUIRED
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── PRODUCT IMAGE ────────────────────────────────────────────────────────────
function ProductImage({ product, isImageRevealed }) {
  const soldOut = product.stock === 0;
  return (
    <div style={{ aspectRatio: "3/4", position: "relative", overflow: "hidden", flexShrink: 0, background: "#000" }}>
      {product.image ? (
        <img src={product.image} alt={product.name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", filter: isImageRevealed ? "none" : "brightness(0)", transition: "filter 1.4s ease" }} />
      ) : (
        <div style={{ width: "100%", height: "100%", background: isImageRevealed ? "#111" : "#000", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 1.4s ease" }}>
          {isImageRevealed && <div style={{ fontFamily: "'Arial Black', sans-serif", fontSize: "clamp(18px, 2.8vw, 38px)", fontWeight: 900, color: "#1A1A1A", letterSpacing: "-1px", textAlign: "center", lineHeight: 1.05, padding: "0 16px" }}>{product.name.split(" ").map((w, i) => <div key={i}>{w}</div>)}</div>}
        </div>
      )}
      <div style={{ position: "absolute", top: 12, left: 12, background: "rgba(0,0,0,0.8)", border: "1px solid #1C1C1C", padding: "3px 8px", fontFamily: "monospace", fontSize: 9, letterSpacing: "0.15em", color: "#444", zIndex: 2 }}>DROP 001</div>
      {soldOut && (
        <div style={{ position: "absolute", inset: 0, zIndex: 4, background: "rgba(0,0,0,0.8)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ fontFamily: "'Arial Black', sans-serif", fontSize: "clamp(12px, 1.8vw, 18px)", letterSpacing: "0.3em", color: "#fff", fontWeight: 900, border: "2px solid #fff", padding: "8px 20px" }}>SOLD OUT</div>
        </div>
      )}
    </div>
  );
}

// ─── PRODUCT CARD ─────────────────────────────────────────────────────────────
function ProductCard({ product, onBuy, isImageRevealed, isStoreLive }) {
  const [flash, setFlash] = useState(false);
  const pct       = product.maxStock > 0 ? (product.stock / product.maxStock) * 100 : 0;
  const critical  = pct <= 20 && product.stock > 0;
  const soldOut   = product.stock === 0;
  const stockColor = pct > 50 ? "#39FF14" : pct > 20 ? "#FFD600" : "#FF3B30";
  const handleBuy = () => { if (soldOut || !isStoreLive) return; setFlash(true); setTimeout(() => setFlash(false), 500); onBuy(product.id); };
  return (
    <div style={{ background: "#0A0A0A", border: `1px solid ${flash ? "#39FF14" : "#1C1C1C"}`, transition: "border-color 0.3s ease", display: "flex", flexDirection: "column", height: "100%" }}>
      <ProductImage product={product} isImageRevealed={isImageRevealed} />
      <div style={{ padding: "18px 18px 22px", display: "flex", flexDirection: "column", flex: 1 }}>
        <div style={{ display: "flex", gap: 5, marginBottom: 10, flexWrap: "wrap" }}>
          {product.tags.map(t => <span key={t} style={{ fontSize: 8, letterSpacing: "0.18em", color: "#3A3A3A", fontFamily: "monospace", border: "1px solid #1C1C1C", padding: "2px 6px" }}>{t}</span>)}
        </div>
        <div style={{ fontFamily: "'Arial Black', sans-serif", fontSize: "clamp(13px, 1.8vw, 18px)", fontWeight: 900, color: "#FAFAFA", letterSpacing: "-0.02em", lineHeight: 1.05, marginBottom: 3 }}>{product.name}</div>
        <div style={{ fontFamily: "monospace", fontSize: 9, color: "#333", letterSpacing: "0.1em", marginBottom: 10 }}>{product.subtitle}</div>
        <div style={{ fontFamily: "'Helvetica Neue', sans-serif", fontSize: 11, color: "#4A4A4A", lineHeight: 1.6, marginBottom: 14, flex: 1 }}>{product.description}</div>
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontFamily: "monospace", fontSize: 8, color: "#2A2A2A", letterSpacing: "0.15em" }}>STOCK</span>
            <span style={{ fontFamily: "'Arial Black', sans-serif", fontSize: 10, fontWeight: 900, color: stockColor, animation: critical ? "pulse 1.4s ease-in-out infinite" : "none" }}>{soldOut ? "NONE" : `${product.stock} LEFT`}</span>
          </div>
          <StockBar stock={product.stock} maxStock={product.maxStock} />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ fontFamily: "'Arial Black', sans-serif", fontSize: "clamp(16px, 2vw, 24px)", fontWeight: 900, color: "#FAFAFA", letterSpacing: "-0.02em", flexShrink: 0 }}>${product.price}</div>
          {isStoreLive ? (
            <button onClick={handleBuy} disabled={soldOut} style={{ flex: 1, padding: "12px 0", background: soldOut ? "transparent" : "#FAFAFA", color: soldOut ? "#2A2A2A" : "#000", border: soldOut ? "1px solid #1C1C1C" : "none", fontFamily: "'Arial Black', sans-serif", fontSize: 9, fontWeight: 900, letterSpacing: "0.2em", cursor: soldOut ? "not-allowed" : "pointer", transition: "background 0.15s ease" }}
              onMouseEnter={e => { if (!soldOut) e.currentTarget.style.background = "#39FF14"; }}
              onMouseLeave={e => { if (!soldOut) e.currentTarget.style.background = "#FAFAFA"; }}
            >{soldOut ? "SOLD OUT" : "ADD TO CART"}</button>
          ) : (
            <div style={{ flex: 1, padding: "12px 0", border: "1px solid #1C1C1C", fontFamily: "monospace", fontSize: 8, color: "#333", letterSpacing: "0.18em", textAlign: "center" }}>SAT · 8AM EST</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── PRE-DROP GATE ────────────────────────────────────────────────────────────
function PreDropGate({ products, collection, schedule, waitlistCount }) {
  const { stage, nextMs, nextLabel, isStockRevealed, isNameRevealed, isImageRevealed } = schedule;
  const [phone, setPhone]       = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [nextCd, setNextCd]     = useState(formatCountdown(nextMs));
  useEffect(() => { const iv = setInterval(() => setNextCd(formatCountdown(getSchedule().nextMs)), 1000); return () => clearInterval(iv); }, []);
  const submitPhone = () => {
    const c = phone.replace(/\D/g, "");
    if (c.length < 10) { setPhoneError("ENTER A VALID 10-DIGIT NUMBER"); return; }
    const list = loadSMS();
    if (list.find(e => e.phone === c)) { setPhoneError("ALREADY ON THE LIST"); return; }
    list.push({ phone: c, date: new Date().toLocaleDateString() });
    saveSMS(list);
    setSubmitted(true); setPhoneError("");
  };
  const cdUnits = [{ l: "D", v: nextCd.d }, { l: "H", v: nextCd.h }, { l: "M", v: nextCd.m }, { l: "S", v: nextCd.s }];
  const stageItems = [
    { label: "STOCK COUNT",     day: "TUE 8PM", done: isStockRevealed },
    { label: "COLLECTION NAME", day: "WED 8PM", done: isNameRevealed  },
    { label: "PRODUCT REVEAL",  day: "THU 8PM", done: isImageRevealed },
    { label: "DROP LIVE",       day: "SAT 8AM", done: false            },
  ];
  return (
    <div style={{ minHeight: "100vh", background: "#000", display: "flex", flexDirection: "column" }}>
      <div style={{ borderBottom: "1px solid #111", display: "flex", justifyContent: "space-between", alignItems: "center", height: 54, flexShrink: 0, padding: "0 clamp(16px, 4vw, 32px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <IconUsers />
          <span style={{ fontFamily: "'Arial Black', sans-serif", fontSize: 13, fontWeight: 900, color: "#FAFAFA" }}>{waitlistCount}</span>
          <span style={{ fontFamily: "monospace", fontSize: 8, color: "#333", letterSpacing: "0.12em" }}>ON WAITLIST</span>
        </div>
        <div style={{ fontFamily: "'Arial Black', sans-serif", fontSize: "clamp(11px, 2vw, 15px)", fontWeight: 900, letterSpacing: "0.28em", color: "#FAFAFA" }}>PHANTOM AVENUE</div>
        <div style={{ width: 80 }} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 2, flexShrink: 0, maxHeight: "42vh", overflow: "hidden" }}>
        {products.map(p => (
          <div key={p.id} style={{ position: "relative", overflow: "hidden" }}>
            {p.image ? <img src={p.image} alt="" style={{ width: "100%", aspectRatio: "1/1", objectFit: "cover", display: "block", filter: isImageRevealed ? "none" : "brightness(0)", transition: "filter 1.4s ease" }} />
              : <div style={{ width: "100%", aspectRatio: "1/1", background: isImageRevealed ? "#111" : "#000", transition: "background 1.4s ease", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {isImageRevealed && <div style={{ fontFamily: "'Arial Black', sans-serif", fontSize: "clamp(14px, 2.5vw, 28px)", fontWeight: 900, color: "#1A1A1A", textAlign: "center", padding: "0 12px", lineHeight: 1.1 }}>{p.name.split(" ").map((w, i) => <div key={i}>{w}</div>)}</div>}
                </div>
            }
            {isStockRevealed && !isImageRevealed && (
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4 }}>
                <div style={{ fontFamily: "monospace", fontSize: "clamp(7px, 1vw, 10px)", color: "#333", letterSpacing: "0.2em" }}>UNITS AVAILABLE</div>
                <div style={{ fontFamily: "'Arial Black', sans-serif", fontSize: "clamp(32px, 6vw, 72px)", fontWeight: 900, color: "#FAFAFA", letterSpacing: "-0.04em", lineHeight: 1 }}>{p.maxStock}</div>
                <div style={{ fontFamily: "monospace", fontSize: "clamp(7px, 0.9vw, 9px)", color: "#444", letterSpacing: "0.15em" }}>PIECES ONLY</div>
              </div>
            )}
            {isImageRevealed && (
              <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)", padding: "24px 12px 10px" }}>
                <div style={{ fontFamily: "'Arial Black', sans-serif", fontSize: "clamp(10px, 1.4vw, 14px)", fontWeight: 900, color: "#FAFAFA" }}>{p.name}</div>
                <div style={{ fontFamily: "monospace", fontSize: "clamp(7px, 0.8vw, 9px)", color: "#555" }}>${p.price} · {p.maxStock} UNITS</div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "clamp(24px, 4vw, 48px) clamp(16px, 4vw, 48px)", borderTop: "1px solid #111" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 28, flexWrap: "wrap", justifyContent: "center" }}>
          {stageItems.map((s, i) => (
            <div key={i} style={{ padding: "5px 12px", background: s.done ? "#0D0D0D" : "transparent", border: `1px solid ${s.done ? "#39FF14" : i === stage ? "#555" : "#1A1A1A"}`, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
              <div style={{ fontFamily: "monospace", fontSize: 7, letterSpacing: "0.15em", color: s.done ? "#39FF14" : i === stage ? "#888" : "#2A2A2A" }}>{s.done ? "✓ " : ""}{s.label}</div>
              <div style={{ fontFamily: "monospace", fontSize: 6, letterSpacing: "0.1em", color: s.done ? "#2A2A2A" : "#1A1A1A" }}>{s.day}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 20, textAlign: "center" }}>
          {isNameRevealed ? (
            <div style={{ animation: "fadeIn 0.8s ease" }}>
              <div style={{ fontFamily: "monospace", fontSize: 9, color: "#333", letterSpacing: "0.25em", marginBottom: 8 }}>COLLECTION</div>
              <div style={{ fontFamily: "'Arial Black', sans-serif", fontSize: "clamp(22px, 4vw, 48px)", fontWeight: 900, color: "#FAFAFA", letterSpacing: "-0.02em", lineHeight: 1 }}>{collection.name}</div>
            </div>
          ) : (
            <div>
              <div style={{ fontFamily: "monospace", fontSize: 9, color: "#1C1C1C", letterSpacing: "0.25em", marginBottom: 8 }}>COLLECTION</div>
              <div style={{ fontFamily: "'Arial Black', sans-serif", fontSize: "clamp(22px, 4vw, 48px)", fontWeight: 900, color: "#111", letterSpacing: "-0.02em" }}>{"? ? ? ? ? ?"}</div>
            </div>
          )}
        </div>

        {stage < 4 && (
          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <div style={{ fontFamily: "monospace", fontSize: 8, color: "#2A2A2A", letterSpacing: "0.2em", marginBottom: 16 }}>{nextLabel}</div>
            <div style={{ display: "flex", gap: "clamp(10px, 2.5vw, 32px)" }}>
              {cdUnits.map(({ l, v }, i) => (
                <div key={l} style={{ display: "flex", alignItems: "flex-start" }}>
                  {i > 0 && <div style={{ fontFamily: "'Arial Black', sans-serif", fontSize: "clamp(28px, 5.5vw, 64px)", fontWeight: 900, color: "#FAFAFA", opacity: 0.1, marginRight: "clamp(6px, 1.5vw, 20px)", lineHeight: 1 }}>:</div>}
                  <div style={{ textAlign: "center" }}>
                    <div style={{ fontFamily: "'Arial Black', sans-serif", fontSize: "clamp(32px, 6vw, 72px)", fontWeight: 900, color: "#FAFAFA", letterSpacing: "-0.04em", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>{v}</div>
                    <div style={{ fontFamily: "monospace", fontSize: "clamp(7px, 0.8vw, 9px)", color: "#2A2A2A", letterSpacing: "0.2em", marginTop: 5 }}>{l}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ width: "100%", maxWidth: 400 }}>
          <div style={{ width: "100%", height: 1, background: "#111", marginBottom: 24 }} />
          <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: "monospace", fontSize: 8, color: "#333", letterSpacing: "0.2em", marginBottom: 14, justifyContent: "center" }}><IconPhone /> GET TEXTED BEFORE THE DROP</div>
          {submitted ? (
            <div style={{ border: "1px solid #1C1C1C", padding: "16px 20px", textAlign: "center" }}>
              <div style={{ color: "#39FF14", marginBottom: 6, display: "flex", justifyContent: "center" }}><IconCheck /></div>
              <div style={{ fontFamily: "'Arial Black', sans-serif", fontSize: 11, color: "#FAFAFA", fontWeight: 900, letterSpacing: "0.1em", marginBottom: 3 }}>YOU'RE ON THE LIST.</div>
              <div style={{ fontFamily: "monospace", fontSize: 8, color: "#333", letterSpacing: "0.12em" }}>WE'LL TEXT YOU BEFORE EVERY DROP.</div>
            </div>
          ) : (
            <>
              <div style={{ display: "flex" }}>
                <input type="tel" placeholder="YOUR PHONE NUMBER" value={phone} onChange={e => { setPhone(e.target.value); setPhoneError(""); }} onKeyDown={e => e.key === "Enter" && submitPhone()}
                  style={{ flex: 1, background: "#0A0A0A", border: `1px solid ${phoneError ? "#FF3B30" : "#1C1C1C"}`, borderRight: "none", color: "#FAFAFA", padding: "13px 14px", fontFamily: "monospace", fontSize: 11, outline: "none", letterSpacing: "0.08em" }} />
                <button onClick={submitPhone} style={{ background: "#FAFAFA", color: "#000", border: "none", padding: "13px 18px", fontFamily: "'Arial Black', sans-serif", fontSize: 9, fontWeight: 900, letterSpacing: "0.15em", cursor: "pointer", whiteSpace: "nowrap" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "#39FF14"; }} onMouseLeave={e => { e.currentTarget.style.background = "#FAFAFA"; }}>NOTIFY ME</button>
              </div>
              {phoneError && <div style={{ fontFamily: "monospace", fontSize: 8, color: "#FF3B30", letterSpacing: "0.1em", marginTop: 7 }}>{phoneError}</div>}
              <div style={{ fontFamily: "monospace", fontSize: 7, color: "#1C1C1C", letterSpacing: "0.1em", marginTop: 8, textAlign: "center" }}>NO SPAM. DROP ALERTS ONLY.</div>
            </>
          )}
        </div>
        <div style={{ marginTop: 24, fontFamily: "monospace", fontSize: 7, color: "#1A1A1A", letterSpacing: "0.15em", textAlign: "center" }}>EVERY SATURDAY · 8:00 AM EST · LIMITED STOCK · NO RESTOCK</div>
      </div>
    </div>
  );
}

// ─── CART DRAWER ──────────────────────────────────────────────────────────────
function CartDrawer({ cart, products, open, onClose, onCheckout }) {
  const total = cart.reduce((s, i) => { const p = products.find(p => p.id === i.id); return s + (p?.price || 0) * i.qty; }, 0);
  if (!open) return null;
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1000 }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)" }} />
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "min(400px, 100vw)", background: "#0A0A0A", borderLeft: "1px solid #1C1C1C", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #1C1C1C", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: "'Arial Black', sans-serif", fontSize: 12, fontWeight: 900, letterSpacing: "0.2em", color: "#FAFAFA" }}>YOUR CART</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#555", padding: 4 }}><IconClose /></button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
          {cart.length === 0 ? <div style={{ color: "#2A2A2A", fontFamily: "monospace", fontSize: 10, letterSpacing: "0.12em" }}>CART IS EMPTY</div>
            : cart.map(item => { const p = products.find(p => p.id === item.id); if (!p) return null; return (
              <div key={item.id} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #111", paddingBottom: 16, marginBottom: 16 }}>
                <div><div style={{ fontFamily: "'Arial Black', sans-serif", fontSize: 11, color: "#FAFAFA", fontWeight: 900, marginBottom: 3 }}>{p.name}</div><div style={{ fontFamily: "monospace", fontSize: 8, color: "#333", letterSpacing: "0.12em" }}>QTY {item.qty}</div></div>
                <div style={{ fontFamily: "'Arial Black', sans-serif", fontSize: 14, color: "#FAFAFA", fontWeight: 900 }}>${p.price * item.qty}</div>
              </div>
            ); })
          }
        </div>
        {cart.length > 0 && (
          <div style={{ padding: "20px 24px", borderTop: "1px solid #1C1C1C" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
              <span style={{ fontFamily: "monospace", fontSize: 9, color: "#444", letterSpacing: "0.15em" }}>TOTAL</span>
              <span style={{ fontFamily: "'Arial Black', sans-serif", fontSize: 20, color: "#FAFAFA", fontWeight: 900 }}>${total}</span>
            </div>
            <button onClick={onCheckout} style={{ width: "100%", background: "#39FF14", color: "#000", border: "none", padding: 14, fontFamily: "'Arial Black', sans-serif", fontSize: 10, fontWeight: 900, letterSpacing: "0.2em", cursor: "pointer" }}>CHECKOUT →</button>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5, marginTop: 10, color: "#2A2A2A", fontFamily: "monospace", fontSize: 8, letterSpacing: "0.1em" }}><IconLock /> SECURE CHECKOUT</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────
function AdminPanel({ products, collection, onUpdate, onClose }) {
  const [local,    setLocal]    = useState(products.map(p => ({ ...p })));
  const [collName, setCollName] = useState(collection.name);
  const [smsList]               = useState(loadSMS());
  const [waitlist, setWaitlist] = useState(loadWaitlist());
  const [members,  setMembers]  = useState(loadMembers());
  const [tab,      setTab]      = useState("waitlist");
  const [copied,   setCopied]   = useState(null);

  const inputStyle = { width: "100%", background: "#111", border: "1px solid #222", color: "#FAFAFA", padding: "9px 11px", fontFamily: "monospace", fontSize: 12, outline: "none", boxSizing: "border-box" };
  const labelStyle = { display: "block", fontFamily: "monospace", fontSize: 8, color: "#444", letterSpacing: "0.15em", marginBottom: 5 };
  const change     = (id, field, val) => setLocal(prev => prev.map(p => p.id === id ? { ...p, [field]: val } : p));

  const handleImageUpload = (id, e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => change(id, "image", ev.target.result);
    reader.readAsDataURL(file);
  };

  const acceptMember = (entry) => {
    const updated = waitlist.filter(w => w.phone !== entry.phone);
    const newMembers = [...members, { ...entry, status: "accepted", acceptedDate: new Date().toLocaleDateString() }];
    setWaitlist(updated); setMembers(newMembers);
    saveWaitlist(updated); saveMembers(newMembers);
  };

  const removeMember = (phone) => {
    const updated = members.filter(m => m.phone !== phone);
    setMembers(updated); saveMembers(updated);
  };

  const rejectApplicant = (phone) => {
    const updated = waitlist.filter(w => w.phone !== phone);
    setWaitlist(updated); saveWaitlist(updated);
  };

  const welcomeMsg = (name) => `${name} welcome to Phantom Avenue members only.`;

  const copyMsg = (entry) => {
    navigator.clipboard.writeText(welcomeMsg(entry.name)).catch(() => {});
    setCopied(entry.phone);
    setTimeout(() => setCopied(null), 2000);
  };

  const saveAll = () => {
    onUpdate({
      products: local.map(p => ({ ...p, stock: Math.min(Number(p.stock), Number(p.maxStock)), maxStock: Number(p.maxStock), price: Number(p.price) })),
      collection: { name: collName },
    });
    onClose();
  };

  const tabs = ["waitlist", "members", "products", "collection", "sms list"];

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.93)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: "#0D0D0D", border: "1px solid #222", width: "100%", maxWidth: 560, maxHeight: "92vh", overflowY: "auto", padding: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 22 }}>
          <span style={{ fontFamily: "'Arial Black', sans-serif", fontSize: 13, fontWeight: 900, letterSpacing: "0.2em", color: "#FAFAFA" }}>ADMIN</span>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#555" }}><IconClose /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 0, marginBottom: 26, borderBottom: "1px solid #1C1C1C", overflowX: "auto" }}>
          {tabs.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ background: "none", border: "none", cursor: "pointer", fontFamily: "monospace", fontSize: 7, letterSpacing: "0.12em", color: tab === t ? "#39FF14" : "#333", padding: "10px 14px 10px 0", borderBottom: tab === t ? "1px solid #39FF14" : "1px solid transparent", marginBottom: -1, textTransform: "uppercase", whiteSpace: "nowrap" }}>{t}</button>
          ))}
        </div>

        {/* ── WAITLIST TAB ── */}
        {tab === "waitlist" && (
          <div>
            <div style={{ fontFamily: "monospace", fontSize: 8, color: "#444", letterSpacing: "0.15em", marginBottom: 16 }}>
              {waitlist.length} PENDING REQUEST{waitlist.length !== 1 ? "S" : ""}
            </div>
            {waitlist.length === 0 ? <div style={{ color: "#2A2A2A", fontFamily: "monospace", fontSize: 10 }}>NO PENDING REQUESTS</div>
              : waitlist.map((entry, i) => (
                <div key={i} style={{ background: "#111", border: "1px solid #1A1A1A", padding: "14px 16px", marginBottom: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontFamily: "'Arial Black', sans-serif", fontSize: 13, color: "#FAFAFA", fontWeight: 900, marginBottom: 3 }}>{entry.name}</div>
                      <div style={{ fontFamily: "monospace", fontSize: 10, color: "#555" }}>{entry.phone}</div>
                      <div style={{ fontFamily: "monospace", fontSize: 8, color: "#2A2A2A", marginTop: 2 }}>{entry.date}</div>
                    </div>
                  </div>
                  {/* Welcome message preview */}
                  <div style={{ background: "#0A0A0A", border: "1px solid #1C1C1C", padding: "10px 12px", marginBottom: 10, borderRadius: 2 }}>
                    <div style={{ fontFamily: "monospace", fontSize: 7, color: "#444", letterSpacing: "0.12em", marginBottom: 4 }}>WELCOME TEXT PREVIEW</div>
                    <div style={{ fontFamily: "'Helvetica Neue', sans-serif", fontSize: 11, color: "#888", lineHeight: 1.5 }}>"{welcomeMsg(entry.name)}"</div>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { acceptMember(entry); copyMsg(entry); }} style={{ flex: 1, background: "#39FF14", color: "#000", border: "none", padding: "10px 0", fontFamily: "'Arial Black', sans-serif", fontSize: 9, fontWeight: 900, letterSpacing: "0.15em", cursor: "pointer" }}>
                      ✓ ACCEPT
                    </button>
                    <button onClick={() => copyMsg(entry)} style={{ background: "transparent", border: "1px solid #222", color: copied === entry.phone ? "#39FF14" : "#555", padding: "10px 14px", fontFamily: "monospace", fontSize: 8, letterSpacing: "0.1em", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                      <IconCopy /> {copied === entry.phone ? "COPIED!" : "COPY TEXT"}
                    </button>
                    <button onClick={() => rejectApplicant(entry.phone)} style={{ background: "transparent", border: "1px solid #1C1C1C", color: "#333", padding: "10px 14px", fontFamily: "monospace", fontSize: 8, cursor: "pointer" }}>✕</button>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* ── MEMBERS TAB ── */}
        {tab === "members" && (
          <div>
            <div style={{ fontFamily: "monospace", fontSize: 8, color: "#444", letterSpacing: "0.15em", marginBottom: 16 }}>
              {members.length} ACCEPTED MEMBER{members.length !== 1 ? "S" : ""}
            </div>
            {members.length === 0 ? <div style={{ color: "#2A2A2A", fontFamily: "monospace", fontSize: 10 }}>NO MEMBERS YET</div>
              : members.map((m, i) => (
                <div key={i} style={{ background: "#111", border: "1px solid #1A1A1A", padding: "12px 16px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontFamily: "'Arial Black', sans-serif", fontSize: 12, color: "#FAFAFA", fontWeight: 900, marginBottom: 2 }}>{m.name}</div>
                    <div style={{ fontFamily: "monospace", fontSize: 9, color: "#555" }}>{m.phone}</div>
                    <div style={{ fontFamily: "monospace", fontSize: 7, color: "#2A2A2A", marginTop: 2 }}>JOINED {m.acceptedDate}</div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <div style={{ padding: "3px 8px", border: "1px solid #39FF14", fontFamily: "monospace", fontSize: 7, color: "#39FF14", letterSpacing: "0.1em" }}>MEMBER</div>
                    <button onClick={() => removeMember(m.phone)} style={{ background: "none", border: "1px solid #1C1C1C", color: "#333", padding: "3px 8px", fontFamily: "monospace", fontSize: 7, cursor: "pointer" }}>REMOVE</button>
                  </div>
                </div>
              ))
            }
          </div>
        )}

        {/* ── PRODUCTS TAB ── */}
        {tab === "products" && (
          <>
            {local.map((p, i) => (
              <div key={p.id} style={{ marginBottom: 28, paddingBottom: 28, borderBottom: i < local.length - 1 ? "1px solid #161616" : "none" }}>
                <div style={{ fontFamily: "monospace", fontSize: 8, color: "#39FF14", letterSpacing: "0.15em", marginBottom: 14 }}>PRODUCT {p.id}</div>
                <div style={{ marginBottom: 16 }}>
                  <label style={labelStyle}>PRODUCT IMAGE</label>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    {p.image && <img src={p.image} alt="" style={{ width: 56, height: 56, objectFit: "cover", border: "1px solid #222" }} />}
                    <label style={{ display: "flex", alignItems: "center", gap: 7, background: "#111", border: "1px solid #222", padding: "9px 14px", cursor: "pointer", fontFamily: "monospace", fontSize: 9, color: "#555", letterSpacing: "0.12em" }}>
                      <IconImage />{p.image ? "CHANGE IMAGE" : "UPLOAD IMAGE"}
                      <input type="file" accept="image/*" onChange={e => handleImageUpload(p.id, e)} style={{ display: "none" }} />
                    </label>
                    {p.image && <button onClick={() => change(p.id, "image", null)} style={{ background: "none", border: "1px solid #222", color: "#FF3B30", padding: "9px 12px", cursor: "pointer", fontFamily: "monospace", fontSize: 8 }}>REMOVE</button>}
                  </div>
                </div>
                {[
                  { label: "NAME", field: "name", type: "text" },
                  { label: "SUBTITLE", field: "subtitle", type: "text" },
                  { label: "DESCRIPTION", field: "description", type: "text" },
                  { label: "PRICE ($)", field: "price", type: "number" },
                  { label: "STOCK NOW", field: "stock", type: "number" },
                  { label: "MAX STOCK", field: "maxStock", type: "number" },
                ].map(({ label, field, type }) => (
                  <div key={field} style={{ marginBottom: 11 }}>
                    <label style={labelStyle}>{label}</label>
                    <input type={type} value={p[field] ?? ""} onChange={e => change(p.id, field, e.target.value)} style={inputStyle} />
                  </div>
                ))}
              </div>
            ))}
            <button onClick={saveAll} style={{ width: "100%", background: "#39FF14", color: "#000", border: "none", padding: 14, fontFamily: "'Arial Black', sans-serif", fontSize: 10, fontWeight: 900, letterSpacing: "0.2em", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><IconCheck /> SAVE CHANGES</button>
          </>
        )}

        {/* ── COLLECTION TAB ── */}
        {tab === "collection" && (
          <div>
            <div style={{ fontFamily: "monospace", fontSize: 8, color: "#39FF14", letterSpacing: "0.15em", marginBottom: 14 }}>DROP COLLECTION NAME</div>
            <div style={{ fontFamily: "monospace", fontSize: 8, color: "#444", letterSpacing: "0.12em", marginBottom: 16, lineHeight: 1.6 }}>Hidden until Wednesday 8PM EST. Set it here in advance.</div>
            <label style={labelStyle}>COLLECTION NAME</label>
            <input type="text" value={collName} onChange={e => setCollName(e.target.value)} style={{ ...inputStyle, marginBottom: 20, fontSize: 14 }} placeholder="e.g. DEAD OF NIGHT" />
            <button onClick={saveAll} style={{ width: "100%", background: "#39FF14", color: "#000", border: "none", padding: 14, fontFamily: "'Arial Black', sans-serif", fontSize: 10, fontWeight: 900, letterSpacing: "0.2em", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}><IconCheck /> SAVE CHANGES</button>
          </div>
        )}

        {/* ── SMS LIST TAB ── */}
        {tab === "sms list" && (
          <div>
            <div style={{ fontFamily: "monospace", fontSize: 8, color: "#444", letterSpacing: "0.15em", marginBottom: 16 }}>{smsList.length} NUMBER{smsList.length !== 1 ? "S" : ""} ON DROP ALERT LIST</div>
            {smsList.length === 0 ? <div style={{ color: "#2A2A2A", fontFamily: "monospace", fontSize: 10 }}>NO SIGNUPS YET</div>
              : <>
                  {smsList.map((e, i) => (
                    <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "9px 12px", background: "#111", border: "1px solid #1A1A1A", marginBottom: 4 }}>
                      <span style={{ fontFamily: "monospace", fontSize: 11, color: "#FAFAFA" }}>{e.phone}</span>
                      <span style={{ fontFamily: "monospace", fontSize: 8, color: "#333" }}>{e.date}</span>
                    </div>
                  ))}
                  <button onClick={() => navigator.clipboard.writeText(smsList.map(e => e.phone).join("\n")).catch(() => {})} style={{ marginTop: 12, background: "transparent", border: "1px solid #222", color: "#555", padding: 10, fontFamily: "monospace", fontSize: 9, letterSpacing: "0.12em", cursor: "pointer", width: "100%" }}>COPY ALL NUMBERS</button>
                </>
            }
          </div>
        )}
      </div>
    </div>
  );
}

// ─── SOLD OUT ──────────────────────────────────────────────────────────────────
function SoldOutScreen() {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", pointerEvents: "none" }}>
      <div style={{ fontFamily: "'Arial Black', sans-serif", fontSize: "clamp(26px, 6vw, 68px)", fontWeight: 900, color: "#FF3B30", letterSpacing: "-0.02em", textAlign: "center", lineHeight: 1, border: "3px solid #FF3B30", padding: "clamp(18px, 3vw, 36px) clamp(24px, 5vw, 64px)" }}>SORRY<br />YOU MISSED IT</div>
      <div style={{ fontFamily: "monospace", fontSize: 9, color: "#FF3B30", opacity: 0.4, letterSpacing: "0.2em", marginTop: 20 }}>CHECK BACK NEXT SATURDAY</div>
    </div>
  );
}

// ─── CHECKOUT SUCCESS ──────────────────────────────────────────────────────────
function CheckoutSuccess({ onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "#000", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, padding: 24 }}>
      <div style={{ color: "#39FF14" }}><IconCheck /></div>
      <div style={{ fontFamily: "'Arial Black', sans-serif", fontSize: "clamp(26px, 6vw, 50px)", fontWeight: 900, color: "#FAFAFA", letterSpacing: "-0.03em", textAlign: "center" }}>ORDER PLACED.</div>
      <div style={{ fontFamily: "monospace", fontSize: 10, color: "#333", letterSpacing: "0.15em" }}>YOU'RE PART OF THE DROP.</div>
      <button onClick={onClose} style={{ marginTop: 14, background: "transparent", border: "1px solid #1C1C1C", color: "#444", padding: "11px 26px", fontFamily: "monospace", fontSize: 9, letterSpacing: "0.15em", cursor: "pointer" }}>CONTINUE</button>
    </div>
  );
}

// ─── ADMIN GATE ───────────────────────────────────────────────────────────────
function AdminGateModal({ onSuccess, onClose }) {
  const [val, setVal] = useState(""); const [error, setError] = useState(false);
  const submit = () => { if (val === ADMIN_PASSWORD) onSuccess(); else setError(true); };
  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(0,0,0,0.95)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#0D0D0D", border: "1px solid #222", padding: 36, width: "100%", maxWidth: 340 }}>
        <div style={{ fontFamily: "'Arial Black', sans-serif", fontSize: 12, fontWeight: 900, letterSpacing: "0.2em", color: "#FAFAFA", marginBottom: 20 }}>ADMIN ACCESS</div>
        <input type="password" placeholder="ENTER PASSWORD" value={val} onChange={e => { setVal(e.target.value); setError(false); }} onKeyDown={e => e.key === "Enter" && submit()}
          style={{ width: "100%", background: "#111", border: `1px solid ${error ? "#FF3B30" : "#222"}`, color: "#FAFAFA", padding: "11px 13px", fontFamily: "monospace", fontSize: 12, outline: "none", boxSizing: "border-box", letterSpacing: "0.1em", marginBottom: 8 }} />
        {error && <div style={{ fontFamily: "monospace", fontSize: 8, color: "#FF3B30", letterSpacing: "0.1em", marginBottom: 8 }}>INCORRECT PASSWORD</div>}
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button onClick={submit} style={{ flex: 1, background: "#FAFAFA", color: "#000", border: "none", padding: 12, fontFamily: "'Arial Black', sans-serif", fontSize: 9, fontWeight: 900, letterSpacing: "0.15em", cursor: "pointer" }}>ENTER</button>
          <button onClick={onClose} style={{ background: "none", border: "1px solid #222", color: "#555", padding: "12px 14px", cursor: "pointer", fontFamily: "monospace", fontSize: 10 }}>✕</button>
        </div>
      </div>
    </div>
  );
}

// ─── DEV BAR ──────────────────────────────────────────────────────────────────
function DevBar({ devStage, setDevStage }) {
  const stages = [{ label: "S0", sub: "BASE" }, { label: "S1", sub: "STOCK" }, { label: "S2", sub: "NAME" }, { label: "S3", sub: "IMAGES" }, { label: "S4", sub: "LIVE" }];
  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 9999, background: "#0A0A0A", borderTop: "1px solid #39FF14", display: "flex", alignItems: "center", padding: "8px 16px", gap: 8, overflowX: "auto" }}>
      <span style={{ fontFamily: "monospace", fontSize: 7, color: "#333", letterSpacing: "0.15em", whiteSpace: "nowrap", marginRight: 4 }}>DEV</span>
      {stages.map((s, i) => (
        <button key={i} onClick={() => setDevStage(i === devStage ? null : i)} style={{ background: devStage === i ? "#1A1A1A" : "transparent", border: `1px solid ${devStage === i ? "#39FF14" : "#1C1C1C"}`, color: devStage === i ? "#39FF14" : "#333", padding: "5px 10px", fontFamily: "monospace", fontSize: 7, letterSpacing: "0.1em", cursor: "pointer", whiteSpace: "nowrap", display: "flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
          <span>{s.label}</span><span style={{ fontSize: 6, opacity: 0.6 }}>{s.sub}</span>
        </button>
      ))}
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function PhantomAvenueStore() {
  const stored = loadStore();
  const [schedule,      setSchedule]      = useState(getSchedule());
  const [products,      setProducts]      = useState(stored.products);
  const [collection,    setCollection]    = useState(stored.collection || DEFAULT_COLLECTION);
  const [cart,          setCart]          = useState([]);
  const [cartOpen,      setCartOpen]      = useState(false);
  const [adminGate,     setAdminGate]     = useState(false);
  const [adminOpen,     setAdminOpen]     = useState(false);
  const [viewerCount,   setViewerCount]   = useState(1);
  const [success,       setSuccess]       = useState(false);
  const [newPurchase,   setNewPurchase]   = useState(null);
  const [devStage,      setDevStage]      = useState(null);
  const [authMember,    setAuthMember]    = useState(loadAuth());
  const [waitlistCount, setWaitlistCount] = useState(loadWaitlist().length);
  const [showWaitlist,  setShowWaitlist]  = useState(!loadAuth());

  const sessionId = useRef(getSessionId());

  useEffect(() => { const iv = setInterval(() => setSchedule(getSchedule()), 10000); return () => clearInterval(iv); }, []);
  useEffect(() => {
    const beat = () => { const v = loadViewers(); v[sessionId.current] = Date.now(); saveViewers(v); setViewerCount(getLiveViewers().count); };
    beat(); const iv = setInterval(beat, 8000); return () => clearInterval(iv);
  }, []);
  useEffect(() => {
    const iv = setInterval(() => {
      const s = loadStore(); setProducts(s.products); setCollection(s.collection || DEFAULT_COLLECTION);
      setViewerCount(getLiveViewers().count);
      setWaitlistCount(loadWaitlist().length);
    }, 3000);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => { saveStore({ products, collection }); }, [products, collection]);
  useEffect(() => {
    const cleanup = () => { const v = loadViewers(); delete v[sessionId.current]; saveViewers(v); };
    window.addEventListener("beforeunload", cleanup); return () => window.removeEventListener("beforeunload", cleanup);
  }, []);

  const activeSchedule = devStage === null ? schedule : {
    stage: devStage, isStoreLive: devStage >= 4, isImageRevealed: devStage >= 3,
    isNameRevealed: devStage >= 2, isStockRevealed: devStage >= 1,
    nextMs: 0, nextLabel: ["STOCK REVEALS TUE 8PM","COLLECTION NAME REVEALS WED 8PM","PRODUCTS REVEAL THU 8PM","DROP GOES LIVE SAT 8AM","LIVE NOW"][devStage] || "",
    msUntilStock: 0, msUntilName: 0, msUntilImage: 0, msUntilDrop: 0,
  };

  const allSoldOut = products.every(p => p.stock === 0);
  const cartCount  = cart.reduce((s, i) => s + i.qty, 0);

  const handleBuy = useCallback((productId) => {
    setProducts(prev => {
      const updated = prev.map(p => { if (p.id === productId && p.stock > 0) { setNewPurchase(p.name); setTimeout(() => setNewPurchase(null), 3000); return { ...p, stock: p.stock - 1 }; } return p; });
      saveStore({ products: updated, collection }); return updated;
    });
    setCart(prev => { const ex = prev.find(i => i.id === productId); return ex ? prev.map(i => i.id === productId ? { ...i, qty: i.qty + 1 } : i) : [...prev, { id: productId, qty: 1 }]; });
    setCartOpen(true);
  }, [collection]);

  const updateAll = ({ products: p, collection: c }) => { setProducts(p); setCollection(c); saveStore({ products: p, collection: c }); };
  const handleLogin = (member) => { setAuthMember(member); setShowWaitlist(false); };
  const devBar = <DevBar devStage={devStage} setDevStage={setDevStage} />;

  const globalStyles = `* { box-sizing: border-box; margin: 0; padding: 0; } @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}} @keyframes slideUp{from{transform:translateY(14px);opacity:0}to{transform:translateY(0);opacity:1}} @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}} input:focus{border-color:#39FF14!important} ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-track{background:#0A0A0A} ::-webkit-scrollbar-thumb{background:#1C1C1C}`;

  // ── Waitlist popup (shows to all non-members on arrival) ──────────────────
  const waitlistPopup = showWaitlist && (
    <WaitlistPopup
      waitlistCount={waitlistCount}
      onJoin={() => {}}
      onLogin={handleLogin}
    />
  );

  // ── Pre-drop gate ─────────────────────────────────────────────────────────
  if (!activeSchedule.isStoreLive) {
    return (
      <>
        <style>{globalStyles}</style>
        {waitlistPopup}
        <div style={{ paddingBottom: 56 }}>
          <PreDropGate products={products} collection={collection} schedule={activeSchedule} waitlistCount={waitlistCount} />
        </div>
        <button onClick={() => setAdminGate(true)} style={{ position: "fixed", bottom: 58, right: 14, background: "none", border: "none", fontFamily: "monospace", fontSize: 9, color: "#111", cursor: "pointer" }}>⚙</button>
        {devBar}
        {adminGate && <AdminGateModal onSuccess={() => { setAdminGate(false); setAdminOpen(true); }} onClose={() => setAdminGate(false)} />}
        {adminOpen && <AdminPanel products={products} collection={collection} onUpdate={updateAll} onClose={() => setAdminOpen(false)} />}
      </>
    );
  }

  // ── Live store ─────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#000", color: "#FAFAFA", fontFamily: "'Helvetica Neue', Helvetica, Arial, sans-serif", paddingBottom: 56 }}>
      <style>{globalStyles}</style>

      {waitlistPopup}
      {allSoldOut && <SoldOutScreen />}

      {newPurchase && (
        <div style={{ position: "fixed", bottom: 64, left: 22, zIndex: 900, background: "#0D0D0D", border: "1px solid #39FF14", padding: "11px 16px", animation: "slideUp 0.3s ease", maxWidth: 250 }}>
          <div style={{ fontFamily: "monospace", fontSize: 7, color: "#39FF14", letterSpacing: "0.15em", marginBottom: 3 }}>JUST PURCHASED</div>
          <div style={{ fontFamily: "'Arial Black', sans-serif", fontSize: 11, color: "#FAFAFA", fontWeight: 900 }}>{newPurchase}</div>
        </div>
      )}

      {/* Header */}
      <header style={{ position: "sticky", top: 0, zIndex: 100, background: "#000", borderBottom: "1px solid #111", display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 clamp(16px, 4vw, 48px)", height: 54 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "monospace", fontSize: 9, color: "#444", letterSpacing: "0.12em" }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#39FF14", display: "inline-block", animation: "pulse 2s ease-in-out infinite" }} />
          <span style={{ color: "#FAFAFA", fontWeight: "bold" }}>{viewerCount}</span>
          <span>VIEWING NOW</span>
        </div>
        <div style={{ fontFamily: "'Arial Black', sans-serif", fontSize: "clamp(11px, 2vw, 15px)", fontWeight: 900, letterSpacing: "0.22em", color: "#FAFAFA", position: "absolute", left: "50%", transform: "translateX(-50%)", whiteSpace: "nowrap" }}>PHANTOM AVENUE</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {authMember && <span style={{ fontFamily: "monospace", fontSize: 8, color: "#39FF14", letterSpacing: "0.12em" }}>MEMBER</span>}
          <button onClick={() => setCartOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", color: "#FAFAFA", display: "flex", alignItems: "center", gap: 7, padding: 0 }}>
            <IconCart />
            {cartCount > 0 && <span style={{ fontFamily: "'Arial Black', sans-serif", fontSize: 10, fontWeight: 900, color: "#39FF14" }}>{cartCount}</span>}
          </button>
        </div>
      </header>

      {/* Ticker */}
      <div style={{ borderBottom: "1px solid #0F0F0F", padding: "9px clamp(16px, 4vw, 48px)", display: "flex", gap: 28, alignItems: "center", overflowX: "auto" }}>
        {["DROP LIVE NOW", "MEMBERS ONLY", "FREE SHIPPING OVER $150", "NO RESTOCK"].map((t, i) => (
          <span key={i} style={{ fontFamily: "monospace", fontSize: 8, color: "#252525", letterSpacing: "0.15em", whiteSpace: "nowrap" }}>{t}</span>
        ))}
      </div>

      {/* Hero */}
      <div style={{ padding: "clamp(36px, 6vw, 72px) clamp(16px, 4vw, 48px)", borderBottom: "1px solid #0F0F0F" }}>
        {authMember && <div style={{ fontFamily: "monospace", fontSize: 9, color: "#39FF14", letterSpacing: "0.2em", marginBottom: 8 }}>WELCOME BACK, {authMember.name.split(" ")[0].toUpperCase()}</div>}
        <div style={{ fontFamily: "monospace", fontSize: "clamp(8px, 1vw, 10px)", color: "#2A2A2A", letterSpacing: "0.3em", marginBottom: 12 }}>COLLECTION</div>
        <div style={{ fontFamily: "'Arial Black', sans-serif", fontSize: "clamp(36px, 8vw, 96px)", fontWeight: 900, color: "#FAFAFA", letterSpacing: "-0.04em", lineHeight: 0.88, marginBottom: 16 }}>{collection.name}</div>
        <div style={{ fontFamily: "monospace", fontSize: "clamp(9px, 1.2vw, 11px)", color: "#2A2A2A", letterSpacing: "0.15em", maxWidth: 320 }}>TWO PIECES. NO RESTOCK. ONCE IT'S GONE, IT'S GONE.</div>
      </div>

      {/* Products */}
      <div style={{ padding: "clamp(20px, 3.5vw, 44px) clamp(16px, 4vw, 48px)", display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 2 }}>
        {products.map(p => <ProductCard key={p.id} product={p} onBuy={handleBuy} isImageRevealed={activeSchedule.isImageRevealed} isStoreLive={activeSchedule.isStoreLive} />)}
      </div>

      {/* Footer */}
      <footer style={{ borderTop: "1px solid #0F0F0F", padding: "clamp(18px, 3vw, 36px) clamp(16px, 4vw, 48px)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <span style={{ fontFamily: "'Arial Black', sans-serif", fontSize: 11, fontWeight: 900, letterSpacing: "0.2em", color: "#161616" }}>PHANTOM AVENUE</span>
        <div style={{ display: "flex", gap: 18 }}>{["SIZING", "SHIPPING", "RETURNS"].map(l => <span key={l} style={{ fontFamily: "monospace", fontSize: 7, color: "#1C1C1C", letterSpacing: "0.15em", cursor: "pointer" }}>{l}</span>)}</div>
        <button onClick={() => setAdminGate(true)} style={{ background: "none", border: "none", fontFamily: "monospace", fontSize: 7, color: "#161616", cursor: "pointer", letterSpacing: "0.1em" }}>⚙ ADMIN</button>
      </footer>

      {devBar}
      {adminGate && <AdminGateModal onSuccess={() => { setAdminGate(false); setAdminOpen(true); }} onClose={() => setAdminGate(false)} />}
      {adminOpen && <AdminPanel products={products} collection={collection} onUpdate={updateAll} onClose={() => setAdminOpen(false)} />}
      <CartDrawer cart={cart} products={products} open={cartOpen} onClose={() => setCartOpen(false)} onCheckout={() => { setCartOpen(false); setSuccess(true); setCart([]); }} />
      {success && <CheckoutSuccess onClose={() => setSuccess(false)} />}
    </div>
  );
}
