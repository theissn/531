# 5/3/1 Lift Sheet

A static lift calculator with device-local settings, JSON backups, and PWA installation.

## Run locally

```sh
python3 -m http.server 5173
```

Open `http://localhost:5173`. Service workers require HTTPS in production or localhost during development; opening `index.html` as a file does not enable installation or offline caching.

## Install

In supported browsers, open Settings and select Install, or use the browser's install menu. On iPhone/iPad, open the app in Safari and choose Share → Add to Home Screen. The installed app opens in its own window and works offline after the first successful online load and service worker installation.

Saved maxes, theme, training settings, and the last selected week remain in local storage. Choose a week using the tabs; the app restores it when reopened. Use Export in Settings to back up your settings, including the selected week. Older backups still import correctly.

In Settings, select a max to open its editor. Adjust the value with the − and + buttons (2.5 kg, or 5 lb when the unit is lb) or type an exact number, then choose **Done**. **Cancel** leaves the saved max unchanged. Clearing the field and choosing **Done** removes that max.

In Settings, expand **Estimate 1RM** and enter a weight and 1–10 reps. The calculator uses the Epley formula (`weight × (1 + reps / 30)`); a single rep uses the entered weight. Choose a lift and select **Use as max** to save the estimate as its 1RM and update the lift sheet. It follows the selected kg/lb unit; calculator inputs are temporary and do not change saved maxes until applied.

## Deploy and update

Serve this whole directory over HTTPS, including `sw.js`, the manifest, and `icons/`. Relative URLs support deployment at the domain root or in a subdirectory (with a trailing slash). Serve `sw.js` with a JavaScript MIME type and revalidation (`Cache-Control: no-cache`), and avoid long-lived HTTP caching for the app files and manifest.

When changing any cached app file or icon, increment `CACHE_NAME`'s version in `sw.js`. The service worker caches each release before making it available. Settings shows an Update button when a new worker is waiting; selecting it activates the update and reloads without clearing saved settings. Otherwise the update activates when all app windows are closed. Only this app's shell caches are removed during updates.
