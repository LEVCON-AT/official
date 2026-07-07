# Local LLM Setup — Ollama + SearXNG auf VPS

**Ziel:** Lokale KI-News-Kuration mit Qwen 2.5 1.5B, keine Cloud-Abhängigkeit.
**VPS:** 87.106.25.91 (3.8 GB RAM, 4 cores AMD EPYC)
**Fallback:** z-ai Cloud-LLM Workflow bleibt als Backup verfügbar.

---

## Architektur

```
VPS (87.106.25.91)
├── Bestehend:
│   ├── Next.js Levcon (Port 3002)
│   ├── n8n Docker (Port 5678, engine.levcon.at)
│   ├── PDF-Server (Port 3000)
│   └── levcon.at + andere Sites
│
├── NEU: Ollama Docker (Port 11434, intern)
│   └── Qwen 2.5 1.5B Modell (~1.2 GB RAM bei Inference)
│
└── NEU: SearXNG Docker (Port 8888, intern)
    └── Meta-Suchmaschine (DuckDuckGo + Bing + Google)
```

**RAM-Budget:**
- Bestehend: ~1.7 GB
- SearXNG: ~150 MB
- Ollama + Qwen: ~1.5 GB (nur bei aktiver Inference)
- Reserve/Swap: ~500 MB + 4 GB Swap
- **Total: ~3.4 GB / 3.8 GB** → knapp aber machbar

---

## 1. Ollama installieren (Docker)

### 1.1 Docker-Compose Datei erstellen

```bash
ssh root@87.106.25.91
mkdir -p /opt/ollama
cd /opt/ollma
nano docker-compose.yml
```

Inhalt:

```yaml
version: '3.8'

services:
  ollama:
    image: ollama/ollama:latest
    container_name: ollama
    restart: unless-stopped
    ports:
      - "127.0.0.1:11434:11434"  # Nur intern, nicht nach außen
    volumes:
      - ollama_data:/root/.ollama
    environment:
      - OLLAMA_KEEP_ALIVE=5m       # Modell 5 Min im RAM halten nach letzter Anfrage
      - OLLAMA_MAX_LOADED_MODELS=1 # Nur 1 Modell gleichzeitig
      - OLLAMA_NUM_PARALLEL=1      # 1 parallele Anfrage (RAM-Schutz)
    deploy:
      resources:
        limits:
          memory: 2G               # Hard Limit, verhindert OOM-kill anderer Services
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

volumes:
  ollama_data:
```

### 1.2 Ollama starten

```bash
cd /opt/ollama
docker-compose up -d
docker-compose logs -f ollama  # Logs beobachten (Ctrl+C zum Beenden)
```

### 1.3 Test: Ollama ist erreichbar

```bash
curl http://127.0.0.1:11434/api/version
# Erwartet: {"name":"ollama","version":"..."}
```

---

## 2. Qwen 2.5 1.5B Modell laden

### 2.1 Modell herunterladen (~900 MB)

```bash
docker exec -it ollama ollama pull qwen2.5:1.5b
# Dauert 2-5 Minuten je nach Internet-Speed
```

### 2.2 Modell testen

```bash
docker exec -it ollama ollama run qwen2.5:1.5b "Hallo, bitte antworte kurz: Was ist KI?"
```

Oder via API:

```bash
curl http://127.0.0.1:11434/api/generate -d '{
  "model": "qwen2.5:1.5b",
  "prompt": "Fasse in 2 Sätzen zusammen: OpenAI hat ein neues Modell veröffentlicht.",
  "stream": false
}'
```

### 2.3 RAM-Verbrauch prüfen

```bash
free -h
# Während Ollama läuft: ca. 1.5-2 GB zusätzlich belegt
# Nach 5 Min Inaktivität (KEEP_ALIVE): Modell wird entladen
```

---

## 3. SearXNG installieren (Docker)

### 3.1 SearXNG Verzeichnis erstellen

```bash
mkdir -p /opt/searxng
cd /opt/searxng
nano docker-compose.yml
```

Inhalt:

```yaml
version: '3.8'

services:
  searxng:
    image: searxng/searxng:latest
    container_name: searxng
    restart: unless-stopped
    ports:
      - "127.0.0.1:8888:8080"  # Nur intern
    volumes:
      - ./searxng:/etc/searxng:rw
    environment:
      - SEARXNG_BASE_URL=http://localhost:8888/
      - UWSGI_WORKERS=2
      - UWSGI_THREADS=2
    deploy:
      resources:
        limits:
          memory: 512M
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

### 3.2 SearXNG starten

```bash
cd /opt/searxng
docker-compose up -d
```

Beim ersten Start erstellt SearXNG eine Default-Config. Diese müssen wir anpassen für API-Zugriff:

### 3.3 SearXNG für API-Zugriff konfigurieren

```bash
# Warte 10 Sekunden bis SearXNG initialisiert ist
sleep 10

# Config bearbeiten
nano /opt/searxng/searxng/settings.yml
```

Folgende Änderungen machen:

```yaml
# 1. Search-Format um JSON erweitern (für n8n)
search:
  formats:
    - html
    - json          # ← HINZUFÜGEN

# 2. Limiter deaktivieren (für API-Zugriff vom gleichen Server)
server:
  limiter: false    # ← HINZUFÜGEN/ÄNDERN
  image_proxy: false

