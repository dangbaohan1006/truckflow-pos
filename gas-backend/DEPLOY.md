# Deploy Guide: Google Apps Script Backend

## Step 1: Create a Google Sheet

1. Go to [sheets.new](https://sheets.new)
2. Note the Sheet ID from the URL: `https://docs.google.com/spreadsheets/d/`**`THIS_IS_THE_ID`**`/edit`
3. Copy the Sheet ID

## Step 2: Create the Apps Script Project

1. Open the Sheet → **Extensions → Apps Script**
2. Delete the default `Code.gs` content
3. Create the following files in the Apps Script editor (File → New → Script):

| File Name | Content |
|-----------|---------|
| `Config.gs` | Copy from `gas-backend/Config.gs` → set `SPREADSHEET_ID` |
| `Sheets.gs` | Copy from `gas-backend/Sheets.gs` |
| `Auth.gs` | Copy from `gas-backend/Auth.gs` → set `OAUTH_CLIENT_ID` and `OAUTH_REDIRECT_URI` |
| `Sync.gs` | Copy from `gas-backend/Sync.gs` |
| `Inventory.gs` | Copy from `gas-backend/Inventory.gs` |
| `Sales.gs` | Copy from `gas-backend/Sales.gs` |
| `Code.gs` | Copy from `gas-backend/Code.gs` |
| `Setup.gs` | Copy from `gas-backend/Setup.gs` |

4. In `Config.gs`, set `SPREADSHEET_ID` to the ID from Step 1

## Step 3: Set Up Google OAuth 2.0

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select existing)
3. Go to **APIs & Services → OAuth consent screen**
   - User Type: External (or Internal if using Google Workspace)
   - App name: "TruckFlow POS"
   - Authorized domains: your Vercel domain
4. Go to **APIs & Services → Credentials**
   - Create OAuth 2.0 Client ID
   - Application type: Web application
   - Authorized JavaScript origins: `https://your-app.vercel.app`
   - Authorized redirect URIs: `https://script.google.com/macros/d/SCRIPT_ID/usercallback`
   - Note the **Client ID**
5. Enable the **Google Sheets API** for the project

## Step 4: Deploy the Apps Script

1. In the Apps Script editor, click **Deploy → New deployment**
2. Select type: **Web app**
3. Description: "TruckFlow POS Backend"
4. Execute as: **Me (your-email@gmail.com)**
5. Who has access: **Anyone**
6. Click **Deploy**
7. Copy the **Web app URL** (looks like: `https://script.google.com/macros/s/.../exec`)

## Step 5: Run Setup

1. In the Apps Script editor, select `Setup.gs`
2. Run the `setupSheet()` function (this creates all sheet tabs)
3. Run the `addSampleInventory()` function (optional, for testing)
4. Check your Google Sheet — you should see all tabs created

## Step 6: Configure Frontend

1. In your Vercel project, set environment variables:
   ```
   VITE_API_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
   ```
2. In `Auth.gs`, update:
   - `OAUTH_CLIENT_ID` = the Client ID from Step 3
   - `OAUTH_REDIRECT_URI` = the Web app URL from Step 4

## Step 7: Test

1. Open your Vercel app
2. Click "Login with Google"
3. You should be redirected to Google, then back to the app
4. Check the Google Sheet for new data

## Troubleshooting

### CORS Issues
- Apps Script Web Apps don't support CORS headers natively
- The frontend must use `?path=` query parameter routing (already implemented)
- For production, consider deploying as a **Google Workspace Add-on** or using **Cloudflare Workers** as a proxy

### OAuth Redirect Issues
- Make sure the redirect URI in Google Cloud Console matches EXACTLY
- The redirect URI should be: `https://script.google.com/macros/s/YOUR_SCRIPT_ID/usercallback`
- Note: Apps Script uses `/usercallback` not `/exec` for OAuth

### Rate Limits
- Apps Script has daily quotas (e.g., 90 min execution time for consumer accounts)
- For heavy usage, consider upgrading to Google Workspace

## Architecture Summary

```
Frontend (React + Vite on Vercel)
    ↕ HTTPS (JSON API)
Google Apps Script Web App
    ↕ Internal API
Google Sheets (Database)
```

**Cost: $0** (all services have free tiers)
