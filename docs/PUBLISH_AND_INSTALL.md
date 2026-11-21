# ESP32 Tour: publish, install on a phone, run offline

Three ready-made versions are in `dist/`:

| Version | What it is | Use it for |
|---|---|---|
| `ESP32_Tour/` | Normal folder | A computer. Double-click `index.html`. |
| `ESP32_Tour_site/` | Same app plus install files (PWA) and an **empty** accounts file | Publishing on GitHub Pages, then installing on phones |
| `ESP32_Tour_single.html` | The whole app in one 500 KB file | Sending by e-mail or Drive, opening without installing |

Rebuild any time with `.venv\Scripts\python.exe -I src\build.py` (from the project folder).

---

## 1. On a computer (no internet needed)

1. Copy the **whole** `ESP32_Tour` folder to the computer (anywhere, e.g. `C:\ESP32_Tour`).
2. Double-click `index.html`. Use Chrome or Edge if you can.
3. Create an account (first time) or sign in.
4. To carry your progress with the folder: click your name, then **Save accounts to folder**, and pick the `ESP32_Tour` folder (Chrome/Edge). Other browsers download `accounts.js`: put it in `ESP32_Tour\data\`, replacing the old file.

---

## 2. Publish on GitHub Pages (one time, free)

A phone can only install an app from an `https://` address. GitHub Pages gives you one for free.
You need a free GitHub account. The free plan needs a **public** repository, so anyone with the link can open the course (it contains no accounts, because `ESP32_Tour_site/data/accounts.js` is empty).

### Option A: in the browser (no Git needed)

1. Go to <https://github.com/new>. Repository name: `esp32-tour`. Choose **Public**. Tick **Add a README file**. Click **Create repository**.
2. Click **Add file → Upload files**.
3. Open the folder `dist\ESP32_Tour_site` on your computer. Select **everything inside it** (the folders `app`, `data`, `fonts`, `icons`, `licenses` and the files `index.html`, `manifest.webmanifest`, `sw.js`) and drag it onto the GitHub page. `index.html` must end up at the top level of the repository, not inside another folder.
4. Click **Commit changes**.
5. Open **Settings → Pages**. Under **Build and deployment**, set Source to **Deploy from a branch**, Branch **main**, folder **/(root)**, then **Save**.
6. Wait 1–2 minutes and refresh. The page shows your address:
   `https://YOUR-USERNAME.github.io/esp32-tour/`
7. Open that address on your computer to check it works.

### Option B: with Git

```powershell
cd dist\ESP32_Tour_site
git init -b main
git add -A
git commit -m "ESP32 Tour 0.2.0"
git remote add origin https://github.com/YOUR-USERNAME/esp32-tour.git
git push -u origin main
```
Then do steps 5–7 above.

### Publishing a new version later
1. Raise `"version"` in `src/course.json` (for example `0.2.1`), then rebuild.
2. Upload the new contents of `dist\ESP32_Tour_site` over the old ones (Add file → Upload files, or `git add -A; git commit; git push`).
3. Phones that already installed the app show **"Update available" → Reload** the next time they open it online. Progress is kept.

> Never upload `dist\ESP32_Tour\data\accounts.js` after real people have used that folder: it holds their accounts (as password hashes). Always publish `ESP32_Tour_site`.

---

## 3. Install on a phone (needs internet only for this step)

Open the address from step 2 on the phone, and **wait until the toast says "Ready to work offline"**.

### Android (Chrome)
1. Open `https://YOUR-USERNAME.github.io/esp32-tour/` in **Chrome**.
2. Tap the **⋮** menu → **Install app** (or **Add to Home screen**) → **Install**.
3. Open **ESP32 Tour** from the home screen or app drawer. It opens full screen, like an app.

### iPhone / iPad (Safari)
1. Open the address in **Safari** (on iOS 16.4 and later Chrome and Edge also offer this, but Safari is the safest).
2. Tap the **Share** button → **Add to Home Screen** → **Add**.
3. Open **ESP32 Tour** from the home screen icon.

### Check that it works offline
1. Open the installed app once while online and sign in.
2. Switch on **airplane mode**.
3. Close the app completely and open it again. The Dashboard should load. Links to outside sites are marked **online** and simply won't open until you reconnect; the lessons never depend on them.

### Your account on the phone
Accounts live **on each device**. The installed phone app starts empty (on iPhone, the home-screen app also has separate storage from Safari). To bring your account from the computer:
1. On the computer: click your name → **Export accounts file** (downloads `accounts.js`).
2. Send that file to the phone (Drive, e-mail, messaging).
3. On the phone, in the installed app, on the sign-in page tap **Import accounts from another device** and choose the file. Then sign in with your usual ID and password.

Do the same in reverse to move progress back. Export now and then as a backup.

---

## 4. Using Google Drive

Drive cannot run the app as a PWA (it does not serve web pages), but it is good for moving files:

- **Backup of progress:** keep `accounts.js` in Drive and use **Import accounts file** when needed.
- **Single file on Android:** put `ESP32_Tour_single.html` in Drive, download it to the phone, then open it with **Chrome** (Files → tap the file → *Open with → Chrome*). Do not use Drive's preview, which shows the code as text. Android may refuse to open it from some file managers; if so, use the GitHub Pages install instead.
- **Single file on iPhone:** not reliable (Files opens HTML as text or in a restricted viewer). Use the GitHub Pages install.
- In the single file, click your name → **Download app copy with my progress** to get a new copy of the file with your accounts inside; move that copy to the next device.

---

## 5. Troubleshooting

| Problem | Fix |
|---|---|
| Page not found after publishing | Wait 2 minutes; check Settings → Pages shows "Your site is live"; the address ends with `/esp32-tour/` |
| Blank page | `index.html` was uploaded inside a subfolder: move it to the top level |
| No "Install app" option on Android | Use Chrome, open the **https** address (not a file), and reload once |
| No "Add to Home Screen" on iPhone | Use Safari; the Share button is at the bottom (iPhone) or top (iPad) |
| Not working offline | Open the app online once and wait for "Ready to work offline"; don't use a private/incognito tab |
| Progress missing on the phone | Import `accounts.js` (section 3); the phone has its own storage |
| Stuck on an old version | Open online, tap **Reload** on "Update available"; or close the app fully and reopen |