# 3. Engines: DuckDuckGo + Bing aktivieren (Google braucht API-Key)
# (Default ist OK, aber prüfen)
```

### 3.4 SearXNG neu starten

```bash
cd /opt/searxng
docker-compose restart
```

### 3.5 SearXNG testen

```bash
# HTML-Suche (für Browser)
curl -s "http://127.0.0.1:8888/search?q=KI+News+heute&format=json" | python3 -m json.tool | head -50
```

Erwartet: JSON mit `results`-Array, jedes Resultat hat `title`, `url`, `content`.

---

## 4. n8n Workflow anpassen

### 4.1 Bestehenden z-ai Workflow sichern

**WICHTIG:** Den z-ai-Workflow in n8n NICHT löschen! Stattdessen:
1. n8n UI öffnen (https://engine.levcon.at)
2. Workflow 01 "Collect & Curate" öffnen
3. "Duplicate" klicken → Kopie mit Name "Collect & Curate (z-ai BACKUP)"
4. Original deaktivieren (Toggle off)
5. Kopie deaktiviert lassen als Backup

### 4.2 Neuen Local-LLM Workflow importieren

Die Datei `ai-news/n8n-workflows/workflow-01-local-llm.json` (wird in Kürze erstellt) via n8n UI importieren:
- Workflows → Import from File
- Credentials zuweisen (Levcon Internal API, keine z-ai mehr nötig)
- Aktivieren

### 4.3 n8n Credentials anpassen

Neue Credential anlegen:
- **Typ:** HTTP Header Auth (oder gar keine, da Ollama lokal ohne Auth)
- **Name:** `Ollama Local`
- **Header Name:** (leer lassen)
- **Value:** (leer lassen)

Oder: Ollama HTTP-Node ohne Credential konfigurieren (lokaler Zugriff braucht keine Auth).

---

## 5. Test & Quality-Check

### 5.1 Manuelles Testen des Workflows

1. n8n UI → "Collect & Curate (Local LLM)" öffnen
2. Auf "Execute Workflow" klicken
3. Logs beobachten:
   - RSS Feeds laden
   - SearXNG Web-Suche
   - Ollama LLM-Curation
   - POST an /api/ai-news/internal/ingest
4. Auf https://levcon.ai AI News Panel prüfen

### 5.2 RAM-Monitoring während Workflow

In zweitem SSH-Window:
```bash
htop
# Filter: F4 → "ollama"
# Beobachte RAM-Verbrauch während LLM läuft
```

### 5.3 Quality-Vergleich

Vergleiche:
- **Qwen 2.5 1.5B Output** (lokal)
- **z-ai Output** (Backup-Workflow)

Bewertungskriterien:
- Zusammenfassungsqualität (DE + EN)
- Auswahl der Top 5-10 Items
- Korrektheit der Quellen-Zuordnung
- Geschwindigkeit

---

## 6. Fallback zu z-ai (falls nötig)

Falls Qwen 2.5 1.5B zu schlecht ist oder RAM-Probleme verursacht:

```bash
# 1. Local-LLM Workflow in n8n deaktivieren
# 2. z-ai BACKUP Workflow aktivieren
# 3. Ollama/SearXNG Container stoppen:
cd /opt/ollama && docker-compose down
cd /opt/searxng && docker-compose down
# 4. RAM ist wieder frei
```

---

## 7. Wartung

### 7.1 Logs anschauen
```bash
# Ollama
docker logs ollama -f

# SearXNG
docker logs searxng -f
```

### 7.2 Modelle auflisten
```bash
docker exec -it ollama ollama list
```

### 7.3 Modell aktualisieren
```bash
docker exec -it ollama ollama pull qwen2.5:1.5b
```

### 7.4 Festplatten-Verbrauch
```bash
docker system df
du -sh /opt/ollama /opt/searxng
```

---

## 8. Troubleshooting

### Ollama: "Out of memory"
- Anderes Modell stoppen: `docker exec -it ollama ollama stop qwen2.5:1.5b`
- Swap erhöhen: `swapon --show`
- Workflow-Timeout in n8n erhöhen

### SearXNG: "Rate limit exceeded"
- DuckDuckGo blockiert bei zu vielen Queries
- Andere Engines in settings.yml aktivieren (Bing, Brave)

### n8n: "Connection refused" zu Ollama
- Container läuft? `docker ps | grep ollama`
- Port erreichbar? `curl http://127.0.0.1:11434/api/version`

---

## 9. Performance-Optimierungen (optional)

### 9.1 Qwen 2.5 3B (falls RAM reicht)
Falls Qwen 1.5B zu schlecht ist und du 4 GB+ freien RAM hast:
```bash
docker exec -it ollama ollama pull qwen2.5:3b
# RAM-Verbrauch: ~2.5 GB
```

### 9.2 GGUF Quantisierung
Falls Standard-Modell zu groß:
```bash
# Custom GGUF Modell laden (stärker quantisiert)
docker exec -it ollama ollama pull qwen2.5:1.5b-instruct-q4_K_M
```

### 9.3 GPU-Support (falls später VPS mit GPU)
- Ollama Container mit `--gpus all` starten
- NVIDIA Container Toolkit installieren
- 10-50x schnellere Inference
