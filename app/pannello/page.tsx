"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./pannello.module.css";
import { getBusinessConfig } from "@/app/config/business";

type BookingStatus = "RICHIESTA" | "NUOVA" | "CONFERMATA" | "ANNULLATA" | string;

type AdminRow = {
  id: string;
  rowNumber?: number;
  timestamp?: string;

  nome?: string;
  telefono?: string;
  servizio?: string;

  dataISO?: string; // yyyy-mm-dd
  ora?: string; // HH:mm

  note?: string;
  stato?: BookingStatus;
  canale?: string;
};

type MeResponse =
  | { ok: true; loggedIn?: boolean; isLoggedIn?: boolean; authenticated?: boolean }
  | { ok: false; error?: string; details?: any };

type ListResponse =
  | { ok: true; rows: AdminRow[]; count?: number }
  | { ok: false; error?: string; details?: any };

type UpdateResponse =
  | { ok: true; status?: string; message?: string }
  | { ok: false; error?: string; conflict?: boolean; details?: any };

type AvailabilityOk = { ok: true; freeSlots: string[]; date?: string; mode?: string };
type AvailabilityErr = { ok: false; error?: string; details?: any };
type AvailabilityResponse = AvailabilityOk | AvailabilityErr;

function safeTel(t?: string) {
  return String(t || "").replace(/[^\d]/g, "");
}

function toITDate(iso?: string) {
  const s = String(iso || "").trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return s || "—";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysISO(iso: string, days: number) {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function safeJson(res: Response) {
  const text = await res.text().catch(() => "");
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, error: "Risposta non valida dal server.", details: text };
  }
}

// ✅ Normalizzazione status: in UI usiamo "RICHIESTA"
function normStatus(s?: string): "RICHIESTA" | "CONFERMATA" | "ANNULLATA" | string {
  const up = String(s || "").toUpperCase().trim();
  if (up === "NUOVA") return "RICHIESTA";
  if (up === "RICHIESTA" || up === "CONFERMATA" || up === "ANNULLATA") return up;
  return up || "RICHIESTA";
}

function waLink(phone: string, text: string) {
  const p = safeTel(phone);
  const msg = encodeURIComponent(text);
  return `https://wa.me/${p}?text=${msg}`;
}

function buildConfirmMsg(r: AdminRow) {
  const nome = (r.nome || "").trim();
  const data = toITDate(r.dataISO);
  const ora = r.ora || "—";
  const serv = (r.servizio || "appuntamento").toString();
  return `Ciao${nome ? " " + nome : ""}! ✅ Il tuo appuntamento è CONFERMATO per ${data} alle ${ora} (${serv}). A presto!`;
}

function buildCancelMsg(r: AdminRow) {
  const nome = (r.nome || "").trim();
  const data = toITDate(r.dataISO);
  const ora = r.ora || "—";
  const serv = (r.servizio || "appuntamento").toString();
  return `Ciao${nome ? " " + nome : ""}. ❌ Il tuo appuntamento è ANNULLATO (${serv}) del ${data} alle ${ora}. Se vuoi riprenotare, scrivimi qui.`;
}

function statusPillStyle(st: string): React.CSSProperties {
  const s = normStatus(st);

  if (s === "CONFERMATA") {
    return {
      background: "rgba(34, 197, 94, 0.10)",
      border: "1px solid rgba(34, 197, 94, 0.24)",
      color: "rgba(15, 23, 42, 0.92)",
    };
  }
  if (s === "ANNULLATA") {
    return {
      background: "rgba(239, 68, 68, 0.10)",
      border: "1px solid rgba(239, 68, 68, 0.26)",
      color: "rgba(15, 23, 42, 0.92)",
    };
  }

  // Richiesta: pill neutra (non giallo pesante)
  return {
    background: "rgba(15, 23, 42, 0.06)",
    border: "1px solid rgba(15, 23, 42, 0.14)",
    color: "rgba(15, 23, 42, 0.92)",
  };
}

function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
}

/** 🔊 Beep senza file audio in public */
function playBeep(durationMs = 220) {
  try {
    const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.08;

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();

    window.setTimeout(() => {
      try {
        osc.stop();
        osc.disconnect();
        gain.disconnect();
        ctx.close();
      } catch {}
    }, durationMs);
  } catch {}
}

function speak(text: string) {
  try {
    if (typeof window === "undefined") return;
    const synth = window.speechSynthesis;
    if (!synth) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "it-IT";
    u.rate = 1.02;
    u.pitch = 1.0;
    synth.cancel();
    synth.speak(u);
  } catch {}
}

