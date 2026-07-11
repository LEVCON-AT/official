# Levcon.ai — KI-Beratung aus Wien

> **Eine Website, die zeigt, was mit KI möglich ist — gebaut mit KI.**

Diese Website ist ein reales Beispiel dafür, wie künstliche Intelligenz nicht nur das Thema der Beratung ist, sondern auch das Werkzeug, mit dem sie entsteht. Jede Zeile Code in diesem Repository wurde mit Unterstützung von KI erstellt — von der Architektur über das Frontend bis zur Automatisierung des täglichen Newsletter-Versands.

---

## Die KI-Story: Wie diese Website entstand

Dieses Projekt ist nicht das Werk eines einzigen KI-Modells. Es ist das Ergebnis einer **multilateralen KI-Zusammenarbeit**, bei der verschiedene Modelle unterschiedliche Stärken eingebracht haben — orchestriert von einem Menschen, der die Richtung vorgegeben hat.

### Phase 1: Konzept & Design-Sparring

**Modell:** Claude Sonnet 4.6

Die anfängliche Design-Sprache und Architektur wurden in einem iterativen Sparring-Prozess erarbeitet. Der Prototyp wurde als ausführliche Markdown-Dateien exportiert — mit Design-Tokens, Komponenten-Struktur und User-Flow-Dokumentation. Diese Markdown-Files dienten als Bauplan für alles, was folgte.

### Phase 2: Technische Analyse

**Modell:** Google Gemini 3.1

Die Entscheidung, ein lokales LLM auf einem kleinen VPS einzusetzen, war nicht trivial. Welche Modelle laufen auf 3,8 GB RAM? Wie hält man DSGVO-Konformität ohne Cloud-APIs? Diese technische Machbarkeitsanalyse — Vergleich von Ollama-Modellen, RAM-Berechnungen, VPS-Kapazitätsplanung — kam von Gemini.

### Phase 3: Umsetzung & Deployment

**Modell:** GLM 5.2 (via Z.ai Code, mit SSH-Desktop-Client)

Die eigentliche Code-Generierung — Next.js-Komponenten, API-Routes, Prisma-Schema, n8n-Workflows, nginx-Konfiguration, systemd-Service, GitHub Actions — wurde von GLM geschrieben. Mit direktem SSH-Zugriff auf den VPS wurden Konfiguration, Deployment und Hardening durchgeführt.

### Phase 4: Lokale KI-Integration

**Modell:** Qwen3.5:2b (lokal via Ollama)

Das Herzstück der Website — die tägliche KI-News-Kuration — läuft vollständig lokal. Ein 2-Milliarden-Parameter-Modell auf einer CPU übersetzt Headlines, schreibt Zusammenfassungen und kategorisiert Artikel. Keine Cloud-API, keine Daten verlassen den VPS.

---

## Was Sie hier sehen

