# 💰 Utgifter

En modern webbaserad applikation för att spåra och analysera ekonomiska transaktioner från svenska banker.

## ✨ Funktioner

- 📊 **Importera CSV-data** från olika banker och kontotyper
- 🔍 **Filtrera och söka** transaktioner
- 📈 **Visualisera utgifter** per månad och år
- 💾 **Persistent datalagring** med SQLite
- ☁️ **Azure-klar** för cloud deployment
- 📱 **Responsiv design** för mobil och desktop

## 🛠️ Teknisk Stack

- **Frontend**: React, HTML5, CSS3, Chart.js
- **Backend**: Node.js, Express.js
- **Databas**: SQLite (lokalt), Azure SQL (produktion)
- **Deployment**: Azure App Service
- **CSV-parsing**: PapaParse

## 🚀 Snabbstart (Lokalt)

### Förutsättningar

- Node.js 18+ installerat
- npm eller yarn
- Git

### Installation

1. **Klona projektet**
```bash
git clone https://github.com/erikssonjh/utgifter.git
cd utgifter
```

2. **Installera dependencies**
```bash
npm install
```

3. **Skapa nödvändiga mappar**
```bash
npm run create-dirs
```

4. **Bygg frontend**
```bash
npm run build
```

5. **Starta servern**
```bash
npm run dev  # För utveckling
# eller
npm start    # För produktion
```

6. **Öppna webbläsaren**
```
http://localhost:3001
```

## 📁 Projektstruktur

```
utgifter/
├── server.js              # Backend server
├── package.json           # Dependencies
├── public/                 # Frontend filer
│   └── index.html         # Huvudsida
├── uploads/               # Temporära CSV-filer
├── bicep/                 # Azure Infrastructure as Code
│   └── main.bicep
├── azure-pipelines.yml    # CI/CD pipeline
├── deploy.sh              # Deployment script
└── README.md
```

## 📥 CSV-format som stöds

Applikationen kan hantera tre typer av CSV-filer:

### 1. Enkel kort-CSV (t.ex. "25.csv")
```csv
Datum;Beskrivning;Summa
2025-05-31; Nmb*miami Pizza, Rimbo;-320
2025-05-30; Xxl Sport & Vil, Valbo;-576
```

### 2. Checkkonto-CSV
```csv
Bokföringsdag;Belopp;Avsändare;Mottagare;Namn;Rubrik;Saldo;Valuta
2025-05-31;-200;3015 10 55920;;;Swish betalning;12489,41;SEK
```

### 3. Personkonto-CSV
```csv
Bokföringsdag;Belopp;Avsändare;Mottagare;Namn;Rubrik;Saldo;Valuta
2025-05-28;255;;670518-7612;;Bankgiroinsättning;13443,99;SEK
```

## 🌐 API Dokumentation

### Endpoints

#### `GET /api/transactions`
Hämta transaktioner med filter
```
Query params:
- account: Kontotyp (alla, Checkkonto, Personkonto, Kort)
- fromDate: Från datum (YYYY-MM-DD)
- toDate: Till datum (YYYY-MM-DD)
- search: Sökterm i beskrivning
- limit: Antal resultat (default: 1000)
- offset: Offset för paginering (default: 0)
```

#### `POST /api/import`
Importera CSV-filer
```
Content-Type: multipart/form-data
Body: csvFiles (array av filer)
```

#### `GET /api/stats`
Hämta statistik
```
Query params:
- account: Filtrera på konto
- fromDate: Från datum
- toDate: Till datum
- type: all|monthly|yearly
```

#### `GET /api/stats/monthly/:year`
Hämta månadsstatistik för specifikt år

#### `GET /api/accounts`
Hämta alla tillgängliga konton

## ☁️ Azure Deployment

### Automatisk deployment

1. **Förbered Azure CLI**
```bash
# Installera Azure CLI
curl -sL https://aka.ms/InstallAzureCLIDeb | sudo bash

# Logga in
az login
```

2. **Konfigurera variabler**
```bash
# Redigera deploy.sh och uppdatera:
SUBSCRIPTION_ID="din-subscription-id"
RESOURCE_GROUP="utgifter-rg"
APP_NAME="utgifter-app"
```