export default function PannelloAdminPage() {
  const router = useRouter();

  const biz = useMemo(() => {
    try {
      return getBusinessConfig() as any;
    } catch {
      return {} as any;
    }
  }, []);

  const badgeTop = biz?.badgeTop ?? "GALAXBOT AI • ADMIN";
  const title = biz?.headline ? `Prenotazioni · ${biz.headline}` : "Prenotazioni";

  const [checking, setChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  const [rows, setRows] = useState<AdminRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [rowsError, setRowsError] = useState<string | null>(null);

  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const showToast = (type: "ok" | "err", msg: string) => {
    setToast({ type, msg });
    window.setTimeout(() => setToast(null), 2400);
  };

  const [dayMode, setDayMode] = useState<"TUTTO" | "OGGI" | "DOMANI" | "7" | "DATA">("TUTTO");
  const [pickDate, setPickDate] = useState<string>(todayISO());
  const [statusFilter, setStatusFilter] = useState<"TUTTE" | "RICHIESTA" | "CONFERMATA" | "ANNULLATA">("TUTTE");

  // Disponibilità
  const [availDate, setAvailDate] = useState<string>(todayISO());
  const [availLoading, setAvailLoading] = useState(false);
  const [availSlots, setAvailSlots] = useState<string[]>([]);
  const [availMsg, setAvailMsg] = useState<string>("");

  // 🔔 Suono/Voce
  const [soundOn, setSoundOn] = useState(true);
  const [voiceOn, setVoiceOn] = useState(false);

  // evidenziazione nuove card
  const [highlightIds, setHighlightIds] = useState<Record<string, number>>({}); // id -> expireTs

  // per capire cosa è “nuovo”
  const hasLoadedOnceRef = useRef(false);
  const prevIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    try {
      const s = localStorage.getItem("gb_soundOn");
      const v = localStorage.getItem("gb_voiceOn");
      if (s !== null) setSoundOn(s === "1");
      if (v !== null) setVoiceOn(v === "1");
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("gb_soundOn", soundOn ? "1" : "0");
    } catch {}
  }, [soundOn]);

  useEffect(() => {
    try {
      localStorage.setItem("gb_voiceOn", voiceOn ? "1" : "0");
    } catch {}
  }, [voiceOn]);

  const counts = useMemo(() => {
    const c = { RICHIESTA: 0, CONFERMATA: 0, ANNULLATA: 0 };
    rows.forEach((r) => {
      const s = normStatus(r.stato);
      if (s === "RICHIESTA") c.RICHIESTA++;
      if (s === "CONFERMATA") c.CONFERMATA++;
      if (s === "ANNULLATA") c.ANNULLATA++;
    });
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    const t = todayISO();
    let fromISO: string | null = null;
    let toISO: string | null = null;

    if (dayMode === "OGGI") {
      fromISO = t;
      toISO = t;
    } else if (dayMode === "DOMANI") {
      fromISO = addDaysISO(t, 1);
      toISO = fromISO;
    } else if (dayMode === "7") {
      fromISO = t;
      toISO = addDaysISO(t, 7);
    } else if (dayMode === "DATA") {
      fromISO = pickDate;
      toISO = pickDate;
    }

    return rows
      .filter((r) => {
        if (!fromISO || !toISO) return true;
        const d = String(r.dataISO || "").trim();
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return true;
        return d >= fromISO && d <= toISO;
      })
      .filter((r) => {
        if (statusFilter === "TUTTE") return true;
        return normStatus(r.stato) === statusFilter;
      })
      .sort((a, b) => {
        const da = String(a.dataISO || "");
        const db = String(b.dataISO || "");
        if (da !== db) return da.localeCompare(db);
        const ta = String(a.ora || "");
        const tb = String(b.ora || "");
        return ta.localeCompare(tb);
      });
  }, [rows, dayMode, pickDate, statusFilter]);

  const checkMe = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/admin/me", { credentials: "include" });
      const data: MeResponse = await safeJson(res);
      const ok = (data as any)?.ok === true;
      const li = Boolean((data as any)?.loggedIn ?? (data as any)?.isLoggedIn ?? (data as any)?.authenticated);
      setLoggedIn(ok && li);
    } catch {
      setLoggedIn(false);
    } finally {
      setChecking(false);
    }
  };

  const markHighlights = (newRows: AdminRow[]) => {
    const expire = Date.now() + 90_000;
    setHighlightIds((prev) => {
      const next = { ...prev };
      newRows.forEach((r) => (next[r.id] = expire));
      return next;
    });

    window.setTimeout(() => {
      setHighlightIds((prev) => {
        const now = Date.now();
        const next: Record<string, number> = {};
        Object.entries(prev).forEach(([id, ts]) => {
          if (ts > now) next[id] = ts;
        });
        return next;
      });
    }, 95_000);
  };

  const triggerAlertsForNew = (newRows: AdminRow[]) => {
    if (newRows.length === 0) return;

    if (soundOn) playBeep();
    if (voiceOn) {
      const r = newRows[0];
      const nome = (r.nome || "Cliente").toString().trim();
      const data = toITDate(r.dataISO);
      const ora = r.ora || "";
      speak(`Nuova prenotazione. ${nome}. ${data} ${ora}`.trim());
    }

    showToast("ok", `🔔 Nuova prenotazione: ${newRows.length}`);
    markHighlights(newRows);
  };

  const loadRows = async (opts?: { silent?: boolean }) => {
    setLoadingRows(true);
    setRowsError(null);

    try {
      const res = await fetch("/api/admin/bookings?limit=800", { credentials: "include" });
      const data: ListResponse = await safeJson(res);

      if (!(data as any)?.ok) {
        setRowsError((data as any)?.error || "Errore nel caricamento prenotazioni.");
        setRows([]);
        return;
      }

      const list = Array.isArray((data as any).rows) ? (data as any).rows : [];
      const normalized: AdminRow[] = list
        .map((r: any) => ({
          id: String(r?.id ?? ""),
          rowNumber: r?.rowNumber,
          timestamp: r?.timestamp,
          nome: r?.nome ?? r?.name,
          telefono: r?.telefono ?? r?.phone,
          servizio: r?.servizio ?? r?.service,
          dataISO: r?.dataISO ?? r?.dateISO ?? r?.date,
          ora: r?.ora ?? r?.time,
          note: r?.note ?? r?.notes,
          stato: normStatus(r?.stato ?? r?.status),
          canale: r?.canale ?? r?.channel,
        }))
        .filter((x: AdminRow) => x.id);

      const prev = prevIdsRef.current;
      const nowIds = new Set(normalized.map((r) => r.id));

      if (!hasLoadedOnceRef.current) {
        hasLoadedOnceRef.current = true;
        prevIdsRef.current = nowIds;
        setRows(normalized);
        return;
      }

      const newOnes = normalized.filter((r) => !prev.has(r.id));

      prevIdsRef.current = nowIds;
      setRows(normalized);

      if (!opts?.silent) triggerAlertsForNew(newOnes);
    } catch {
      setRowsError("Errore rete nel caricamento prenotazioni.");
      setRows([]);
    } finally {
      setLoadingRows(false);
    }
  };

  const loadAvailability = async (isoDate: string) => {
    setAvailLoading(true);
    setAvailMsg("");
    setAvailSlots([]);

    try {
      const res = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: isoDate }),
      });

      const data: AvailabilityResponse = await safeJson(res);

      if (!(data as any)?.ok) {
        setAvailMsg((data as any)?.error || "Errore nel recupero disponibilità.");
        return;
      }

      const free = Array.isArray((data as any)?.freeSlots) ? (data as any).freeSlots : [];
      setAvailSlots(free);
      if (free.length === 0) setAvailMsg("Nessun orario libero per questa data.");
    } catch {
      setAvailMsg("Errore di rete (disponibilità).");
    } finally {
      setAvailLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    } catch {}
    showToast("ok", "Logout effettuato.");
    router.replace("/pannello/login");
    router.refresh();
  };

  function openExternalUrl(url: string) {
    if (!url) return;
    if (isMobileDevice()) window.location.href = url;
    else window.open(url, "_blank", "noopener,noreferrer");
  }

  function openWhatsApp(phone: string, message: string) {
    const p = safeTel(phone);
    if (!p) {
      showToast("err", "Telefono mancante: non posso aprire WhatsApp.");
      return;
    }
    openExternalUrl(waLink(p, message));
  }

  const clearHighlightForId = (id: string) => {
    setHighlightIds((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
  };

  const setStatus = async (id: string, status: "RICHIESTA" | "CONFERMATA" | "ANNULLATA") => {
    const next = status;

    if (next !== "RICHIESTA") clearHighlightForId(id);

    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, stato: next } : r)));

    try {
      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: next }),
        keepalive: true,
      });

      const data: UpdateResponse = await safeJson(res);
      if (!(data as any)?.ok) {
        showToast("err", (data as any)?.error || "Aggiornamento stato fallito.");
        await loadRows({ silent: true });
        return;
      }

      showToast("ok", `Stato aggiornato: ${next}`);
      await loadRows({ silent: true });
      await loadAvailability(availDate);
    } catch {
      showToast("err", "Errore rete: stato non aggiornato.");
      await loadRows({ silent: true });
    }
  };

  const confirmWhatsApp = (r: AdminRow) => {
    void setStatus(r.id, "CONFERMATA");
    window.setTimeout(() => openWhatsApp(r.telefono || "", buildConfirmMsg(r)), 160);
  };

  const cancelWhatsApp = (r: AdminRow) => {
    void setStatus(r.id, "ANNULLATA");
    window.setTimeout(() => openWhatsApp(r.telefono || "", buildCancelMsg(r)), 160);
  };

  const openGenericWhatsApp = (r: AdminRow) => {
    const nome = (r.nome || "Ciao").toString();
    const tel = r.telefono || "";
    if (!tel) {
      showToast("err", "Telefono mancante: non posso aprire WhatsApp.");
      return;
    }
    openWhatsApp(tel, `Ciao ${nome}!`);
  };

  useEffect(() => {
    checkMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!checking && !loggedIn) {
      router.replace("/pannello/login");
      return;
    }
    if (loggedIn) {
      void loadRows({ silent: true });
      void loadAvailability(availDate);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checking, loggedIn]);

  useEffect(() => {
    if (!loggedIn) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      void loadRows();
    }, 60_000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn, soundOn, voiceOn]);

  useEffect(() => {
    if (!loggedIn) return;
    void loadAvailability(availDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availDate, loggedIn]);

  if (checking) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <div className={styles.header}>
            <div className={styles.headerInner}>
              <div className={styles.badge}>{badgeTop}</div>
              <h1 className={styles.h1}>{title}</h1>
              <p className={styles.sub}>Controllo sessione…</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!loggedIn) return null;

  return (
    <div className={styles.page}>
      {toast ? (
        <div className={styles.toastWrap}>
          <div
            style={{
              pointerEvents: "none",
              padding: "10px 12px",
              borderRadius: 14,
              border: toast.type === "ok" ? "1px solid rgba(34,197,94,0.35)" : "1px solid rgba(239,68,68,0.35)",
              background: toast.type === "ok" ? "rgba(34,197,94,0.14)" : "rgba(239,68,68,0.14)",
              color: "rgba(15,23,42,0.92)",
              fontWeight: 950,
              boxShadow: "0 18px 55px rgba(0,0,0,0.20)",
              maxWidth: 860,
              width: "100%",
              textAlign: "center",
              backdropFilter: "blur(10px)",
            }}
          >
            {toast.msg}
          </div>
        </div>
      ) : null}

      <div className={styles.container}>
        {/* HEADER */}
        <div className={styles.header}>
          <div className={styles.headerInner}>
            <div className={styles.topRow}>
              <div>
                <div className={styles.badge}>{badgeTop}</div>
                <h1 className={styles.h1}>{title}</h1>
                <p className={styles.sub}>Conferma/Annulla in 2 tap. I messaggi WhatsApp sono già pronti.</p>

                <div className={styles.chipsRow}>
                  <div className={styles.chip}>🟡 Richieste: {counts.RICHIESTA}</div>
                  <div className={styles.chip}>✅ Confermate: {counts.CONFERMATA}</div>
                  <div className={styles.chip}>❌ Annullate: {counts.ANNULLATA}</div>
                </div>

                {/* 🔔 Toggle suono/voce (Test rimosso) */}
                <div className={styles.chipsRow} style={{ marginTop: 10, gap: 10 }}>
                  <button
                    className={styles.miniBtn}
                    onClick={() => setSoundOn((v) => !v)}
                    title="Attiva/Disattiva suono"
                    style={{
                      border: soundOn ? "1px solid rgba(34,197,94,0.35)" : "1px solid rgba(239,68,68,0.30)",
                      background: soundOn ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)",
                      color: "rgba(15,23,42,0.92)",
                      fontWeight: 950,
                    }}
                  >
                    🔊 Suono: {soundOn ? "ON" : "OFF"}
                  </button>

                  <button
                    className={styles.miniBtn}
                    onClick={() => setVoiceOn((v) => !v)}
                    title="Attiva/Disattiva voce"
                    style={{
                      border: voiceOn ? "1px solid rgba(34,197,94,0.35)" : "1px solid rgba(239,68,68,0.30)",
                      background: voiceOn ? "rgba(34,197,94,0.10)" : "rgba(239,68,68,0.10)",
                      color: "rgba(15,23,42,0.92)",
                      fontWeight: 950,
                    }}
                  >
                    🗣️ Voce: {voiceOn ? "ON" : "OFF"}
                  </button>
                </div>
              </div>

              <div className={styles.btnRow}>
                <button className={styles.btnPrimary} onClick={() => loadRows()} disabled={loadingRows} title="Aggiorna subito">
                  {loadingRows ? "Aggiorno…" : "Aggiorna"}
                </button>
                <button className={styles.btnDanger} onClick={logout}>
                  Esci
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* PANEL */}
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelTitle}>Prenotazioni</div>
            <div style={{ opacity: 0.8, fontSize: 12 }}>
              {loadingRows ? "Caricamento…" : `Totale visibili: ${filtered.length}`}
            </div>
          </div>

          <div className={styles.body}>
            {/* DISPONIBILITÀ */}
            <div className={styles.list} style={{ marginBottom: 14 }}>
              <div className={styles.card}>
                <div className={styles.leftBar} />
                <div className={styles.cardTop}>
                  <div className={styles.panelTitle}>🕒 Disponibilità (orari liberi)</div>
                  <div className={styles.actions}>
                    <input
                      className={styles.input as any}
                      style={{ fontSize: 16, minHeight: 44, width: 170 }}
                      type="date"
                      value={availDate}
                      onChange={(e) => setAvailDate(e.target.value)}
                    />
                    <button className={styles.miniBtn} onClick={() => loadAvailability(availDate)} disabled={availLoading}>
                      {availLoading ? "Carico…" : "Aggiorna"}
                    </button>
                  </div>
                </div>

                {availMsg ? <div className={styles.ok}>{availMsg}</div> : null}

                {availSlots.length > 0 ? (
                  <div className={styles.actions}>
                    {availSlots.map((s) => (
                      <span key={s} className={styles.miniBtn} style={{ pointerEvents: "none" }}>
                        {s}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            {/* FILTRI */}
            <div className={styles.tools}>
              <div className={styles.pillRow}>
                {[
                  { k: "TUTTO", label: "Tutto" },
                  { k: "OGGI", label: "Oggi" },
                  { k: "DOMANI", label: "Domani" },
                  { k: "7", label: "7 giorni" },
                  { k: "DATA", label: "Data" },
                ].map((x) => (
                  <div
                    key={x.k}
                    className={`${styles.pill} ${dayMode === (x.k as any) ? styles.pillActive : ""}`}
                    onClick={() => setDayMode(x.k as any)}
                    role="button"
                  >
                    {x.label}
                  </div>
                ))}

                {dayMode === "DATA" ? (
                  <input
                    className={styles.input as any}
                    style={{ fontSize: 16, minHeight: 44, width: 170 }}
                    type="date"
                    value={pickDate}
                    onChange={(e) => setPickDate(e.target.value)}
                    aria-label="Scegli data filtro"
                  />
                ) : null}
              </div>

              <div className={styles.pillRow}>
                {(["TUTTE", "RICHIESTA", "CONFERMATA", "ANNULLATA"] as const).map((s) => (
                  <div
                    key={s}
                    className={`${styles.pill} ${statusFilter === s ? styles.pillActive : ""}`}
                    onClick={() => setStatusFilter(s)}
                    role="button"
                  >
                    {s === "TUTTE" ? "Tutte" : s}
                  </div>
                ))}
              </div>
            </div>

            {rowsError ? <div className={styles.error}>{rowsError}</div> : null}
            {!rowsError && loadingRows ? <div style={{ opacity: 0.8 }}>Carico prenotazioni…</div> : null}

            {!loadingRows && !rowsError && filtered.length === 0 ? (
              <div className={styles.ok}>Nessuna prenotazione da mostrare.</div>
            ) : (
              <div className={styles.list}>
                {filtered.map((r) => {
                  const st = normStatus(r.stato);
                  const nome = (r.nome || "Cliente").toString();
                  const tel = r.telefono || "";
                  const dateIT = toITDate(r.dataISO);
                  const ora = r.ora || "—";
                  const serv = (r.servizio || "—").toString();

                  const callHref = tel ? `tel:${safeTel(tel)}` : "#";
                  const telOk = Boolean(safeTel(tel));

                  const isHighlighted = Boolean(highlightIds[r.id] && highlightIds[r.id] > Date.now());
                  const isRequest = st === "RICHIESTA";
                  const glowActive = isRequest && isHighlighted;

                  // ✅ BORDO COMPLETO (colorato per stato) per separare bene le card
                  let borderCol = "rgba(15, 23, 42, 0.14)";
                  if (st === "RICHIESTA") borderCol = "rgba(245, 158, 11, 0.35)";
                  if (st === "CONFERMATA") borderCol = "rgba(34, 197, 94, 0.30)";
                  if (st === "ANNULLATA") borderCol = "rgba(239, 68, 68, 0.32)";

                  return (
                    <div
                      key={r.id}
                      className={styles.card}
                      style={{
                        // ✅ bordo completo
                        border: `2px solid ${borderCol}`,
                        // mantiene l’effetto “nuova richiesta” senza rompere altro
                        outline: glowActive ? "3px solid rgba(245,158,11,0.55)" : "none",
                        boxShadow: glowActive
                          ? "0 0 0 6px rgba(245,158,11,0.10), 0 18px 55px rgba(0,0,0,0.18)"
                          : isRequest
                          ? "0 0 0 4px rgba(245,158,11,0.06)"
                          : undefined,
                        transform: glowActive ? "translateY(-1px)" : undefined,
                        transition: "outline 220ms ease, box-shadow 220ms ease, transform 220ms ease, border 220ms ease",
                      }}
                    >
                      <div className={styles.leftBar} />

                      <div className={styles.cardTop}>
                        <span
                          className={styles.nameBadge}
                          style={{
                            // ✅ oro più scuro (si legge meglio)
                            color: "rgba(145, 100, 0, 0.98)",
                            textShadow: "0 1px 0 rgba(255,255,255,0.55)",
                            fontWeight: 950,
                          }}
                        >
                          {nome} {glowActive ? "✨" : ""}
                        </span>

                        <span className={styles.rightStatus} style={statusPillStyle(st)}>
                          {st}
                        </span>
                      </div>

                      <div className={styles.grid}>
                        <div className={styles.box}>
                          <div className={styles.boxLabel}>TELEFONO</div>
                          <div className={styles.boxValue}>{tel || "—"}</div>
                        </div>

                        <div className={styles.box}>
                          <div className={styles.boxLabel}>SERVIZIO</div>
                          <div className={styles.boxValue}>{serv}</div>
                        </div>

                        <div className={styles.box}>
                          <div className={styles.boxLabel}>DATA</div>
                          <div className={styles.boxValue}>{dateIT}</div>
                        </div>

                        <div className={styles.box}>
                          <div className={styles.boxLabel}>ORA</div>
                          <div className={styles.boxValue}>{ora}</div>
                        </div>
                      </div>

                      {r.note ? (
                        <div className={styles.box} style={{ marginTop: 10 }}>
                          <div className={styles.boxLabel}>NOTE</div>
                          <div className={styles.boxValue} style={{ whiteSpace: "pre-wrap" }}>
                            {r.note}
                          </div>
                        </div>
                      ) : null}

                      <div className={styles.actions}>
                        <a
                          className={`${styles.miniBtn} ${styles.miniBlue}`}
                          href={callHref}
                          style={{ opacity: telOk ? 1 : 0.5, pointerEvents: telOk ? "auto" : "none" }}
                          title="Chiama"
                        >
                          📞 Chiama
                        </a>

                        <button
                          className={`${styles.miniBtn} ${styles.miniBlue}`}
                          onClick={() => openGenericWhatsApp(r)}
                          style={{ opacity: telOk ? 1 : 0.5, pointerEvents: telOk ? "auto" : "none" }}
                          title="Apri WhatsApp"
                        >
                          💬 WhatsApp
                        </button>

                        <button className={`${styles.miniBtn} ${styles.miniGreen}`} onClick={() => confirmWhatsApp(r)}>
                          ✅ Conferma
                        </button>

                        <button className={`${styles.miniBtn} ${styles.miniRed}`} onClick={() => cancelWhatsApp(r)}>
                          ❌ Annulla
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className={styles.footer}>GalaxBot AI • Pannello prenotazioni</div>
          </div>
        </div>
      </div>
    </div>
  );
}