Die Website [levcon.ai](https://levcon.ai) ist die digitale Visitenkarte von **Levcon.ai**, KI-Beratung und Schulungen aus Wien. Das Herzstück ist der Bereich **AI News**: Täglich kuratierte KI-News aus internationalen Quellen — vollständig automatisiert durch ein lokales LLM auf einem kleinen VPS.

### Die Herausforderung

| Was | Wie |
|-----|-----|
| **Budget** | Ein einzelner kleiner VPS (3,8 GB RAM, 1 vCPU) |
| **Modell** | Qwen3.5:2b — ein 2-Milliarden-Parameter-Modell, das auf der CPU läuft |
| **DSGVO** | Keine Cloud-APIs, keine Daten an Google oder OpenAI — alles lokal |
| **Qualität** | 20 News-Artikel pro Tag, in 2 Sprachen übersetzt und zusammengefasst |
| **Newsletter** | Täglicher Versand an Abonnenten, vollautomatisch |

### Die Lösung

```
35 RSS-Feeds weltweit
        ↓
   Score & Rank (6 Faktoren)
        ↓
   10 DE + 10 EN Artikel
        ↓
   Qwen3.5:2b (lokal, 2 serielle Läufe)
        ↓
   Headlines + Zusammenfassungen auf DE + EN
        ↓
   Website + Newsletter + LinkedIn
```

Ein 2B-Modell auf einer CPU schafft das — wenn man ihm die Arbeit richtig aufteilt:

- **2 serielle Läufe** statt einem großen (entlastet die CPU, vermeidet Ermüdung)
- **JSON-Mode** erzwingt valides JSON (verhindert vorzeitiges Abbrechen)
- **Enrichment** reicht LLM-Output mit Originaldaten an (keine fehlenden Felder)
- **Source-Diversity-Cap** verhindert Dominanz einzelner Quellen
- **Semantic Dedup** entfernt ähnliche Artikel (Jaccard-Ähnlichkeit)

---

## Architektur

### Technologie-Stack

| Schicht | Technologie |
|---------|-------------|
| **Frontend** | Next.js 16, TypeScript, Tailwind CSS 4, next-intl (DE/EN) |
| **Backend** | Next.js API Routes, Prisma ORM, SQLite |
| **KI** | Ollama (Qwen3.5:2b), lokal auf dem VPS |
| **Automation** | n8n (Docker), täglich um 06:00 Europe/Vienna |
| **Infrastruktur** | Ubuntu VPS, nginx (SSL + Reverse Proxy), systemd |
| **CI/CD** | GitHub Actions (Auto-Deploy bei Push auf `main`) |

### Pipeline

```
06:00 Europe/Vienna
   │
   ↓
n8n Workflow 01: Collect & Curate
   ├── 35 RSS-Feeds (DE/EN, max 30 pro Feed)
   ├── Dedupe + Score & Rank (10 DE + 10 EN)
   ├── 2× Qwen3.5:2b (DE-Run, dann EN-Run)
   │   ├── Headline-Übersetzung (DE ↔ EN)
   │   ├── Zusammenfassungen (DE + EN)
   │   └── Kategorisierung (research/business/regulation/tools/society)
   └── POST → Levcon API → SQLite
   │
   ↓
n8n Workflow 03: Newsletter
   ├── Subscriber abrufen (confirmed, nicht unsubscribed)
   ├── Newsletter HTML rendern (2 Blöcke: DACH + International)
   ├── SMTP-Versand (IONOS)
   └── lastSentDate aktualisieren
```

---

## Lektionen

1. **KI ist ein Werkzeug, kein Ersatz.** Ohne menschliche Steuerung — Strategie, Design-Vorgaben, Qualitätssicherung und iterative Korrektur — hätte das Ergebnis keinen Wert.
2. **Kleine Modelle reichen oft.** Qwen3.5:2b auf einer CPU ist nicht schnell, aber wenn man die Aufgabe richtig strukturiert (2 Läufe à 10 Items statt 1 Lauf mit 20), liefert es brauchbare Ergebnisse.
3. **Lokal ist möglich.** DSGVO-Konformität bedeutet nicht Verzicht auf KI — es bedeutet, die KI auf den eigenen Server zu holen.
4. **Iterativ gewinnt.** Kein Sprint war beim ersten Versuch perfekt. Jede Iteration brachte Verbesserungen — Bug-Fixes, UI-Polish, Performance-Tuning.
5. **Transparenz schafft Vertrauen.** Wenn Kunden sehen, wie KI eingesetzt wird (und welche Herausforderungen es gibt), entsteht Vertrauen in die Beratung.
6. **Verschiedene Modelle für verschiedene Aufgaben.** Design-Sparring, technische Analyse und Code-Generierung erfordern unterschiedliche Stärken. Das beste Projekt nutzt das richtige Modell für die richtige Aufgabe.

---

## Projektstruktur

```
levcon.ai/
├── src/                         # Next.js App
│   ├── app/                     # App Router (Pages, API Routes)
│   │   ├── [locale]/            # DE/EN Lokalisierung
│   │   │   ├── page.tsx         # Home
│   │   │   ├── [panel]/         # SEO-Routen (/ai-news, /ki-schulungen, etc.)
│   │   │   └── confirm/         # Newsletter Bestätigungs-Seite
│   │   ├── api/ai-news/         # API Routes (subscribe, confirm, ingest, etc.)
│   │   └── globals.css          # Levcon Design-System
│   ├── components/              # React Komponenten
│   │   ├── LevconPage.tsx       # Haupt-Komponente (Panel-Navigation)
│   │   └── ainews/              # AI News Komponenten (Items, Signup, Settings, Archiv)
│   ├── lib/db.ts                # Prisma Client
│   └── i18n/                    # next-intl Konfiguration
├── prisma/schema.prisma         # Datenbank-Schema
├── ai-news/
│   ├── n8n-workflows/           # 4 aktive n8n Workflows (JSON)
│   │   └── code-nodes-refined/  # Code-Node-Inhalte als .js (Referenz)
│   ├── templates/               # HTML-Templates für Newsletter + Bestätigungsmail
│   ├── ARCHITECTURE.md          # Detaillierte Architektur-Doku
│   ├── QUALITY-GUIDELINES.md    # Coding-Standards
│   └── ENV-TEMPLATE.md          # Environment-Variablen Template
├── deploy/                      # VPS Deployment (nginx, systemd, scripts)
└── .github/workflows/deploy.yml # GitHub Actions Auto-Deploy
```

---

## Setup

### Voraussetzungen

- Node.js 18+ und Bun
- SQLite
- Ollama (für lokales LLM)
- n8n (für Automatisierung)
- Ein SMTP-Konto (z.B. IONOS)

### Installation

```bash
# 1. Repository klonen
git clone https://github.com/LEVCON-AT/official.git levcon
cd levcon

# 2. Dependencies installieren
bun install

# 3. Environment einrichten
cp ai-news/ENV-TEMPLATE.md .env
# .env bearbeiten und echte Werte eintragen

# 4. Datenbank erstellen
bun run db:push

# 5. Dev-Server starten
bun run dev
```

### Ollama (lokal) einrichten

```bash
# Modell herunterladen (2 GB)
ollama pull qwen3.5:2b

# Testen
ollama run qwen3.5:2b "Hello"
```

### n8n Workflows importieren

1. n8n öffnen
2. Die 4 JSON-Dateien aus `ai-news/n8n-workflows/` importieren
3. Credentials zuweisen (SMTP, Levcon Internal API)
4. In jedem Workflow "Update Subscriber Last Sent" Code-Node:
   `API_KEY` durch echten Key ersetzen (aus `.env`)

---

## Danksagung

Dieses Projekt zeigt, was möglich ist, wenn man KI nicht als Black Box betrachtet, sondern als Werkzeug in der Hand eines Menschen, der weiß, was er will.

**Danke an:**
- **Claude Sonnet 4.6** für Design-Sparring und Architektur-Konzept
- **Google Gemini 3.1** für technische Machbarkeitsanalyse
- **GLM 5.2** für Code-Generierung und VPS-Deployment
- **n8n** für die Automatisierung
- **Next.js** für das Framework
- **Allen Open-Source-Entwicklern**, deren Bibliotheken hier genutzt werden

---

## Kontakt

**Enric-Bernard Sep-Albi**
KI-Trainer und Organisationsentwickler
Wien, Österreich

- Website: [levcon.ai](https://levcon.ai)
- E-Mail: hello@levcon.ai
- Telefon: +43 677 61638817

---

## Lizenz

Dieses Repository ist öffentlich als Case Study für KI-gestützte Entwicklung. Der Code kann als Inspiration dienen, ist aber Eigentum von Levcon.ai.

---

*Gebaut mit KI. Geleitet von Mensch. Made in Vienna.*
