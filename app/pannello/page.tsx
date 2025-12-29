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

  // ✅ dati
  nome?: string;       // nome proprietario
  nomeCane?: string;   // nome cane
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
  if (!c) return `rgba(245,179,1,${a})`;
  return `rgba(${c.r},${c.g},${c.b},${a})`;
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

export default function PannelloAdmin() {
  const router = useRouter();

  const biz = useMemo(() => {
    try {
      return getBusinessConfig() as any;
    } catch {
      return {} as any;
    }
  }, []);

  const badgeTop = biz?.badgeTop ?? biz?.labelTop ?? "GALAXBOT AI • ADMIN";
  const head = biz?.headline ?? biz?.title ?? "";
  const panelTitle = head ? `Prenotazioni • ${head}` : "Prenotazioni";

  // ✅ colori richiesti
  const GOLD = "#F5B301";
  const RED = "#EF4444";
  const accent = GOLD;

  function nameBadgeStyle(): CSSProperties {
    return {
      display: "inline-flex",
      alignItems: "center",
      padding: "8px 12px",
      borderRadius: 999,
      border: "1px solid rgba(15,23,42,0.12)",
      background: "linear-gradient(135deg, rgba(15,23,42,0.05), rgba(15,23,42,0.02))",
      color: "rgba(15,23,42,0.92)",
      fontWeight: 1000,
      letterSpacing: 0.2,
      textTransform: "none",
      gap: 10,
    };
  }

  function accentForIndex(i: number) {
    const isGold = i % 2 === 0;
    const bar: CSSProperties = {
      position: "absolute",
      inset: "0 auto 0 0",
      width: 8,
      background: isGold
        ? `linear-gradient(180deg, ${rgba(GOLD, 0.85)}, ${rgba(GOLD, 0.18)})`
        : `linear-gradient(180deg, ${rgba(RED, 0.75)}, ${rgba(RED, 0.14)})`,
    };
    return { bar };
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
      boxShadow: "0 16px 40px rgba(0,0,0,0.14)",
      maxWidth: 860,
      width: "100%",
      textAlign: "center",
    };
  }

  function waLink(phone: string, text: string) {
    const p = safeTel(phone);
    const msg = encodeURIComponent(text);
    const t = Date.now();
    return `https://api.whatsapp.com/send?phone=${p}&text=${msg}&t=${t}`;
  }

  function buildConfirmMsg(r: AdminRow) {
    const nome = (r.nome || "").trim();
    const cane = (r.nomeCane || "").trim();
    const data = toITDate(r.dataISO);
    const ora = r.ora || "—";
    const serv = (r.servizio || "appuntamento").toString();
    return `Ciao${nome ? " " + nome : ""}! ✅ Confermato per ${data} alle ${ora} (${serv})${cane ? `. Per ${cane}` : ""}. A presto!`;
  }

  function buildCancelMsg(r: AdminRow) {
    const nome = (r.nome || "").trim();
    const cane = (r.nomeCane || "").trim();
    const data = toITDate(r.dataISO);
    const ora = r.ora || "—";
    const serv = (r.servizio || "appuntamento").toString();
    return `Ciao${nome ? " " + nome : ""}. ❌ Annullato (${serv}) del ${data} alle ${ora}${cane ? ` (per ${cane})` : ""}. Se vuoi riprenotare, scrivimi qui.`;
  }

  const [checking, setChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  const [rows, setRows] = useState<AdminRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [rowsError, setRowsError] = useState<string | null>(null);

  const [dayMode, setDayMode] = useState<"TUTTO" | "OGGI" | "DOMANI" | "7" | "DATA">("TUTTO");
  const [pickDate, setPickDate] = useState<string>(todayISO());

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

  // ✅ helper: prende valore anche da chiavi strane (tipo "nome cane")
  function pickAny(obj: any, keys: string[]) {
    for (const k of keys) {
      if (obj && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== "") return obj[k];
    }
    return "";
  }

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
        .map((r: any) => {
          const nome = pickAny(r, ["nome", "ownerName", "name", "nome proprietario"]);
          const nomeCane = pickAny(r, ["nomeCane", "dogName", "nome cane", "cane", "petName"]);
          const telefono = pickAny(r, ["telefono", "phone"]);
          const servizio = pickAny(r, ["servizio", "service"]);
          const dataISO = pickAny(r, ["dataISO", "dateISO", "date"]);
          const ora = pickAny(r, ["ora", "time"]);
          const note = pickAny(r, ["note", "notes"]);
          const canale = pickAny(r, ["canale", "channel"]);
          const stato = normStatus(pickAny(r, ["stato", "status"]));

          return {
            id: String(r?.id ?? ""),
            rowNumber: r?.rowNumber,
            timestamp: r?.timestamp,
            nome: String(nome || "").trim(),
            nomeCane: String(nomeCane || "").trim(),
            telefono: String(telefono || "").trim(),
            servizio: String(servizio || "").trim(),
            dataISO: String(dataISO || "").trim(),
            ora: String(ora || "").trim(),
            note: String(note || "").trim(),
            stato,
            canale: String(canale || "").trim(),
          };
        })
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
    const url = waLink(p, message);
    window.open(url, `wa_${Date.now()}`, "noopener,noreferrer");
  }

  const confirmWhatsApp = (r: AdminRow) => {
    openWhatsApp(r.telefono || "", buildConfirmMsg(r));
    void setStatus(r.id, "CONFERMATA");
  };

  const cancelWhatsApp = (r: AdminRow) => {
    openWhatsApp(r.telefono || "", buildCancelMsg(r));
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

  useEffect(() => {
    if (!checking && !loggedIn) router.replace("/pannello/login");
  }, [checking, loggedIn, router]);

  const styles: Record<string, CSSProperties> = {
    page: {
      minHeight: "100vh",
      padding: "18px 12px 34px",
      background:
        "radial-gradient(900px 520px at 12% 0%, rgba(245,179,1,0.10), transparent 62%)," +
        "radial-gradient(900px 520px at 88% 10%, rgba(0,0,0,0.05), transparent 62%)," +
        "radial-gradient(900px 520px at 50% 100%, rgba(148,163,184,0.10), transparent 60%)," +
        "linear-gradient(180deg, #fafbfc 0%, #ffffff 55%, #f5f7fb 100%)",
      color: "rgba(15,23,42,0.92)",
      fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
    },
    container: { maxWidth: 1120, margin: "0 auto" },

    header: {
      borderRadius: 18,
      border: "1px solid rgba(15,23,42,0.10)",
      background: "rgba(255,255,255,0.96)",
      boxShadow: "0 16px 40px rgba(0,0,0,0.08)",
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
      border: `1px solid ${rgba(accent, 0.26)}`,
      background: `${rgba(accent, 0.10)}`,
      fontSize: 12,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      fontWeight: 900,
    },
    h1: { margin: "6px 0 2px", fontSize: 28, fontWeight: 1000, letterSpacing: -0.4 },
    sub: { margin: 0, opacity: 0.85, fontSize: 14, lineHeight: 1.35 },

    chipsRow: { marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
    chip: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 10px",
      borderRadius: 999,
      border: "1px solid rgba(15,23,42,0.12)",
      background: "rgba(255,255,255,0.96)",
      fontWeight: 950,
      fontSize: 13,
    },

    btnRow: { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" },

    btnPrimary: {
      border: `1px solid ${rgba(accent, 0.30)}`,
      background: `linear-gradient(180deg, ${rgba(accent, 0.95)} 0%, ${rgba(accent, 0.78)} 100%)`,
      color: "rgba(15,23,42,0.92)",
      padding: "10px 12px",
      borderRadius: 12,
      cursor: "pointer",
      fontWeight: 1000,
      boxShadow: "0 10px 26px rgba(0,0,0,0.10)",
    },

    btnDanger: {
      border: `1px solid ${rgba(RED, 0.30)}`,
      background: `linear-gradient(180deg, ${rgba(RED, 0.85)} 0%, ${rgba(RED, 0.70)} 100%)`,
      color: "white",
      padding: "10px 12px",
      borderRadius: 12,
      cursor: "pointer",
      fontWeight: 1000,
      boxShadow: "0 10px 26px rgba(0,0,0,0.10)",
    },

    btn: {
      border: "1px solid rgba(15,23,42,0.14)",
      background: "rgba(255,255,255,0.96)",
      color: "rgba(15,23,42,0.92)",
      padding: "10px 12px",
      borderRadius: 12,
      cursor: "pointer",
      fontWeight: 950,
    },

    panel: {
      marginTop: 12,
      borderRadius: 18,
      border: "1px solid rgba(15,23,42,0.10)",
      background: "rgba(255,255,255,0.96)",
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
      background: `linear-gradient(90deg, rgba(15,23,42,0.03), ${rgba(accent, 0.12)})`,
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
      background: "rgba(255,255,255,0.96)",
      cursor: "pointer",
      fontWeight: 1000,
      fontSize: 12,
      userSelect: "none",
    },
    pillActive: {
      background: `linear-gradient(180deg, ${rgba(accent, 0.95)} 0%, ${rgba(accent, 0.72)} 100%)`,
      border: `1px solid ${rgba(accent, 0.28)}`,
      boxShadow: "0 10px 24px rgba(0,0,0,0.08)",
    },

    list: { display: "grid", gap: 14 },

    card: {
      borderRadius: 16,
      background: "rgba(255,255,255,0.99)",
      padding: 12,
      position: "relative",
      overflow: "hidden",
      border: "1px solid rgba(15,23,42,0.14)",
      boxShadow: "0 12px 28px rgba(0,0,0,0.08)",
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
      background: "rgba(255,255,255,0.96)",
      color: "rgba(15,23,42,0.92)",
      cursor: "pointer",
      fontWeight: 1000,
      fontSize: 12,
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      textDecoration: "none",
    },

    miniGold: { border: `1px solid ${rgba(accent, 0.30)}`, background: `${rgba(accent, 0.14)}` },
    miniGreen: { border: "1px solid rgba(34,197,94,0.26)", background: "rgba(34,197,94,0.10)" },
    miniRed: { border: "1px solid rgba(239,68,68,0.26)", background: "rgba(239,68,68,0.10)" },
    miniYellow: { border: "1px solid rgba(245,158,11,0.26)", background: "rgba(245,158,11,0.10)" },

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
                <h1 style={styles.h1}>{panelTitle}</h1>
                <p style={styles.sub}>
                  Pannello prenotazioni: vedi <b>Proprietario</b>, <b>Cane</b>, <b>Telefono</b>, <b>Data</b>, <b>Ora</b>, <b>Servizio</b>.
                </p>

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
            <div style={styles.panelTitle}>{loggedIn ? "Prenotazioni" : "Accesso"}</div>
            <div style={{ opacity: 0.85, fontSize: 12 }}>{loggedIn ? "Conferma/Annulla → apre WhatsApp con messaggio pronto" : ""}</div>
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
                          style={{ width: 170, padding: "12px 12px", borderRadius: 12, border: "1px solid rgba(15,23,42,0.14)" }}
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

                      const owner = (r.nome || "").trim();
                      const dog = (r.nomeCane || "").trim();

                      const tel = r.telefono || "";
                      const dateIT = toITDate(r.dataISO);
                      const ora = r.ora || "—";
                      const serv = (r.servizio || "—").toString();

                      const callHref = tel ? `tel:${safeTel(tel)}` : "#";
                      const waGeneric = tel ? waLink(tel, `Ciao${owner ? " " + owner : ""}!`) : "#";

                      const acc = accentForIndex(idx);

                      return (
                        <div key={r.id} style={styles.card}>
                          <div style={acc.bar} />

                          <div style={styles.cardTop}>
                            {/* ✅ niente più "Cliente" */}
                            <span style={nameBadgeStyle()}>
                              <span>
                                <span style={{ opacity: 0.75, fontWeight: 900, fontSize: 12 }}>Proprietario</span>
                                <div style={{ fontWeight: 1000 }}>{owner || "—"}</div>
                              </span>

                              <span style={{ width: 1, height: 28, background: "rgba(15,23,42,0.12)" }} />

                              <span>
                                <span style={{ opacity: 0.75, fontWeight: 900, fontSize: 12 }}>Cane</span>
                                <div style={{ fontWeight: 1000 }}>{dog || "—"}</div>
                              </span>
                            </span>

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
                                ...styles.miniGold,
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
                                ...styles.miniGold,
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

                <div style={styles.footer}>GalaxBot AI • Pannello prenotazioni</div>
              </>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @media (max-width: 760px) {
          .mm-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}