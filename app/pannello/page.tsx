// app/pannello/page.tsx
"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { getBusinessConfig } from "@/app/config/business";

type BookingStatus = "NUOVA" | "CONFERMATA" | "ANNULLATA" | string;

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

function normStatus(s?: string): BookingStatus {
  const up = (s || "").toUpperCase().trim();
  if (up === "CONFERMATA" || up === "ANNULLATA" || up === "NUOVA") return up;
  return up || "NUOVA";
}

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

function statusPillStyle(st: BookingStatus): CSSProperties {
  const s = normStatus(st);
  if (s === "CONFERMATA") {
    return {
      background: "rgba(34,197,94,0.14)",
      border: "1px solid rgba(34,197,94,0.35)",
      color: "rgba(15,23,42,0.92)",
    };
  }
  if (s === "ANNULLATA") {
    return {
      background: "rgba(239,68,68,0.12)",
      border: "1px solid rgba(239,68,68,0.30)",
      color: "rgba(15,23,42,0.92)",
    };
  }
  return {
    background: "rgba(245,158,11,0.14)",
    border: "1px solid rgba(245,158,11,0.30)",
    color: "rgba(15,23,42,0.92)",
  };
}

function toastStyle(type: "ok" | "err"): CSSProperties {
  return {
    pointerEvents: "none",
    padding: "10px 12px",
    borderRadius: 14,
    border: type === "ok" ? "1px solid rgba(34,197,94,0.32)" : "1px solid rgba(239,68,68,0.30)",
    background: type === "ok" ? "rgba(34,197,94,0.14)" : "rgba(239,68,68,0.14)",
    color: "rgba(15,23,42,0.92)",
    fontWeight: 950,
    boxShadow: "0 16px 40px rgba(0,0,0,0.18)",
    maxWidth: 860,
    width: "100%",
    textAlign: "center",
  };
}

function waLink(phone: string, text: string) {
  const p = safeTel(phone);
  const msg = encodeURIComponent(text);
  return `https://wa.me/${p}?text=${msg}`;
}

function hexToRgb(hex?: string) {
  const h = String(hex || "").replace("#", "").trim();
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return { r, g, b };
}

function rgba(hex: string, a: number) {
  const c = hexToRgb(hex);
  if (!c) return `rgba(37,99,235,${a})`; // fallback blu
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

// ✅ nome vivace – color wow (tema)
function nameBadgeStyle(primary: string): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "8px 12px",
    borderRadius: 999,
    border: `1px solid ${rgba(primary, 0.35)}`,
    background: `linear-gradient(135deg, ${rgba(primary, 0.98)}, ${rgba(primary, 0.70)})`,
    color: "white",
    fontWeight: 1000,
    letterSpacing: 0.2,
    textTransform: "none",
    boxShadow: `0 14px 30px ${rgba(primary, 0.22)}`,
  };
}

// ✅ divisori alternati primary/danger (tema)
function accentForIndex(i: number, primary: string, danger: string) {
  const isPrimary = i % 2 === 0;
  const base = isPrimary ? primary : danger;

  const bar: CSSProperties = {
    position: "absolute",
    inset: "0 auto 0 0",
    width: 8,
    background: `linear-gradient(180deg, ${rgba(base, 0.90)}, ${rgba(base, 0.18)})`,
  };

  const borderGlow: CSSProperties = {
    border: `1px solid ${rgba(base, 0.22)}`,
    boxShadow: `0 12px 30px ${rgba(base, 0.10)}`,
  };

  return { bar, borderGlow };
}

function applyTemplate(tpl: string, r: AdminRow) {
  const map: Record<string, string> = {
    name: (r.nome || "").trim() || "Cliente",
    date: toITDate(r.dataISO),
    time: r.ora || "—",
    service: (r.servizio || "appuntamento").toString(),
  };

  return String(tpl || "")
    .replace(/\{(\w+)\}/g, (_, k) => (map[k] !== undefined ? map[k] : `{${k}}`))
    .trim();
}