3. **Deploy**
```bash
chmod +x deploy.sh
./deploy.sh
```

### Manuell deployment

1. **Skapa Resource Group**
```bash
az group create --name utgifter-rg --location northeurope
```

2. **Deploy infrastructure**
```bash
az deployment group create \
  --resource-group utgifter-rg \
  --template-file bicep/main.bicep \
  --parameters appName=utgifter-app
```

3. **Deploy applikation**
```bash
npm run build
zip -r deploy.zip . -x "node_modules/*" ".git/*"
az webapp deployment source config-zip \
  --resource-group utgifter-rg \
  --name utgifter-app \
  --src deploy.zip
```

## 🔧 Konfiguration

### Environment Variables

Skapa en `.env` fil baserat på `.env.example`:

```bash
cp .env.example .env
```

Viktiga variabler:
- `PORT`: Server port (default: 3001)
- `NODE_ENV`: production|development
- `DATABASE_PATH`: Sökväg till SQLite databas

### Azure-specifika inställningar

För Azure App Service, konfigurera följande Application Settings:
- `NODE_ENV=production`
- `WEBSITE_NODE_DEFAULT_VERSION=18.x`
- `SCM_DO_BUILD_DURING_DEPLOYMENT=true`

## 🧪 Testning

Kör tester:
```bash
npm test
```

För att testa API endpoints manuellt:
```bash
# Hälsokontroll
curl http://localhost:3001/api/health

# Hämta transaktioner
curl "http://localhost:3001/api/transactions?limit=10"
```

## 📊 Användning

1. **Importera data**
   - Ladda upp CSV-filer via drag & drop eller filväljare
   - Systemet identifierar automatiskt filtyp baserat på namn

2. **Filtrera transaktioner**
   - Välj konto, datumintervall
   - Sök i beskrivningar

3. **Analysera utgifter**
   - Se sammanfattande statistik
   - Analysera månads/årstrender

## 🚨 Viktiga Säkerhetshänsyn

### För Produktion

1. **Använd HTTPS**: Konfigurera SSL-certifikat
2. **Sätt miljövariabler**: Använd Azure Key Vault för känslig data
3. **Databas**: Överväg Azure SQL Database för större volymer
4. **Backup**: Implementera regelbunden säkerhetskopiering
5. **Autentisering**: Lägg till användarhantering för multi-user

### Personlig Data

- CSV-filer raderas automatiskt efter import
- Databas lagras lokalt/i Azure
- Ingen data skickas till tredje part

## 🔄 Utveckling

### Lokalt utvecklingsflöde

```bash
# Starta utvecklingsserver med hot reload
npm run dev

# Bygga frontend
npm run build:frontend

# Rensa databas (endast development)
curl -X DELETE http://localhost:3001/api/transactions
```

### Bidra till projektet

1. Forka repositoryt
2. Skapa feature branch (`git checkout -b feature/amazing-feature`)
3. Commita ändringar (`git commit -m 'Add amazing feature'`)
4. Pusha till branch (`git push origin feature/amazing-feature`)
5. Öppna Pull Request

## 📞 Support

### Vanliga Problem

**Q: CSV-filen importeras inte**
A: Kontrollera att filen använder `;` som delimiter och har rätt kolumnnamn

**Q: Appen kraschar vid filuppladdning**
A: Kontrollera att `uploads/` mappen finns och har skrivbehörighet

**Q: Azure deployment misslyckas**
A: Verifiera Azure CLI-autentisering och subscription-inställningar

### Loggar

Lokalt:
```bash
# Serverloggar visas i konsolen
npm run dev
```

Azure:
```bash
# Strömma loggar från Azure
az webapp log tail --name utgifter-app --resource-group utgifter-rg
```

## 📄 Licens

MIT License - se LICENSE filen för detaljer.

## 🙏 Tack

- [PapaParse](https://www.papaparse.com/) för CSV-parsing
- [Chart.js](https://www.chartjs.org/) för visualiseringar
- [Express.js](https://expressjs.com/) för web framework

---

**Utvecklat med ❤️ i Sverige**