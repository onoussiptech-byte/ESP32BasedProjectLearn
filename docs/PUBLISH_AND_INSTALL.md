# ESP32 Tour: publish, install on a phone, run offline

There are three versions, built from the same source in `src/`:

| Version | Where | Use it for |
|---|---|---|
| `ESP32_Tour/` | `dist/` on the main branch | A computer. Double-click `index.html`. |
| PWA files (the same app plus install files and an **empty** accounts file) | The **`gh-appages` branch** only, never a folder in `dist/` | GitHub Pages, then installing on phones |
| `ESP32_Tour_single.html` | `dist/` | Sending by e-mail or Drive, opening without installing |

Rebuild the computer versions with `python -I src\build.py` (from the project folder).
Rebuild **and publish the phone version** with `python -I src\build.py --publish` (section 2).

---

## 1. On a computer (no internet needed)

1. Copy the **whole** `ESP32_Tour` folder to the computer (anywhere, e.g. `C:\ESP32_Tour`).
2. Double-click `index.html`. Use Chrome or Edge if you can.
3. Create an account (first time) or sign in.
4. To carry your progress with the folder: open **Overview**, **Account management**, then **Save accounts to folder**, and pick the `ESP32_Tour` folder (Chrome/Edge). Other browsers download `accounts.js`: put it in `ESP32_Tour\data\`, replacing the old file.

---

## 2. Publish on GitHub Pages (one time, free)

A phone can only install an app from an `https://` address. GitHub Pages gives you one for free.
The free plan needs a **public** repository, so anyone with the link can open the course. It contains no accounts: the publish step always writes an empty `data/accounts.js`.

### One time: tell GitHub which branch to serve
On GitHub open **Settings → Pages**. Under **Build and deployment** set Source to **Deploy from a branch**, Branch **`gh-appages`**, folder **/(root)**, then **Save**. The page then shows your address, for example `https://YOUR-USERNAME.github.io/ESP32BasedProjectLearn/`.

### Publishing a new version (every time)
1. Raise `"version"` in `src/course.json` (for example `0.3.1`).
2. Run, from the project folder:

   ```powershell
   python -I src\build.py --publish
   ```

   This rebuilds the computer versions in `dist/`, then puts the phone files on the `gh-appages` branch and pushes it. The phone files are assembled in a temporary folder that is deleted afterwards, so nothing for phones is ever left in `dist/` and `main` is never touched.
3. Wait 1–2 minutes, open the address on your computer to check it.
4. Phones that already installed the app show **"Update available" → Reload** the next time they open it online. Progress is kept.

Options: `--no-push` commits on `gh-appages` but does not push (then run `git push origin gh-appages` yourself); `--message "text"` sets the commit message.
If the push is refused (HTTP 403), the commit is still on your local `gh-appages` branch: push it from a terminal signed in to a GitHub account that may write to the repository.

> The phone files never include the accounts of whoever used the computer folder. Do not copy `dist\ESP32_Tour` to the `gh-appages` branch by hand: its `data\accounts.js` holds people's accounts (as password hashes).

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
1. On the computer: **Overview** → **Account management** → **Export accounts file** (downloads `accounts.js`).
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
