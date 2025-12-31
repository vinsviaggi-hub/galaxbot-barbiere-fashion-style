"use client";

import React, { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { getBusinessConfig } from "@/app/config/business";

type BookingStatus = "NUOVA" | "CONFERMATA" | "ANNULLATA" | string;

type AdminRow = {
  id: string;
  rowNumber?: number;
  timestamp?: string;

  nome?: string; // proprietario
  cane?: string; // nome cane
  telefono?: string;

  servizio?: string;
  dataISO?: string; // yyyy-mm-dd oppure dd/mm/yyyy
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

type RescheduleResponse =
  | { ok: true; message?: string; id?: string; oldId?: string; dateISO?: string; time?: string }
  | { ok: false; error?: string; details?: any; conflict?: boolean };

function normStatus(s?: string): BookingStatus {
  const up = (s || "").toUpperCase().trim();
  if (up === "CONFERMATA" || up === "ANNULLATA" || up === "NUOVA") return up;
  return up || "NUOVA";
}

function labelStatusForUI(st?: BookingStatus) {
  const s = normStatus(st);
  if (s === "NUOVA") return "RICHIESTA";
  return s;
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

function isIsoDate(s?: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s || "").trim());
}

function isHHMM(s?: string) {
  return /^\d{2}:\d{2}$/.test(String(s || "").trim());
}

function normalizeTimeInput(v?: string) {
  const s = String(v || "")
    .trim()
    .replace(".", ":")
    .replace(",", ":")
    .replace(/\s+/g, "");
  if (!s) return "";
  const m = s.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return "";
  const hh = String(parseInt(m[1], 10)).padStart(2, "0");
  const mm = String(parseInt(m[2], 10)).padStart(2, "0");
  const h = parseInt(hh, 10);
  const mi = parseInt(mm, 10);
  if (h < 0 || h > 23 || mi < 0 || mi > 59) return "";
  return `${hh}:${mm}`;
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
  if (!c) return `rgba(15,23,42,${a})`;
  return `rgba(${c.r},${c.g},${c.b},${a})`;
}

function statusPillStyle(st: BookingStatus): CSSProperties {
  const s = normStatus(st);
  if (s === "CONFERMATA") {
    return {
      background: "rgba(16,185,129,0.14)",
      border: "1px solid rgba(16,185,129,0.40)",
      color: "rgba(6,95,70,0.98)",
    };
  }
  if (s === "ANNULLATA") {
    return {
      background: "rgba(239,68,68,0.12)",
      border: "1px solid rgba(239,68,68,0.38)",
      color: "rgba(153,27,27,0.98)",
    };
  }
  return {
    background: "rgba(245,158,11,0.16)",
    border: "1px solid rgba(245,158,11,0.45)",
    color: "rgba(146,64,14,0.98)",
  };
}

function remapKey<T extends Record<string, any>>(obj: T, fromKey: string, toKey: string): T {
  if (!fromKey || !toKey || fromKey === toKey) return obj;
  if (!(fromKey in obj)) return obj;
  const next: any = { ...obj };
  next[toKey] = next[fromKey];
  delete next[fromKey];
  return next as T;
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
  const head = biz?.headline ?? biz?.title ?? "4 Zampe";
  const panelTitle = `Prenotazioni • ${head}`;
  const accent = biz?.panelTheme?.accent || "#0f172a";

  function toastStyle(type: "ok" | "err"): CSSProperties {
    return {
      pointerEvents: "none",
      padding: "10px 12px",
      borderRadius: 14,
      border: type === "ok" ? "1px solid rgba(16,185,129,0.45)" : "1px solid rgba(239,68,68,0.40)",
      background: type === "ok" ? "rgba(16,185,129,0.14)" : "rgba(239,68,68,0.14)",
      color: "rgba(15,23,42,0.95)",
      fontWeight: 950,
      boxShadow: "0 18px 50px rgba(0,0,0,0.18)",
      maxWidth: 920,
      width: "100%",
      textAlign: "center",
      backdropFilter: "blur(6px)",
    };
  }

  function waLink(phone: string, text: string) {
    const p = safeTel(phone);
    const msg = encodeURIComponent(text);
    return `https://api.whatsapp.com/send?phone=${p}&text=${msg}`;
  }

  function buildConfirmMsg(r: AdminRow) {
    const nome = (r.nome || "").trim();
    const cane = (r.cane || "").trim();
    const data = toITDate(r.dataISO);
    const ora = r.ora || "—";
    const serv = (r.servizio || "appuntamento").toString();
    return `Ciao${nome ? " " + nome : ""}! ✅ Confermato: ${serv} per ${cane ? cane + " — " : ""}${data} alle ${ora}. A presto!`;
  }

  function buildCancelMsg(r: AdminRow) {
    const nome = (r.nome || "").trim();
    const cane = (r.cane || "").trim();
    const data = toITDate(r.dataISO);
    const ora = r.ora || "—";
    const serv = (r.servizio || "appuntamento").toString();
    return `Ciao${nome ? " " + nome : ""}. ❌ Annullato: ${serv} ${cane ? "(" + cane + ") " : ""}del ${data} alle ${ora}. Se vuoi riprenotare, scrivimi qui.`;
  }

  function buildRescheduleMsg(r: AdminRow, newDateISO: string, newTime: string) {
    const nome = (r.nome || "").trim();
    const cane = (r.cane || "").trim();
    const serv = (r.servizio || "appuntamento").toString();

    const oldDate = toITDate(r.dataISO);
    const oldTime = r.ora || "—";
    const newDateIT = toITDate(newDateISO);

    return (
      `Ciao${nome ? " " + nome : ""}! 🔁 Per ${serv}${cane ? " (" + cane + ")" : ""} ti propongo questo spostamento:\n` +
      `• Prima: ${oldDate} alle ${oldTime}\n` +
      `• Nuovo: ${newDateIT} alle ${newTime}\n\n` +
      `Va bene? Rispondimi qui così confermo.`
    );
  }

  const [checking, setChecking] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);

  const [rows, setRows] = useState<AdminRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [rowsError, setRowsError] = useState<string | null>(null);

  const [dayMode, setDayMode] = useState<"TUTTO" | "OGGI" | "DOMANI" | "7" | "DATA">("OGGI");
  const [pickDate, setPickDate] = useState<string>(todayISO());
  const [statusFilter, setStatusFilter] = useState<"TUTTE" | "NUOVA" | "CONFERMATA" | "ANNULLATA">("TUTTE");

  const [toast, setToast] = useState<{ type: "ok" | "err"; msg: string } | null>(null);
  const showToast = (type: "ok" | "err", msg: string) => {
    setToast({ type, msg });
    window.setTimeout(() => setToast(null), 2400);
  };

  // --- SPOSITAMENTO ---
  const [moveOpen, setMoveOpen] = useState<Record<string, boolean>>({});
  const [moveDate, setMoveDate] = useState<Record<string, string>>({});
  const [moveTime, setMoveTime] = useState<Record<string, string>>({});
  const [moveLoading, setMoveLoading] = useState<Record<string, boolean>>({});

  // ✅ nuovi: orari disponibili per la data selezionata
  const [moveSlots, setMoveSlots] = useState<Record<string, string[]>>({});
  const [moveSlotsLoading, setMoveSlotsLoading] = useState<Record<string, boolean>>({});
  const [moveSlotsError, setMoveSlotsError] = useState<Record<string, string>>({});

  const loadMoveAvailability = async (rowId: string, dateISO: string) => {
    if (!rowId || !isIsoDate(dateISO)) return;

    setMoveSlotsLoading((p) => ({ ...p, [rowId]: true }));
    setMoveSlotsError((p) => ({ ...p, [rowId]: "" }));
    setMoveSlots((p) => ({ ...p, [rowId]: [] }));

    try {
      const res = await fetch(`/api/availability?date=${encodeURIComponent(dateISO)}`, { cache: "no-store" });
      const data: any = await safeJson(res);

      if (!data?.ok) {
        setMoveSlotsError((p) => ({ ...p, [rowId]: data?.error || "Errore disponibilità." }));
        return;
      }

      const slots = Array.isArray(data?.freeSlots) ? data.freeSlots.map((x: any) => String(x)).filter((x: string) => isHHMM(x)) : [];
      setMoveSlots((p) => ({ ...p, [rowId]: slots }));

      // se l’ora selezionata non è valida, metti la prima disponibile
      setMoveTime((p) => {
        const cur = String(p[rowId] ?? "").trim();
        const next = slots.length > 0 ? (slots.includes(cur) ? cur : slots[0]) : cur;
        return { ...p, [rowId]: next };
      });
    } catch {
      setMoveSlotsError((p) => ({ ...p, [rowId]: "Errore rete: impossibile caricare gli orari." }));
    } finally {
      setMoveSlotsLoading((p) => ({ ...p, [rowId]: false }));
    }
  };

  const toggleMove = (r: AdminRow) => {
    const isCurrentlyOpen = Boolean(moveOpen[r.id]);
    const willOpen = !isCurrentlyOpen;

    const initDate = moveDate[r.id] ?? (r.dataISO || todayISO());
    const initTime = moveTime[r.id] ?? (r.ora || "");

    setMoveOpen((p) => ({ ...p, [r.id]: !p[r.id] }));
    setMoveDate((p) => ({ ...p, [r.id]: p[r.id] ?? initDate }));
    setMoveTime((p) => ({ ...p, [r.id]: p[r.id] ?? initTime }));

    // ✅ quando apro “sposta”, carico subito gli orari liberi per la data selezionata
    if (willOpen) {
      void loadMoveAvailability(r.id, initDate);
    }
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

  const normalizeList = (data: any): AdminRow[] => {
    const list = Array.isArray(data?.rows) ? data.rows : [];
    return list
      .map((r: any) => ({
        id: String(r?.id ?? ""),
        rowNumber: r?.rowNumber,
        timestamp: r?.timestamp,
        nome: (r?.nome ?? r?.ownerName ?? r?.name ?? "").toString(),
        cane: (r?.cane ?? r?.dogName ?? r?.nomeCane ?? r?.nome_cane ?? "").toString(),
        telefono: r?.telefono ?? r?.phone,
        servizio: r?.servizio ?? r?.service,
        dataISO: r?.dataISO ?? r?.dateISO ?? r?.date,
        ora: r?.ora ?? r?.time,
        note: r?.note ?? r?.notes,
        stato: normStatus(r?.stato ?? r?.status),
        canale: r?.canale ?? r?.channel,
      }))
      .filter((x: AdminRow) => x.id);
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

      setRows(normalizeList(data));
    } catch {
      setRowsError("Errore rete nel caricamento prenotazioni.");
      setRows([]);
    } finally {
      setLoadingRows(false);
    }
  };

  const loadRowsSilent = async () => {
    try {
      const res = await fetch("/api/admin/bookings?limit=800", { credentials: "include" });
      const data: any = await safeJson(res);
      if (data?.ok) setRows(normalizeList(data));
    } catch {}
  };

  useEffect(() => {
    if (!loggedIn) return;
    const t = window.setInterval(() => {
      void loadRowsSilent();
    }, 60000);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  const logout = async () => {
    try {
      await fetch("/api/admin/logout", { method: "POST", credentials: "include" });
    } catch {}
    window.location.href = "/pannello/login";
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

  const getFreshRow = (id: string, fallback?: AdminRow) => {
    return rows.find((x) => x.id === id) ?? fallback ?? null;
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

      showToast("ok", `Stato aggiornato: ${labelStatusForUI(next)}`);
      await loadRows();
    } catch {
      showToast("err", "Errore rete: stato non aggiornato.");
      await loadRows();
    }
  };

  const confirmRequest = async (r: AdminRow) => {
    const fr = getFreshRow(r.id, r);
    if (!fr) {
      showToast("err", "Riga non trovata (ricarica il pannello).");
      return;
    }
    openWhatsApp(fr.telefono || "", buildConfirmMsg(fr));
    await setStatus(fr.id, "CONFERMATA");
  };

  const cancelRequest = async (r: AdminRow) => {
    const fr = getFreshRow(r.id, r);
    if (!fr) {
      showToast("err", "Riga non trovata (ricarica il pannello).");
      return;
    }
    openWhatsApp(fr.telefono || "", buildCancelMsg(fr));
    await setStatus(fr.id, "ANNULLATA");
  };

  const rescheduleRequest = async (r: AdminRow) => {
    const d = String(moveDate[r.id] ?? "").trim();
    const tRaw = String(moveTime[r.id] ?? "").trim();
    const t = normalizeTimeInput(tRaw);

    if (!isIsoDate(d)) {
      showToast("err", "Data nuova non valida (usa il selettore).");
      return;
    }
    if (!t) {
      showToast("err", "Ora nuova non valida. Scrivi HH:mm (es. 15:30).");
      return;
    }
    if (!r.telefono) {
      showToast("err", "Telefono mancante: non posso inviare WhatsApp.");
      return;
    }

    setMoveLoading((p) => ({ ...p, [r.id]: true }));

    try {
      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "admin_reschedule", id: r.id, dateISO: d, time: t }),
      });

      const data: RescheduleResponse = await safeJson(res);

      if (!(data as any)?.ok) {
        const conflict = Boolean((data as any)?.conflict);
        showToast("err", conflict ? "Orario già occupato: scegli un altro slot." : ((data as any)?.error || "Spostamento non riuscito."));
        return;
      }

      const oldId = r.id;
      const newId = String((data as any)?.id || oldId);
      const newDateISO = String((data as any)?.dateISO || d);
      const newTime = String((data as any)?.time || t);

      setRows((prev) =>
        prev.map((x) =>
          x.id === oldId
            ? {
                ...x,
                id: newId,
                dataISO: newDateISO,
                ora: newTime,
              }
            : x
        )
      );

      if (newId !== oldId) {
        setMoveOpen((p) => remapKey(p, oldId, newId));
        setMoveDate((p) => remapKey(p, oldId, newId));
        setMoveTime((p) => remapKey(p, oldId, newId));
        setMoveLoading((p) => remapKey(p, oldId, newId));

        setMoveSlots((p) => remapKey(p, oldId, newId));
        setMoveSlotsLoading((p) => remapKey(p, oldId, newId));
        setMoveSlotsError((p) => remapKey(p, oldId, newId));
      }

      showToast("ok", "Spostamento salvato. Ora preparo WhatsApp…");
      openWhatsApp(r.telefono || "", buildRescheduleMsg(r, newDateISO, newTime));
      setMoveOpen((p) => ({ ...p, [newId]: false }));

      await loadRows();
    } catch (e: any) {
      showToast("err", `Errore rete: ${String(e?.message || e)}`);
    } finally {
      setMoveLoading((p) => ({ ...p, [r.id]: false }));
    }
  };

  useEffect(() => {
    void checkMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loggedIn) void loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loggedIn]);

  useEffect(() => {
    if (!checking && !loggedIn) router.replace("/pannello/login");
  }, [checking, loggedIn, router]);

  const styles: Record<string, CSSProperties> = {
    page: {
      minHeight: "100vh",
      padding: "16px 12px 30px",
      background:
        "radial-gradient(1100px 640px at 18% 0%, rgba(15,23,42,0.08), transparent 60%)," +
        "radial-gradient(1000px 620px at 90% 10%, rgba(2,132,199,0.08), transparent 55%)," +
        "linear-gradient(180deg, #f8fafc 0%, #eef2f7 100%)",
      color: "rgba(15,23,42,0.92)",
      fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial",
    },
    container: { maxWidth: 1120, margin: "0 auto" },

    header: {
      borderRadius: 18,
      border: "1px solid rgba(0,0,0,0.30)",
      background: "linear-gradient(180deg, rgba(226,232,240,0.95), rgba(241,245,249,0.88))",
      boxShadow: "0 18px 50px rgba(0,0,0,0.10)",
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
      border: "1px solid rgba(0,0,0,0.35)",
      background: "rgba(15,23,42,0.08)",
      fontSize: 12,
      letterSpacing: 0.6,
      textTransform: "uppercase",
      fontWeight: 900,
      color: "rgba(15,23,42,0.92)",
    },

    h1: { margin: "6px 0 2px", fontSize: 28, fontWeight: 1000, letterSpacing: -0.4 },
    sub: { margin: 0, opacity: 0.75, fontSize: 14, lineHeight: 1.35 },

    chipsRow: { marginTop: 10, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" },
    chip: {
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 10px",
      borderRadius: 999,
      border: "1px solid rgba(15,23,42,0.12)",
      background: "rgba(255,255,255,0.72)",
      fontWeight: 950,
      fontSize: 13,
      color: "rgba(15,23,42,0.90)",
    },

    btnRow: { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "flex-end" },

    btn: {
      border: "1px solid rgba(15,23,42,0.14)",
      background: "rgba(255,255,255,0.80)",
      color: "rgba(15,23,42,0.92)",
      padding: "10px 12px",
      borderRadius: 14,
      cursor: "pointer",
      fontWeight: 950,
    },
    btnGold: {
      border: "1px solid rgba(245,158,11,0.45)",
      background: "linear-gradient(180deg, rgba(245,158,11,0.95), rgba(245,158,11,0.75))",
      color: "rgba(15,23,42,0.95)",
      padding: "10px 12px",
      borderRadius: 14,
      cursor: "pointer",
      fontWeight: 1000,
      boxShadow: "0 10px 26px rgba(245,158,11,0.18)",
    },
    btnRed: {
      border: "1px solid rgba(239,68,68,0.45)",
      background: "linear-gradient(180deg, rgba(239,68,68,0.92), rgba(239,68,68,0.72))",
      color: "rgba(255,255,255,0.98)",
      padding: "10px 12px",
      borderRadius: 14,
      cursor: "pointer",
      fontWeight: 1000,
      boxShadow: "0 10px 26px rgba(239,68,68,0.12)",
    },

    panel: {
      marginTop: 12,
      borderRadius: 18,
      border: "1px solid rgba(15,23,42,0.12)",
      background: "linear-gradient(180deg, rgba(255,255,255,0.92), rgba(255,255,255,0.86))",
      boxShadow: "0 18px 50px rgba(15,23,42,0.08)",
      overflow: "hidden",
    },
    panelHeader: {
      padding: "12px 14px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      borderBottom: "1px solid rgba(15,23,42,0.10)",
      background: `linear-gradient(90deg, rgba(255,255,255,0.60), ${rgba(accent, 0.06)})`,
      flexWrap: "wrap",
      color: "rgba(15,23,42,0.90)",
    },
    panelTitle: { fontWeight: 1000, letterSpacing: 0.2 },
    body: { padding: 14 },

    error: {
      marginTop: 10,
      padding: "10px 12px",
      borderRadius: 14,
      border: "1px solid rgba(239,68,68,0.40)",
      background: "rgba(239,68,68,0.12)",
      fontWeight: 950,
      fontSize: 13,
      color: "rgba(153,27,27,0.95)",
    },
    ok: {
      marginTop: 10,
      padding: "10px 12px",
      borderRadius: 14,
      border: "1px solid rgba(16,185,129,0.38)",
      background: "rgba(16,185,129,0.12)",
      fontWeight: 950,
      fontSize: 13,
      color: "rgba(6,95,70,0.95)",
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
      border: "1px solid rgba(15,23,42,0.14)",
      background: "rgba(255,255,255,0.72)",
      cursor: "pointer",
      fontWeight: 1000,
      fontSize: 12,
      userSelect: "none",
      color: "rgba(15,23,42,0.88)",
    },
    pillActive: {
      background: `linear-gradient(180deg, rgba(245,158,11,0.95), rgba(245,158,11,0.75))`,
      border: `1px solid rgba(245,158,11,0.50)`,
      color: "rgba(15,23,42,0.95)",
    },

    list: { display: "grid", gap: 14 },

    card: {
      borderRadius: 16,
      background: "linear-gradient(180deg, rgba(255,255,255,0.90), rgba(255,255,255,0.82))",
      padding: 12,
      position: "relative",
      overflow: "hidden",
      border: "2px solid rgba(0,0,0,0.55)",
      boxShadow: "0 14px 34px rgba(15,23,42,0.08)",
    },

    cardTop: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      flexWrap: "wrap",
      marginBottom: 10,
    },
    nameBadge: {
      display: "inline-flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 12px",
      borderRadius: 999,
      border: "1px solid rgba(15,23,42,0.12)",
      background: "rgba(255,255,255,0.70)",
      fontWeight: 1000,
      letterSpacing: 0.2,
      color: "rgba(15,23,42,0.92)",
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

    grid: { display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
    box: {
      borderRadius: 14,
      border: "1px solid rgba(15,23,42,0.12)",
      background: "rgba(255,255,255,0.70)",
      padding: "10px 10px",
    },
    boxLabel: { fontSize: 11, fontWeight: 1000, opacity: 0.70, letterSpacing: 0.6, color: "rgba(15,23,42,0.85)" },
    boxValue: { marginTop: 4, fontSize: 15, fontWeight: 1000, color: "rgba(15,23,42,0.95)" },

    actions: { display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10, alignItems: "center" },
    miniBtn: {
      padding: "10px 12px",
      borderRadius: 14,
      border: "1px solid rgba(15,23,42,0.14)",
      background: "rgba(255,255,255,0.75)",
      color: "rgba(15,23,42,0.92)",
      cursor: "pointer",
      fontWeight: 1000,
      fontSize: 13,
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      textDecoration: "none",
    },
    miniGold: {
      border: "1px solid rgba(245,158,11,0.45)",
      background: "linear-gradient(180deg, rgba(245,158,11,0.95), rgba(245,158,11,0.75))",
      color: "rgba(15,23,42,0.95)",
    },
    miniRed: {
      border: "1px solid rgba(239,68,68,0.45)",
      background: "linear-gradient(180deg, rgba(239,68,68,0.92), rgba(239,68,68,0.72))",
      color: "rgba(255,255,255,0.98)",
    },

    moveWrap: {
      marginTop: 10,
      borderRadius: 14,
      border: "1px solid rgba(15,23,42,0.12)",
      background: "rgba(255,255,255,0.72)",
      padding: 10,
    },
    moveTitle: { fontWeight: 1000, marginBottom: 8, opacity: 0.9, color: "rgba(15,23,42,0.92)" },
    moveGrid: { display: "grid", gap: 10, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" },
    input: {
      width: "100%",
      padding: "12px 12px",
      borderRadius: 14,
      border: "1px solid rgba(15,23,42,0.14)",
      background: "rgba(255,255,255,0.86)",
      color: "rgba(15,23,42,0.92)",
      fontWeight: 900,
      outline: "none",
    },

    footer: { marginTop: 14, opacity: 0.65, fontSize: 12, textAlign: "center", fontWeight: 900, color: "rgba(15,23,42,0.72)" },

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
                  Qui vedi <b>Nome proprietario</b>, <b>Nome cane</b>, <b>Telefono</b>, <b>Data</b>, <b>Ora</b>, <b>Servizio</b>.
                  Premi <b>Conferma richiesta</b>, <b>Annulla richiesta</b> oppure <b>Sposta appuntamento</b> (nuova data/ora) e invia su WhatsApp.
                </p>

                {loggedIn && (
                  <div style={styles.chipsRow}>
                    <div style={styles.chip}>🟡 Richieste: {counts.NUOVA}</div>
                    <div style={styles.chip}>✅ Confermate: {counts.CONFERMATA}</div>
                    <div style={styles.chip}>❌ Annullate: {counts.ANNULLATA}</div>
                  </div>
                )}
              </div>

              <div style={styles.btnRow}>
                {loggedIn ? (
                  <>
                    <button style={styles.btnGold} onClick={loadRows} disabled={loadingRows}>
                      {loadingRows ? "Aggiorno…" : "Aggiorna"}
                    </button>
                    <button style={styles.btnRed} onClick={logout}>
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
            <div style={{ opacity: 0.8, fontSize: 12 }}>{loggedIn ? "Azioni → apre WhatsApp col testo pronto" : ""}</div>
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
                          style={styles.input}
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
                          {s === "TUTTE" ? "Tutte" : s === "NUOVA" ? "RICHIESTA" : s}
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
                    {filtered.map((r) => {
                      const st = normStatus(r.stato);
                      const stLabel = labelStatusForUI(st);

                      const nome = (r.nome || "").trim() || "Senza nome";
                      const cane = (r.cane || "").trim() || "Senza nome cane";
                      const tel = r.telefono || "";
                      const dateIT = toITDate(r.dataISO);
                      const ora = r.ora || "—";
                      const serv = (r.servizio || "—").toString();

                      const callHref = tel ? `tel:${safeTel(tel)}` : "#";
                      const waGeneric = tel ? waLink(tel, `Ciao ${nome}!`) : "#";

                      const isOpen = Boolean(moveOpen[r.id]);
                      const nd = moveDate[r.id] ?? (r.dataISO || todayISO());
                      const nt = moveTime[r.id] ?? (r.ora || "");
                      const busy = Boolean(moveLoading[r.id]);

                      const slots = moveSlots[r.id] ?? [];
                      const slotsBusy = Boolean(moveSlotsLoading[r.id]);
                      const slotsErr = String(moveSlotsError[r.id] ?? "").trim();

                      return (
                        <div key={r.id} style={styles.card}>
                          <div style={styles.cardTop}>
                            <span style={styles.nameBadge}>
                              👤 {nome} <span style={{ opacity: 0.55 }}>•</span> 🐶 {cane}
                            </span>
                            <div style={{ ...styles.rightStatus, ...statusPillStyle(st) }}>{stLabel}</div>
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
                            <div style={{ ...styles.box, marginTop: 10 }}>
                              <div style={styles.boxLabel}>NOTE</div>
                              <div style={{ ...styles.boxValue, fontWeight: 900, whiteSpace: "pre-wrap" }}>{r.note}</div>
                            </div>
                          ) : null}

                          <div style={styles.actions}>
                            <a
                              style={{ ...styles.miniBtn, opacity: tel ? 1 : 0.5, pointerEvents: tel ? "auto" : "none" }}
                              href={callHref}
                              title="Chiama"
                            >
                              📞 Chiama
                            </a>

                            <a
                              style={{ ...styles.miniBtn, opacity: tel ? 1 : 0.5, pointerEvents: tel ? "auto" : "none" }}
                              href={waGeneric}
                              target="_blank"
                              rel="noreferrer"
                              title="Apri WhatsApp"
                            >
                              💬 WhatsApp
                            </a>

                            <button style={styles.miniBtn} onClick={() => toggleMove(r)}>
                              🔁 Sposta appuntamento
                            </button>

                            <button style={{ ...styles.miniBtn, ...styles.miniGold }} onClick={() => void confirmRequest(r)}>
                              ✅ Conferma richiesta
                            </button>

                            <button style={{ ...styles.miniBtn, ...styles.miniRed }} onClick={() => void cancelRequest(r)}>
                              ❌ Annulla richiesta
                            </button>
                          </div>

                          {isOpen && (
                            <div style={styles.moveWrap}>
                              <div style={styles.moveTitle}>🔁 Sposta appuntamento (nuova data/ora)</div>

                              <div className="mm-move-grid" style={styles.moveGrid}>
                                <div>
                                  <div style={{ ...styles.boxLabel, marginBottom: 6 }}>NUOVA DATA</div>
                                  <input
                                    style={styles.input}
                                    type="date"
                                    value={nd}
                                    onChange={(e) => {
                                      const v = e.target.value;
                                      setMoveDate((p) => ({ ...p, [r.id]: v }));
                                      // ✅ appena cambia la data, ricarico gli orari liberi per quella data
                                      void loadMoveAvailability(r.id, v);
                                    }}
                                  />
                                </div>

                                <div>
                                  <div style={{ ...styles.boxLabel, marginBottom: 6 }}>NUOVA ORA (scegli tra liberi)</div>

                                  {slotsBusy ? (
                                    <select style={styles.input as any} value={nt} disabled>
                                      <option>Carico orari…</option>
                                    </select>
                                  ) : slots.length > 0 ? (
                                    <select
                                      style={styles.input as any}
                                      value={nt}
                                      onChange={(e) => setMoveTime((p) => ({ ...p, [r.id]: e.target.value }))}
                                    >
                                      {slots.map((s) => (
                                        <option key={s} value={s}>
                                          {s}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    // fallback: se non arrivano slot (o errore), lasciamo comunque l’input manuale per non bloccare il pannello
                                    <input
                                      style={styles.input}
                                      type="text"
                                      inputMode="numeric"
                                      placeholder="Es. 15:30"
                                      value={nt}
                                      onChange={(e) => setMoveTime((p) => ({ ...p, [r.id]: e.target.value }))}
                                    />
                                  )}
                                </div>
                              </div>

                              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10, alignItems: "center" }}>
                                <button
                                  style={{ ...styles.miniBtn, opacity: slotsBusy ? 0.7 : 1 }}
                                  onClick={() => void loadMoveAvailability(r.id, String(moveDate[r.id] ?? nd))}
                                  disabled={slotsBusy}
                                  title="Ricarica orari"
                                >
                                  {slotsBusy ? "Carico…" : "🔎 Mostra orari liberi"}
                                </button>

                                {slotsErr ? (
                                  <div style={{ ...styles.error, marginTop: 0, padding: "8px 10px" }}>{slotsErr}</div>
                                ) : slots.length === 0 ? (
                                  <div style={{ ...styles.ok, marginTop: 0, padding: "8px 10px" }}>
                                    Nessun orario libero per questa data (puoi cambiare data).
                                  </div>
                                ) : (
                                  <div style={{ ...styles.ok, marginTop: 0, padding: "8px 10px" }}>
                                    Orari liberi trovati: <b>{slots.length}</b>
                                  </div>
                                )}
                              </div>

                              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                                <button
                                  style={{ ...styles.miniBtn, ...styles.miniGold, opacity: busy ? 0.7 : 1 }}
                                  onClick={() => void rescheduleRequest(r)}
                                  disabled={busy}
                                >
                                  {busy ? "Salvo…" : "💬 Invia proposta su WhatsApp"}
                                </button>

                                <button style={styles.miniBtn} onClick={() => setMoveOpen((p) => ({ ...p, [r.id]: false }))}>
                                  Chiudi
                                </button>
                              </div>
                            </div>
                          )}
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
          .mm-move-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 520px) {
          button, a { font-size: 16px !important; }
          input, select { font-size: 16px !important; }
        }
      `}</style>
    </div>
  );
}