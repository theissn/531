(() => {
  const installSection = document.getElementById("install-section");
  const installButton = document.getElementById("install-button");
  const installHelp = document.getElementById("install-help");
  const updateSection = document.getElementById("update-section");
  const updateButton = document.getElementById("update-button");
  const updateStatus = document.getElementById("update-status");
  const standalone = window.matchMedia("(display-mode: standalone)");
  let installPrompt = null;
  let registration = null;
  let updating = false;

  const isInstalled = () => standalone.matches || window.navigator.standalone === true;
  const isiOS = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  function renderInstall() {
    installSection.hidden = isInstalled() || !window.isSecureContext;
    installButton.hidden = !installPrompt;
    installHelp.textContent = installPrompt
      ? "Add Lift Sheet to your device and use it offline."
      : isiOS
        ? "To install, open this page in Safari, tap Share, then Add to Home Screen."
        : "To install, use your browser’s Install app or Add to Home screen option, if available.";
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    renderInstall();
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    installSection.hidden = true;
  });
  standalone.addEventListener("change", renderInstall);

  installButton.addEventListener("click", async () => {
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    installButton.disabled = true;
    try {
      await prompt.prompt();
      const choice = await prompt.userChoice;
      renderInstall();
      if (choice.outcome === "accepted") installSection.hidden = true;
    } catch {
      renderInstall();
    } finally {
      installButton.disabled = false;
    }
  });

  updateButton.addEventListener("click", () => {
    if (!registration?.waiting) return;
    updating = true;
    updateButton.disabled = true;
    updateStatus.textContent = "Updating…";
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  });

  renderInstall();
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return;

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (updating) window.location.reload();
  });

  navigator.serviceWorker.register("./sw.js", { updateViaCache: "none" }).then((result) => {
    registration = result;
    const showUpdate = () => { updateSection.hidden = !registration.waiting || !registration.active; };
    showUpdate();
    registration.addEventListener("updatefound", () => {
      const worker = registration.installing;
      worker?.addEventListener("statechange", () => {
        if (worker.state === "installed" || worker.state === "activated") showUpdate();
      });
    });
  }).catch((error) => {
    console.warn("Offline support could not be enabled:", error);
  });
})();