export default function PannelloAdmin() {
  const router = useRouter();
  const biz = getBusinessConfig();

  const themePrimary = biz?.theme?.primary || "#2563eb";
  const themeDanger = biz?.theme?.danger || "#ef4444";

  const badgeTop = biz?.badgeTop || "GALAXBOT AI";
  const headline = biz?.headline || "Pannello";
  const adminTitle = biz?.adminPanelTitle || "Prenotazioni";
  const adminSubtitle =
    biz?.adminPanelSubtitle ||
    "Pannello prenotazioni: vedi Nome, Telefono, Data, Ora, Servizio e aggiorni lo stato in un tap.";
  const adminFooter = biz?.adminPanelFooter || `${badgeTop} • Pannello`;

  const DEFAULT_CONFIRM =
    "Ciao {name}! ✅ Il tuo appuntamento è CONFERMATO per {date} alle {time} ({service}). A presto!";
  const DEFAULT_CANCEL =
    "Ciao {name}. ❌ Il tuo appuntamento {service} del {date} alle {time} è ANNULLATO. Se vuoi riprenotare, scrivimi qui.";
  const DEFAULT_HELLO = "Ciao {name}!";

  const tplConfirm = biz?.whatsappTemplates?.confirmBooking || DEFAULT_CONFIRM;
  const tplCancel = biz?.whatsappTemplates?.cancelBooking || DEFAULT_CANCEL;
  const tplHello = biz?.whatsappTemplates?.genericHello || DEFAULT_HELLO;

  const [checking, setChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  const [rows, setRows] = useState<AdminRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [rowsError, setRowsError] = useState<string | null>(null);

  // ✅ filtri giorni
  const [dayMode, setDayMode] = useState<"TUTTO" | "OGGI" | "DOMANI" | "7" | "DATA">("TUTTO");
  const [pickDate, setPickDate] = useState<string>(todayISO());

  // ✅ filtro stato messo in un posto pulito (sotto ai giorni)
  const [statusFilter, setStatusFilter] = useState<"TUTTE" | "NUOVA" | "CONFERMATA" | "ANNULLATA">("TUTTE");

  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const showToast = (type: "ok" | "err", msg: string) => {
    setToast({ type, msg });
    window.setTimeout(() => setToast(null), 2400);
  };

  const counts = useMemo(() => {
    const c = { NUOVA: 0, CONFERMATA: 0, ANNULLATA: 0 };
    rows.forEach((r) => {
      const s = normStatus(r.stato);
      if (s === "NUOVA") c.NUOVA++;
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

  const loadRows = async () => {
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

      setRows(normalized);
    } catch {
      setRowsError("Errore rete nel caricamento prenotazioni.");
      setRows([]);
    } finally {
      setLoadingRows(false);
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    } catch {}
    window.location.href = "/pannello/login";
  };

  const setStatus = async (id: string, status: BookingStatus) => {
    const next = normStatus(status);

    // UI ottimista
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, stato: next } : r)));

    try {
      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: next }),
      });

      const data: UpdateResponse = await safeJson(res);
      if (!(data as any)?.ok) {
        showToast("err", (data as any)?.error || "Aggiornamento stato fallito.");
        await loadRows();
        return;
      }

      showToast("ok", `Stato aggiornato: ${next}`);
      await loadRows();
    } catch {
      showToast("err", "Errore rete: stato non aggiornato.");
      await loadRows();
    }
  };

  function openWhatsApp(phone: string, message: string) {
    const p = safeTel(phone);
    if (!p) {
      showToast("err", "Telefono mancante: non posso aprire WhatsApp.");
      return;
    }
    window.open(waLink(p, message), "_blank", "noopener,noreferrer");
  }

  const confirmWhatsApp = (r: AdminRow) => {
    openWhatsApp(r.telefono || "", applyTemplate(tplConfirm, r));
    void setStatus(r.id, "CONFERMATA");
  };

  const cancelWhatsApp = (r: AdminRow) => {
    openWhatsApp(r.telefono || "", applyTemplate(tplCancel, r));
    void setStatus(r.id, "ANNULLATA");
  };

  useEffect(() => {
    checkMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loggedIn) loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  // ✅ se NON sei loggato -> rimanda al login nuovo
  useEffect(() => {
    if (!checking && !loggedIn) {
      router.replace("/pannello/login");
    }
  }, [checking, loggedIn, router]);

  const styles: Record<string, CSSProperties> = {
    page: {
      minHeight: "100vh",
      padding: "18px 12px 34px",
      background:
        `radial-gradient(900px 520px at 12% 0%, ${rgba(themePrimary, 0.14)}, transparent 62%),` +
        `radial-gradient(900px 520px at 88% 8%, ${rgba(themeDanger, 0.10)}, transparent 62%),` +
        "radial-gradient(900px 520px at 50% 100%, rgba(148,163,184,0.12), transparent 60%)," +
        "linear-gradient(180deg, #f5f6f8 0%, #ffffff 56%, #f3f4f6 100%)",
      color: "rgba(15,23,42,0.92)",
      fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
    },
    container: { maxWidth: 1120, margin: "0 auto" },

    header: {
      borderRadius: 18,
      border: "1px solid rgba(15,23,42,0.10)",
      background:
        `linear-gradient(135deg, rgba(255,255,255,0.92), rgba(255,255,255,0.82)),` +
        `radial-gradient(700px 240px at 30% 0%, ${rgba(themePrimary, 0.16)}, transparent 60%),` +
        `radial-gradient(700px 240px at 85% 20%, ${rgba(themeDanger, 0.10)}, transparent 62%)`,
      boxShadow: `0 18px 46px rgba(0,0,0,0.08), 0 10px 30px ${rgba(themePrimary, 0.06)}`,
      overflow: "hidden",
    },
    headerInner: { padding: "14px 14px 12px" },

    topRow: {
      display: "flex",
      gap: 12,
      alignItems: "flex-start",
      justifyContent: "space-between",
      flexWrap: "wrap",
    },
    badge: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "7px 10px",
      borderRadius: 999,
      border: `1px solid ${rgba(themePrimary, 0.18)}`,
      background: `linear-gradient(90deg, ${rgba(themePrimary, 0.12)}, rgba(15,23,42,0.03))`,
      fontSize: 12,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      fontWeight: 900,
    },
    h1: { margin: "6px 0 2px", fontSize: 28, fontWeight: 1000, letterSpacing: -0.4 },
    sub: { margin: 0, opacity: 0.86, fontSize: 14, lineHeight: 1.35 },

    chipsRow: { marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
    chip: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 10px",
      borderRadius: 999,
      border: "1px solid rgba(15,23,42,0.12)",
      background: "rgba(255,255,255,0.88)",
      fontWeight: 950,
      fontSize: 13,
    },

    btnRow: { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" },
    btn: {
      border: "1px solid rgba(15,23,42,0.14)",
      background: "rgba(255,255,255,0.92)",
      color: "rgba(15,23,42,0.92)",
      padding: "10px 12px",
      borderRadius: 12,
      cursor: "pointer",
      fontWeight: 950,
    },
    btnPrimary: {
      border: `1px solid ${rgba(themePrimary, 0.26)}`,
      background: `linear-gradient(90deg, ${rgba(themePrimary, 0.22)}, ${rgba(themePrimary, 0.08)})`,
      color: "rgba(15,23,42,0.92)",
      padding: "10px 12px",
      borderRadius: 12,
      cursor: "pointer",
      fontWeight: 1000,
      boxShadow: `0 10px 22px ${rgba(themePrimary, 0.10)}`,
    },
    btnDanger: {
      border: `1px solid ${rgba(themeDanger, 0.26)}`,
      background: `${rgba(themeDanger, 0.08)}`,
      color: "rgba(15,23,42,0.92)",
      padding: "10px 12px",
      borderRadius: 12,
      cursor: "pointer",
      fontWeight: 1000,
    },

    panel: {
      marginTop: 12,
      borderRadius: 18,
      border: "1px solid rgba(15,23,42,0.10)",
      background: "rgba(255,255,255,0.90)",
      boxShadow: "0 16px 40px rgba(0,0,0,0.08)",
      overflow: "hidden",
    },
    panelHeader: {
      padding: "12px 14px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      borderBottom: "1px solid rgba(15,23,42,0.08)",
      background: `linear-gradient(90deg, rgba(15,23,42,0.03), ${rgba(themePrimary, 0.08)})`,
      flexWrap: "wrap",
    },
    panelTitle: { fontWeight: 1000, letterSpacing: 0.2 },
    body: { padding: 14 },

    error: {
      marginTop: 10,
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid rgba(239,68,68,0.26)",
      background: "rgba(239,68,68,0.10)",
      color: "rgba(15,23,42,0.92)",
      fontWeight: 950,
      fontSize: 13,
    },
    ok: {
      marginTop: 10,
      padding: "10px 12px",
      borderRadius: 12,
      border: "1px solid rgba(34,197,94,0.24)",
      background: "rgba(34,197,94,0.10)",
      color: "rgba(15,23,42,0.92)",
      fontWeight: 950,
      fontSize: 13,
    },

    tools: {
      display: "flex",
      gap: 10,
      flexWrap: "wrap",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 12,
    },

    pillRow: { display: "flex", gap: 8, flexWrap: "wrap" },
    pill: {
      padding: "9px 10px",
      borderRadius: 999,
      border: "1px solid rgba(15,23,42,0.12)",
      background: "rgba(255,255,255,0.92)",
      cursor: "pointer",
      fontWeight: 1000,
      fontSize: 12,
      userSelect: "none",
    },
    pillActive: {
      background: `linear-gradient(90deg, ${rgba(themePrimary, 0.18)}, ${rgba(themePrimary, 0.08)})`,
      border: `1px solid ${rgba(themePrimary, 0.24)}`,
    },

    list: { display: "grid", gap: 12 },

    card: {
      borderRadius: 16,
      background: "rgba(255,255,255,0.95)",
      padding: 12,
      position: "relative",
      overflow: "hidden",
    },

    cardTop: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      flexWrap: "wrap",
      marginBottom: 10,
      paddingLeft: 10,
    },
    rightStatus: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "7px 10px",
      borderRadius: 999,
      fontWeight: 1000,
      fontSize: 12,
    },

    grid: {
      display: "grid",
      gap: 10,
      gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
      paddingLeft: 10,
    },
    box: {
      borderRadius: 14,
      border: "1px solid rgba(15,23,42,0.10)",
      background: "rgba(15,23,42,0.02)",
      padding: "10px 10px",
    },
    boxLabel: { fontSize: 11, fontWeight: 1000, opacity: 0.7, letterSpacing: 0.6 },
    boxValue: { marginTop: 4, fontSize: 15, fontWeight: 1000 },

    actions: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap",
      marginTop: 10,
      paddingLeft: 10,
      alignItems: "center",
    },
    miniBtn: {
      padding: "9px 10px",
      borderRadius: 12,
      border: "1px solid rgba(15,23,42,0.12)",
      background: "rgba(255,255,255,0.95)",
      color: "rgba(15,23,42,0.92)",
      cursor: "pointer",
      fontWeight: 1000,
      fontSize: 12,
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      textDecoration: "none",
    },
    miniGreen: { border: "1px solid rgba(34,197,94,0.26)", background: "rgba(34,197,94,0.10)" },
    miniRed: { border: "1px solid rgba(239,68,68,0.26)", background: "rgba(239,68,68,0.10)" },
    miniYellow: { border: "1px solid rgba(245,158,11,0.26)", background: "rgba(245,158,11,0.10)" },
    miniBlue: { border: `1px solid ${rgba(themePrimary, 0.22)}`, background: `${rgba(themePrimary, 0.08)}` },

    footer: { marginTop: 14, opacity: 0.7, fontSize: 12, textAlign: "center" },

    toastWrap: {
      position: "fixed",
      top: 16,
      left: 0,
      right: 0,
      display: "flex",
      justifyContent: "center",
      pointerEvents: "none",
      zIndex: 60,
      padding: "0 10px",
    },
  };

  return (
    <div style={styles.page}>
      {toast && (
        <div style={styles.toastWrap}>
          <div style={toastStyle(toast.type)}>{toast.msg}</div>
        </div>
      )}

      <div style={styles.container}>
        <div style={styles.header}>
          <div style={styles.headerInner}>
            <div style={styles.topRow}>
              <div>
                <div style={styles.badge}>{badgeTop}</div>
                <h1 style={styles.h1}>{headline}</h1>
                <p style={styles.sub}>{adminSubtitle}</p>

                {loggedIn && (
                  <div style={styles.chipsRow}>
                    <div style={styles.chip}>🟡 Nuove: {counts.NUOVA}</div>
                    <div style={styles.chip}>✅ Confermate: {counts.CONFERMATA}</div>
                    <div style={styles.chip}>❌ Annullate: {counts.ANNULLATA}</div>
                  </div>
                )}
              </div>

              <div style={styles.btnRow}>
                {loggedIn ? (
                  <>
                    <button style={styles.btnPrimary} onClick={loadRows} disabled={loadingRows}>
                      {loadingRows ? "Aggiorno…" : "Aggiorna"}
                    </button>
                    <button style={styles.btnDanger} onClick={logout}>
                      Esci
                    </button>
                  </>
                ) : (
                  <span style={{ opacity: 0.8, fontSize: 12 }}>Accesso richiesto</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <div style={styles.panelTitle}>{loggedIn ? adminTitle : "Accesso"}</div>
            <div style={{ opacity: 0.85, fontSize: 12 }}>
              {loggedIn ? "Conferma/Annulla → apre WhatsApp con messaggio pronto" : ""}
            </div>
          </div>

          <div style={styles.body}>
            {checking ? (
              <div style={{ opacity: 0.8 }}>Controllo sessione…</div>
            ) : !loggedIn ? (
              <div style={{ opacity: 0.8 }}>
                Reindirizzo al login…
                <button style={{ ...styles.btn, marginLeft: 10 }} onClick={() => router.replace("/pannello/login")}>
                  Vai al login
                </button>
              </div>
            ) : (
              <>
                <div style={styles.tools}>
                  <div style={{ display: "grid", gap: 8 }}>
                    <div style={styles.pillRow}>
                      {[
                        { k: "TUTTO", label: "Tutto" },
                        { k: "OGGI", label: "Oggi" },
                        { k: "DOMANI", label: "Domani" },
                        { k: "7", label: "7 giorni" },
                        { k: "DATA", label: "Data" },
                      ].map((x) => (
                        <div
                          key={x.k}
                          style={{ ...styles.pill, ...(dayMode === (x.k as any) ? styles.pillActive : {}) }}
                          onClick={() => setDayMode(x.k as any)}
                          role="button"
                        >
                          {x.label}
                        </div>
                      ))}

                      {dayMode === "DATA" && (
                        <input
                          style={{
                            width: 170,
                            padding: "12px 12px",
                            borderRadius: 12,
                            border: "1px solid rgba(15,23,42,0.14)",
                          }}
                          type="date"
                          value={pickDate}
                          onChange={(e) => setPickDate(e.target.value)}
                          aria-label="Scegli data"
                        />
                      )}
                    </div>

                    <div style={styles.pillRow}>
                      {(["TUTTE", "NUOVA", "CONFERMATA", "ANNULLATA"] as const).map((s) => (
                        <div
                          key={s}
                          style={{ ...styles.pill, ...(statusFilter === s ? styles.pillActive : {}) }}
                          onClick={() => setStatusFilter(s)}
                          role="button"
                        >
                          {s === "TUTTE" ? "Tutte" : s}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {rowsError && <div style={styles.error}>{rowsError}</div>}
                {!rowsError && loadingRows && <div style={{ opacity: 0.8 }}>Carico prenotazioni…</div>}

                {!loadingRows && !rowsError && filtered.length === 0 ? (
                  <div style={styles.ok}>Nessuna prenotazione da mostrare.</div>
                ) : (
                  <div style={styles.list}>
                    {filtered.map((r, idx) => {
                      const st = normStatus(r.stato);
                      const nome = (r.nome || "Cliente").toString();
                      const tel = r.telefono || "";
                      const dateIT = toITDate(r.dataISO);
                      const ora = r.ora || "—";
                      const serv = (r.servizio || "—").toString();

                      const callHref = tel ? `tel:${safeTel(tel)}` : "#";
                      const waGeneric = tel ? waLink(tel, applyTemplate(tplHello, r)) : "#";

                      const accent = accentForIndex(idx, themePrimary, themeDanger);

                      return (
                        <div key={r.id} style={{ ...styles.card, ...accent.borderGlow }}>
                          <div style={accent.bar} />

                          <div style={styles.cardTop}>
                            <span style={nameBadgeStyle(themePrimary)}>{nome}</span>
                            <div style={{ ...styles.rightStatus, ...statusPillStyle(st) }}>{st}</div>
                          </div>

                          <div className="mm-grid" style={styles.grid}>
                            <div style={styles.box}>
                              <div style={styles.boxLabel}>TELEFONO</div>
                              <div style={styles.boxValue}>{tel || "—"}</div>
                            </div>

                            <div style={styles.box}>
                              <div style={styles.boxLabel}>SERVIZIO</div>
                              <div style={styles.boxValue}>{serv}</div>
                            </div>

                            <div style={styles.box}>
                              <div style={styles.boxLabel}>DATA</div>
                              <div style={styles.boxValue}>{dateIT}</div>
                            </div>

                            <div style={styles.box}>
                              <div style={styles.boxLabel}>ORA</div>
                              <div style={styles.boxValue}>{ora}</div>
                            </div>
                          </div>

                          {r.note ? (
                            <div style={{ ...styles.box, marginTop: 10, marginLeft: 10 }}>
                              <div style={styles.boxLabel}>NOTE</div>
                              <div style={{ ...styles.boxValue, fontWeight: 900, whiteSpace: "pre-wrap" }}>{r.note}</div>
                            </div>
                          ) : null}

                          <div style={styles.actions}>
                            <a
                              style={{
                                ...styles.miniBtn,
                                ...styles.miniBlue,
                                opacity: tel ? 1 : 0.5,
                                pointerEvents: tel ? "auto" : "none",
                              }}
                              href={callHref}
                              title="Chiama"
                            >
                              📞 Chiama
                            </a>

                            <a
                              style={{
                                ...styles.miniBtn,
                                ...styles.miniBlue,
                                opacity: tel ? 1 : 0.5,
                                pointerEvents: tel ? "auto" : "none",
                              }}
                              href={waGeneric}
                              target="_blank"
                              rel="noreferrer"
                              title="Apri WhatsApp"
                            >
                              💬 WhatsApp
                            </a>

                            <button style={{ ...styles.miniBtn, ...styles.miniYellow }} onClick={() => setStatus(r.id, "NUOVA")}>
                              🟡 Nuova
                            </button>

                            <button style={{ ...styles.miniBtn, ...styles.miniGreen }} onClick={() => confirmWhatsApp(r)}>
                              ✅ Conferma (WhatsApp)
                            </button>

                            <button style={{ ...styles.miniBtn, ...styles.miniRed }} onClick={() => cancelWhatsApp(r)}>
                              ❌ Annulla (WhatsApp)
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <div style={styles.footer}>{adminFooter}</div>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 760px) {
          .mm-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}