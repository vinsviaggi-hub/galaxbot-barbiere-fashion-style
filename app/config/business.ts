// app/config/business.ts

export type FeatureFlags = {
  enableBookings?: boolean;
  enableOrders?: boolean;
  enableOpenAIChat?: boolean;
};

export type WhatsAppTemplates = {
  confirmBooking?: string; // usa {name} {date} {time} {service}
  cancelBooking?: string;  // usa {name} {date} {time} {service}
  genericHello?: string;   // usa {name}
};

export type BotTexts = {
  greeting?: string;
  bookingGuide?: string;
  cancelGuide?: string;
  fallback?: string;
};

export type PwaConfig = {
  name?: string;
  shortName?: string;
  description?: string;
  themeColor?: string; // es "#0b1220"
};

export type ThemeConfig = {
  primary?: string; // ORO (barber)
  danger?: string;  // ROSSO
  bg?: string;
};

export type BusinessConfig = {
  slug: string;

  // Hero (GIÀ USATI)
  badgeTop: string;
  headline: string;
  subheadline: string;

  // Info box (GIÀ USATI)
  servicesShort: string;
  city: string;
  phone: string;

  // ✅ Lista servizi (usata dal FastBookingForm)
  servicesList?: string[];

  // Extra contatti (OPZIONALI)
  address?: string;
  whatsappPhone?: string; // es "+393331234567"
  mapsUrl?: string;
  instagramUrl?: string;

  // CTA (OPZIONALI)
  ctaPrimaryLabel?: string;
  ctaSecondaryLabel?: string;
  ctaOrdersLabel?: string;

  // Orari (OPZIONALI - usati nella landing)
  hoursTitle?: string;
  hoursLines?: string[];

  // Pannello admin (OPZIONALI)
  adminPanelTitle?: string;
  adminPanelSubtitle?: string;
  adminPanelFooter?: string;

  // Testi bot/chat (OPZIONALI)
  bot?: BotTexts;

  // WhatsApp templates (OPZIONALI)
  whatsappTemplates?: WhatsAppTemplates;

  // PWA (OPZIONALE)
  pwa?: PwaConfig;

  // Feature flags (OPZIONALE)
  features?: FeatureFlags;

  // Tema (OPZIONALE)
  theme?: ThemeConfig;
};

const BUSINESS: BusinessConfig = {
  // ======= BASE (non rompe nulla) =======
  slug: "idee-per-la-testa",

  badgeTop: "GALAXBOT AI · BARBER SHOP",
  headline: "Idee per la Testa",
  subheadline:
    "Un assistente virtuale che gestisce richieste, prenotazioni e cancellazioni per il tuo barber shop, 24 ore su 24.",

  servicesShort: "Taglio, barba, sfumature, styling, bimbi",
  city: "Castelnuovo Vomano (TE)",
  phone: "333 123 4567",

  // ✅ Lista completa per il form (così non tocchi più FastBookingForm)
  servicesList: ["Taglio uomo", "Barba", "Taglio + barba", "Sfumatura", "Bimbo", "Styling"],

  // ======= EXTRA (puoi lasciarli vuoti) =======
  address: "",
  whatsappPhone: "", // es "+393331234567"
  mapsUrl: "",
  instagramUrl: "",

  ctaPrimaryLabel: "Prenota",
  ctaSecondaryLabel: "Contatta",
  ctaOrdersLabel: "Ordina",

  hoursTitle: "Orari di apertura",
  hoursLines: ["Lunedì–Sabato: 8:30–12:30 e 15:00–20:00", "Domenica: chiuso"],

  adminPanelTitle: "Prenotazioni",
  adminPanelSubtitle:
    "Pannello prenotazioni: vedi Nome, Telefono, Data, Ora, Servizio e aggiorni lo stato in un tap.",
  adminPanelFooter: "GalaxBot AI • Pannello prenotazioni",

  bot: {
    greeting:
      "Ciao! Sono l’assistente virtuale. Posso darti info su orari, prezzi, servizi e aiutarti a prenotare.",
    bookingGuide:
      "Per prenotare, dimmi: nome, servizio, giorno e orario preferito.",
    cancelGuide:
      "Per cancellare, dimmi nome e data/ora della prenotazione (se le conosci).",
    fallback:
      "Ok! Dimmi se ti serve: info, prenotazione o cancellazione.",
  },

  whatsappTemplates: {
    genericHello: "Ciao {name}!",
    confirmBooking:
      "Ciao {name}! ✅ Il tuo appuntamento è CONFERMATO per {date} alle {time} ({service}). A presto!",
    cancelBooking:
      "Ciao {name}. ❌ Il tuo appuntamento {service} del {date} alle {time} è ANNULLATO. Se vuoi riprenotare, scrivimi qui.",
  },

  pwa: {
    name: "Idee per la Testa",
    shortName: "Idee 💈",
    description: "Prenotazioni e info 24/7",
    themeColor: "#0b1220",
  },

  features: {
    enableBookings: true,
    enableOrders: false,
    enableOpenAIChat: true,
  },

  // ✅ TEMA BARBIERE: ORO + ROSSO
  theme: {
    primary: "#D4AF37", // ORO
    danger: "#EF4444",  // ROSSO
    bg: "#ffffff",
  },
};

export function getBusinessConfig(): BusinessConfig {
  return BUSINESS;
}