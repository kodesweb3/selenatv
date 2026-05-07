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
- **Name**: `aegis-tv` (or any name)
- **IP**: Your TV's IP address
- **Port**: `9922`
- **Username**: `prisoner`

### 3. Get the SSH Key

After enabling Key Server on the TV:

```bash
ares-novacom --device aegis-tv --getkey
```

Enter the passphrase shown on the TV's Developer Mode app.

### 4. Verify Connection

```bash
ares-device-info --device aegis-tv
```

You should see your TV's model and webOS version.

---

## Deploying AegisTV

### 1. Configure Backend URL

Edit `webos-app/js/api.js` and set the backend IP:

```javascript
let BASE_URL = 'http://YOUR_PC_IP:3000';
```

Replace `YOUR_PC_IP` with your computer's local network IP (e.g., `192.168.1.100`).

> The TV and your PC must be on the **same WiFi network**.

### 2. Package the App

```bash
cd aegis-tv/webos-app
ares-package .
```

This creates `com.aegis.tv_1.0.0_all.ipk`

### 3. Install on TV

```bash
ares-install --device aegis-tv com.aegis.tv_1.0.0_all.ipk
```

### 4. Launch on TV

```bash
ares-launch --device aegis-tv com.aegis.tv
```

### 5. View Logs (Debug)

```bash
ares-inspect --device aegis-tv --app com.aegis.tv --open
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

### Option C: Railway (Cloud)

1. Go to [railway.app](https://railway.app)
2. Create a new project from GitHub
3. Point to the `backend/` folder
4. Set environment variables from `.env`
5. Deploy

Update `BASE_URL` in the webOS app to the Railway URL.

---

## Updating the App

After making changes:

```bash
# Re-package
cd webos-app
ares-package .

# Re-install (overwrites previous)
ares-install --device aegis-tv com.aegis.tv_1.0.0_all.ipk

# Re-launch
ares-launch --device aegis-tv com.aegis.tv
```

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

- TV and backend must be on the **same local network**
- Backend needs **internet access** to scan IPTV sources
- TV needs **internet access** for Google Fonts and HLS.js CDN
  - Or bundle these locally for fully offline operation
