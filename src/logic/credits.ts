// src/logic/credits.ts

export type CreditLink = { label: string; url: string };

export type CreditItem = {
  title: string;
  license: string;
  attribution: string;
  notes?: string;
  links?: CreditLink[];
};

export type CreditSection = {
  title: string;
  items: CreditItem[];
};

/**
 * Credits & Lizenzen
 * - Für Release: Lizenztexte/Quellen noch einmal final gegen Originalseiten verifizieren.
 * - Keine Hotlinks auf Bilddateien; stattdessen Asset-Pipeline + Credits.
 */
export const CREDITS_SECTIONS: CreditSection[] = [
  {
    title: "Educational Disclaimer",
    items: [
      {
        title: "Hinweis",
        license: "—",
        attribution:
          "VivaMed ist ein Lern- und Trainingsprodukt. Es ersetzt keine medizinische Beratung, Diagnostik oder Therapie und ist nicht für den klinischen Einsatz gedacht.",
        notes:
          "Empfehlung: später zusätzlich als „Medical Disclaimer“ in Settings anzeigen (z.B. beim ersten Start & in den App-Infos).",
      },
    ],
  },

  {
    title: "Datasets (EKG / Röntgen)",
    items: [
      {
        title: "PTB-XL (PhysioNet)",
        license: "CC BY 4.0",
        attribution:
          "PTB-XL ECG Dataset (PhysioNet). Nutzung unter CC BY 4.0. Änderungen/Adaptionen: Auswahl eines Subsets, ggf. Normalisierung/Format-Konvertierung.",
        notes:
          "Pflicht: Attribution + Lizenzlink + Änderungen nennen (z.B. „subset/labels normalized“). Vor Release konkrete Änderungen präzisieren.",
        links: [
          { label: "Dataset (PhysioNet)", url: "https://physionet.org/content/ptb-xl/1.0.3/" },
          { label: "Lizenz (CC BY 4.0)", url: "https://physionet.org/content/ptb-xl/1.0.3/view-license/1.0.3/" },
        ],
      },
      {
        title: "NIH ChestX-ray (ChestX-ray8/14, NIH Clinical Center)",
        license: "Public dataset (Terms prüfen)",
        attribution:
          "NIH Clinical Center Chest X-ray Dataset (häufig zitiert als ChestX-ray8/14). Bitte NIH als Quelle nennen und das zugehörige Paper zitieren. Änderungen/Adaptionen: Auswahl/Labeling/Format-Konvertierung (falls zutreffend).",
        notes:
          "Wichtig: Nutzungsbedingungen/Restrictions bitte vor Release final auf der offiziellen NIH-Download-Seite (Box/NIHCC) verifizieren.",
        links: [
          {
            label: "NIH Bulletin (öffentlich verfügbar)",
            url: "https://content.govdelivery.com/accounts/USNIH/bulletins/189430d",
          },
          { label: "Paper (Wang et al., CVPR 2017)", url: "https://openaccess.thecvf.com/content_cvpr_2017/html/Wang_ChestX-ray8_Hospital-Scale_Chest_CVPR_2017_paper.html" },
        ],
      },
    ],
  },

  {
    title: "Illustrationen",
    items: [
      {
        title: "Servier Medical Art",
        license: "CC BY 4.0",
        attribution:
          "Illustrationen: Servier Medical Art. Nutzung unter CC BY 4.0. Keine Darstellung, die den Eindruck erweckt, Servier endorse das Produkt.",
        notes:
          "Pflicht: Attribution + Lizenzlink. Bei Bearbeitung: „changes made“ sinngemäß angeben.",
        links: [
          { label: "Servier Medical Art", url: "https://smart.servier.com/" },
          { label: "Lizenz (CC BY 4.0)", url: "https://creativecommons.org/licenses/by/4.0/" },
        ],
      },
    ],
  },

  {
    title: "App & Open-Source",
    items: [
      {
        title: "React Native / Expo / Libraries",
        license: "Je nach Paket (siehe package.json / LICENSE)",
        attribution:
          "Diese App nutzt Open-Source-Software. Die jeweiligen Lizenztexte findest du in den Repositorys der verwendeten Pakete.",
        notes:
          "Für Store-Release später: automatisierte Lizenzliste (z.B. script / tool) generieren und hier ergänzen.",
      },
    ],
  },
];
