(() => {
  const presentation = document.querySelector("#presentation");
  const stage = document.querySelector("#sceneStage");
  const scenes = [...document.querySelectorAll("[data-scene]")];
  const sceneTitle = document.querySelector("#sceneTitle");
  const sceneCounter = document.querySelector("#sceneCounter");
  const stepCounter = document.querySelector("#stepCounter");
  const stepProgress = document.querySelector("#stepProgress");
  const sceneDots = document.querySelector("#sceneDots");
  const previousSceneButton = document.querySelector("#previousScene");
  const nextSceneButton = document.querySelector("#nextScene");
  const resetSceneButton = document.querySelector("#resetScene");
  const toggleHudButton = document.querySelector("#toggleHud");
  const toggleFullscreenButton = document.querySelector("#toggleFullscreen");

  const sceneSteps = scenes.map(() => 0);
  let currentSceneIndex = readInitialScene();
  let completionTimer = null;

  function readInitialScene() {
    const match = window.location.hash.match(/^#scene-(\d+)$/);
    if (!match) return 0;
    const requestedIndex = Number(match[1]) - 1;
    return Math.min(Math.max(requestedIndex, 0), scenes.length - 1);
  }

  function parseStepSpec(spec, currentStep) {
    if (!spec) return false;

    return spec.split(",").some((part) => {
      const normalized = part.trim();
      if (!normalized) return false;
      if (!normalized.includes("-")) return Number(normalized) === currentStep;

      const [startValue, endValue] = normalized.split("-");
      const start = Number(startValue);
      const end = Number(endValue);
      return currentStep >= start && currentStep <= end;
    });
  }

  function getCurrentScene() {
    return scenes[currentSceneIndex];
  }

  function getMaxStep(scene = getCurrentScene()) {
    return Number(scene.dataset.maxStep || 0);
  }

  function applySceneState() {
    scenes.forEach((scene, index) => {
      const isActive = index === currentSceneIndex;
      scene.classList.toggle("is-active", isActive);
      scene.setAttribute("aria-hidden", String(!isActive));
    });

    const scene = getCurrentScene();
    const currentStep = sceneSteps[currentSceneIndex];
    const maxStep = getMaxStep(scene);

    scene.dataset.currentStep = String(currentStep);

    scene.querySelectorAll("[data-reveal-step]").forEach((element) => {
      const revealStep = Number(element.dataset.revealStep);
      element.classList.toggle("is-revealed", currentStep >= revealStep);
    });

    scene.querySelectorAll("[data-visible-steps]").forEach((element) => {
      element.classList.toggle(
        "is-visible",
        parseStepSpec(element.dataset.visibleSteps, currentStep),
      );
    });

    scene.querySelectorAll("[data-active-steps]").forEach((element) => {
      element.classList.toggle(
        "is-step-active",
        parseStepSpec(element.dataset.activeSteps, currentStep),
      );
    });

    sceneTitle.textContent = scene.dataset.title || `Escena ${currentSceneIndex + 1}`;
    sceneCounter.textContent = `${pad(currentSceneIndex + 1)} / ${pad(scenes.length)}`;
    stepCounter.textContent = maxStep === 0
      ? "STEP ÚNICO"
      : `STEP ${currentStep} / ${maxStep}`;
    stepProgress.style.width = maxStep === 0
      ? "100%"
      : `${(currentStep / maxStep) * 100}%`;

    [...sceneDots.children].forEach((dot, index) => {
      dot.classList.toggle("is-active", index === currentSceneIndex);
      dot.setAttribute("aria-current", index === currentSceneIndex ? "true" : "false");
    });

    window.history.replaceState(null, "", `#scene-${currentSceneIndex + 1}`);
  }

  function pad(value) {
    return String(value).padStart(2, "0");
  }

  function advanceStep() {
    const maxStep = getMaxStep();
    const currentStep = sceneSteps[currentSceneIndex];

    if (currentStep < maxStep) {
      sceneSteps[currentSceneIndex] += 1;
      applySceneState();
      return;
    }

    pulseCompletion();
    if (currentSceneIndex < scenes.length - 1) {
      window.setTimeout(() => goToScene(currentSceneIndex + 1), 170);
    }
  }

  function rewindStep() {
    const currentStep = sceneSteps[currentSceneIndex];
    if (currentStep > 0) {
      sceneSteps[currentSceneIndex] -= 1;
      applySceneState();
      return;
    }

    if (currentSceneIndex > 0) {
      goToScene(currentSceneIndex - 1, true);
    }
  }

  function goToScene(index, moveToEnd = false) {
    if (index < 0 || index >= scenes.length) return;
    currentSceneIndex = index;
    if (moveToEnd) sceneSteps[index] = getMaxStep(scenes[index]);
    applySceneState();
  }

  function resetScene() {
    sceneSteps[currentSceneIndex] = 0;
    applySceneState();
  }

  function pulseCompletion() {
    window.clearTimeout(completionTimer);
    presentation.classList.add("scene-complete");
    completionTimer = window.setTimeout(() => {
      presentation.classList.remove("scene-complete");
    }, 360);
  }

  function createClickRipple(event) {
    const ripple = document.createElement("span");
    ripple.className = "click-ripple";
    ripple.style.left = `${event.clientX}px`;
    ripple.style.top = `${event.clientY}px`;
    presentation.append(ripple);
    window.setTimeout(() => ripple.remove(), 520);
  }

  function toggleHud() {
    presentation.classList.toggle("hud-hidden");
    toggleHudButton.textContent = presentation.classList.contains("hud-hidden") ? "S" : "H";
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await presentation.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen can be blocked when the page is embedded. The presentation
      // remains fully usable without it.
    }
  }

  function buildSceneDots() {
    const fragment = document.createDocumentFragment();
    scenes.forEach((scene, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", `Ir a la escena ${index + 1}: ${scene.dataset.title}`);
      button.title = `${pad(index + 1)} · ${scene.dataset.title}`;
      button.addEventListener("click", () => goToScene(index));
      fragment.append(button);
    });
    sceneDots.append(fragment);
  }

  stage.addEventListener("click", (event) => {
    createClickRipple(event);
    advanceStep();
  });

  stage.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    rewindStep();
  });

  previousSceneButton.addEventListener("click", () => goToScene(currentSceneIndex - 1));
  nextSceneButton.addEventListener("click", () => goToScene(currentSceneIndex + 1));
  resetSceneButton.addEventListener("click", resetScene);
  toggleHudButton.addEventListener("click", toggleHud);
  toggleFullscreenButton.addEventListener("click", toggleFullscreen);

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();

    if (["arrowright", " ", "enter"].includes(key)) {
      event.preventDefault();
      advanceStep();
      return;
    }

    if (key === "arrowleft") {
      event.preventDefault();
      rewindStep();
      return;
    }

    if (key === "n" || key === "pagedown") {
      event.preventDefault();
      goToScene(currentSceneIndex + 1);
      return;
    }

    if (key === "p" || key === "pageup") {
      event.preventDefault();
      goToScene(currentSceneIndex - 1);
      return;
    }

    if (key === "r") {
      resetScene();
      return;
    }

    if (key === "h") {
      toggleHud();
      return;
    }

    if (key === "f") {
      toggleFullscreen();
    }
  });

  window.addEventListener("hashchange", () => {
    const requestedScene = readInitialScene();
    if (requestedScene === currentSceneIndex) return;
    currentSceneIndex = requestedScene;
    applySceneState();
  });

  buildSceneDots();
  applySceneState();
  stage.focus({ preventScroll: true });
})();
