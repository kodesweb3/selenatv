# AegisTV — webOS Deployment Guide

## Prerequisites

### 1. Install Node.js
Download from [nodejs.org](https://nodejs.org/) (v18+ recommended).

### 2. Install webOS CLI Tools

```bash
npm install -g @webos-tools/cli
```

Verify installation:
```bash
ares-setup-device --version
```

---

## LG TV Setup

### 1. Enable Developer Mode on TV

1. Go to **LG Content Store** on your TV
2. Search for **"Developer Mode"** app
3. Install and open it
4. Create an LG Developer account at [webostv.developer.lge.com](https://webostv.developer.lge.com)
5. Log in on the TV app
6. Toggle **"Dev Mode Status"** → ON
7. Toggle **"Key Server"** → ON
8. Note the **TV IP address** shown
9. **Restart the TV**

> ⚠️ Developer Mode auto-expires after 50 hours. Re-open the app to reset the timer.

### 2. Register the TV as a Device

```bash
ares-setup-device
```

Choose **add** and enter:
- **Name**: orice alias (ex. `kodes`)
- **IP**: IP-ul TV (ex. `192.168.1.7`)
- **Port**: `9922`
- **SSH user**: **`prisoner`** (obligatoriu — nu este passphrase-ul de pe ecran, nici altceva)

Dacă apare **`Not supported auth type`**, de obicei ai pus passphrase-ul sau alt user la „ssh user”; șterge dispozitivul și adaugă din nou cu **`prisoner`**.

### 3. Get the SSH Key

After enabling Key Server on the TV:

```bash
ares-novacom --device kodes --getkey
```

(înlocuiește `kodes` cu numele dat la **ares-setup-device**)

Enter the passphrase **afișată în aplicația Developer Mode pe TV** (nu este username-ul SSH).

### 4. Verify Connection

```bash
ares-device -i --device kodes
```

You should see your TV's model and webOS version.

---

## Deploying AegisTV

### 1. Configure Backend URL

Implicit, aplicația folosește **backend cloud** (Railway): `https://selenatv-production.up.railway.app` — vezi `js/cache.js` (`backendUrl` default) și `js/app.js` (fallback). Pentru **PC local**, apoi build IPK:

- schimbă default-ul sau golește datele app din TV și setează în cod `http://IP_PC:3000` înainte de `ares-package`, **sau**
- după prima instalare, dacă ai ecran Setări cu URL, îl poți edita acolo (dacă e implementat).

### Flux UI (telecomandă)

- **Acasă / Canale:** apare mai întâi **hub-ul de categorii** (iconuri SVG); după ce alegi o categorie, vezi o **grilă** de canale (5 coloane).
- **Înapoi:** din player oprește redarea și revii în app; din grila unei categorii te întorci la categorii. Coduri tastă webOS folosite: **461** și **10009** (plus Backspace în browser).
- **Cache pe TV:** listele de canale/categorii din storage local au TTL **7 zile** (vezi `js/cache.js`); la pornire se folosesc datele cache, apoi refresh din rețea când backend-ul răspunde.

### 2. Package the App

Ai nevoie de **`icon.png`** în `webos-app/` (inclus în repo). Dacă `ares-package` dă eroare de tip „path does not exist” cu un cod hex, în `appinfo.json` scoate temporan câmpurile opționale `bgColor` / `splashBackground` / `iconColor` (culorile rămân în CSS/HTML).

```bash
cd aegis-tv/webos-app
ares-package .
```

This creates `com.selena.tv_1.0.0_all.ipk` (vezi `appinfo.json`)

### 3. Install on TV

```bash
ares-install --device kodes com.selena.tv_1.0.0_all.ipk
```

(înlocuiește `kodes` cu numele dispozitivului tău din `ares-setup-device`)

### 4. Launch on TV

```bash
ares-launch --device kodes com.selena.tv
```

### 5. View Logs (Debug)

```bash
ares-inspect --device kodes --app com.selena.tv --open
```

This opens Chrome DevTools connected to the TV app.

---

## Backend Deployment

The backend should run on a machine that's always on when you use the TV.

### Option A: Local Machine

```bash
cd aegis-tv/backend
npm install
npm start
```

Keep this running while using the TV.

### Option B: Raspberry Pi

Install Node.js on your Pi, copy the backend folder, and run:

```bash
npm install
npm start
```

Use PM2 for auto-restart:
```bash
npm install -g pm2
pm2 start server.js --name aegis-tv
pm2 save
pm2 startup
```

### Option C: Railway (Cloud) — SelenaTV backend deja deployat

**URL public (exemplu):** `https://selenatv-production.up.railway.app`

1. În Railway: proiect nou sau serviciu Node, **Root Directory** = `aegis-tv/backend` (dacă repo-ul e rădăcina SelenaTV).
2. Variabile recomandate: vezi `backend/.env.example`. Opțional `SELENA_ADMIN_KEY` pentru `POST /api/admin/recategorize`. Poți adăuga **`EXTRA_M3U_URLS`** — liste M3U extra (URL-uri separate prin virgulă/spațiu), îmbinate cu sursele implicite la fiecare scan.
3. **Atenție:** fișierele din `storage/` nu sunt persistente între redeploy-uri fără **Volume** pe Railway — după deploy rece rulează scan-ul inițial sau folosește un volume montat pe `storage`.

În aplicația webOS setezi backend-ul la URL-ul HTTPS Railway (fără slash final), ex. în **Setări** prin cache sau editând în dev `js/cache.js` default `backendUrl`.

```javascript
// Exemplu implicit pentru producție (doar dacă îl adaugi în cod)
backendUrl: 'https://selenatv-production.up.railway.app'
```

---

## Updating the App

După modificări, verifică rapid pe televizor: **sus** meniu (Acasă / Canale / Favorite) ↔ **hub categorii** ↔ **grilă canale**; **Back** din player și din grilă; **căutare**; **galben** = favorit.

After making changes:

```bash
# Re-package
cd webos-app
ares-package .

# Re-install (overwrites previous)
ares-install --device kodes com.selena.tv_1.0.0_all.ipk

# Re-launch
ares-launch --device kodes com.selena.tv
```

---

## Pot instala aplicația de pe stick USB?

**În mod normal, nu** — pe webOS TV LG oficial, pachetele **`.ipk`** se instalează prin **webOS CLI** (`ares-install`) peste **rețea**, cu **Developer Mode** + **Key Server**, nu prin „copy pe USB → instalare” ca la un APK Android pe televizoare ce permit sideload.

- **Fluxul suportat de LG:** PC-ul și TV-ul în același LAN → `ares-package` → `ares-install --device … *.ipk`.
- **USB:** nu există în ghidul oficial un pas „introduceți stick-ul și deschideți IPK-ul” pe firmware-ul standard. Dacă pe un model apare vreun meniu experimental de dezvoltator, diferă pe versiuni — nu te baza pe asta pentru livrare.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| TV not found | Check both devices are on same WiFi |
| Connection refused | Re-enable Developer Mode on TV |
| Key expired | Run `ares-novacom --getkey` again |
| App crashes | Check logs with `ares-inspect` |
| No channels | Verify backend is running and reachable from TV |
| Black screen | Check backend URL in `api.js` matches your PC IP |
| Video won't play | Some streams may be geo-blocked or dead |

---

## Network Requirements

- Pentru **instalare** (`ares-install`), PC-ul și TV-ul trebuie în același LAN (și Developer Mode pornit).
- Pentru **folosirea app-ului** cu backend în cloud (ex. Railway), TV-ul are nevoie doar de **internet** către URL-ul HTTPS al API-ului.
- Cu backend **local** (PC/Pi), TV și backend trebuie să poată ajunge unul la celălalt (de obicei același Wi‑Fi).
- Backend-ul are nevoie de **internet** pentru scan IPTV (dacă îl folosești).
- TV folosește **Google Fonts** și **HLS.js** de pe CDN; le poți încorpora local pentru mod aproape offline.
