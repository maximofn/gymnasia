(() => {
  const presentation = document.querySelector("#presentation");
  const stage = document.querySelector("#sceneStage");
  const scenes = [...document.querySelectorAll("[data-scene]")];
  const sceneTitle = document.querySelector("#sceneTitle");
  const stepCounter = document.querySelector("#stepCounter");
  const stepProgress = document.querySelector("#stepProgress");
  const sceneDots = document.querySelector("#sceneDots");
  const previousSceneButton = document.querySelector("#previousScene");
  const nextSceneButton = document.querySelector("#nextScene");
  const resetSceneButton = document.querySelector("#resetScene");
  const toggleControlsButton = document.querySelector("#toggleControls");
  const toggleFullscreenButton = document.querySelector("#toggleFullscreen");

  const sceneSteps = scenes.map(() => 0);
  let currentSceneIndex = readInitialScene();
  let completionTimer = null;

  function readInitialScene() {
    const match = window.location.hash.match(/^#scene-(\d+)$/);
    if (!match) return 0;
    return Math.min(Math.max(Number(match[1]) - 1, 0), scenes.length - 1);
  }

  function parseStepSpec(spec, currentStep) {
    if (!spec) return false;
    return spec.split(",").some((part) => {
      const normalized = part.trim();
      if (!normalized) return false;
      if (!normalized.includes("-")) return Number(normalized) === currentStep;
      const [startValue, endValue] = normalized.split("-");
      return currentStep >= Number(startValue) && currentStep <= Number(endValue);
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
      element.classList.toggle("is-revealed", currentStep >= Number(element.dataset.revealStep));
    });

    scene.querySelectorAll("[data-visible-steps]").forEach((element) => {
      element.classList.toggle("is-visible", parseStepSpec(element.dataset.visibleSteps, currentStep));
    });

    scene.querySelectorAll("[data-active-steps]").forEach((element) => {
      element.classList.toggle("is-step-active", parseStepSpec(element.dataset.activeSteps, currentStep));
    });

    sceneTitle.textContent = scene.dataset.title || `Escena ${currentSceneIndex + 1}`;
    stepCounter.textContent = maxStep === 0 ? "STEP ÚNICO" : `STEP ${currentStep} / ${maxStep}`;
    stepProgress.style.width = maxStep === 0 ? "100%" : `${(currentStep / maxStep) * 100}%`;

    [...sceneDots.children].forEach((dot, index) => {
      dot.classList.toggle("is-active", index === currentSceneIndex);
      dot.setAttribute("aria-current", index === currentSceneIndex ? "true" : "false");
    });

    window.history.replaceState(null, "", `#scene-${currentSceneIndex + 1}`);
  }

  function advanceStep() {
    const maxStep = getMaxStep();
    if (sceneSteps[currentSceneIndex] < maxStep) {
      sceneSteps[currentSceneIndex] += 1;
      applySceneState();
      return;
    }
    window.clearTimeout(completionTimer);
    presentation.classList.add("scene-complete");
    completionTimer = window.setTimeout(() => presentation.classList.remove("scene-complete"), 360);
    if (currentSceneIndex < scenes.length - 1) {
      window.setTimeout(() => goToScene(currentSceneIndex + 1), 170);
    }
  }

  function rewindStep() {
    if (sceneSteps[currentSceneIndex] > 0) {
      sceneSteps[currentSceneIndex] -= 1;
      applySceneState();
      return;
    }
    if (currentSceneIndex > 0) goToScene(currentSceneIndex - 1, true);
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

  function toggleControls() {
    presentation.classList.toggle("controls-hidden");
    const controlsAreHidden = presentation.classList.contains("controls-hidden");
    toggleControlsButton.textContent = controlsAreHidden ? "S" : "H";
    toggleControlsButton.setAttribute("aria-label", controlsAreHidden ? "Mostrar controles" : "Ocultar controles");
  }

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) await presentation.requestFullscreen();
      else await document.exitFullscreen();
    } catch {
      // La presentación sigue siendo utilizable si el navegador bloquea fullscreen.
    }
  }

  function buildSceneDots() {
    const fragment = document.createDocumentFragment();
    scenes.forEach((scene, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.title = `${String(index + 1).padStart(2, "0")} · ${scene.dataset.title}`;
      button.setAttribute("aria-label", `Ir a la escena ${index + 1}: ${scene.dataset.title}`);
      button.addEventListener("click", () => goToScene(index));
      fragment.append(button);
    });
    sceneDots.append(fragment);
  }

  stage.addEventListener("click", advanceStep);
  stage.addEventListener("contextmenu", (event) => {
    event.preventDefault();
    rewindStep();
  });
  previousSceneButton.addEventListener("click", () => goToScene(currentSceneIndex - 1));
  nextSceneButton.addEventListener("click", () => goToScene(currentSceneIndex + 1));
  resetSceneButton.addEventListener("click", resetScene);
  toggleControlsButton.addEventListener("click", toggleControls);
  toggleFullscreenButton.addEventListener("click", toggleFullscreen);

  document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();
    if (["arrowright", " ", "enter"].includes(key)) {
      event.preventDefault();
      advanceStep();
    } else if (key === "arrowleft") {
      event.preventDefault();
      rewindStep();
    } else if (key === "n" || key === "pagedown") {
      event.preventDefault();
      goToScene(currentSceneIndex + 1);
    } else if (key === "p" || key === "pageup") {
      event.preventDefault();
      goToScene(currentSceneIndex - 1);
    } else if (key === "r") resetScene();
    else if (key === "h") toggleControls();
    else if (key === "f") toggleFullscreen();
  });

  window.addEventListener("hashchange", () => {
    const requestedScene = readInitialScene();
    if (requestedScene !== currentSceneIndex) {
      currentSceneIndex = requestedScene;
      applySceneState();
    }
  });

  buildSceneDots();
  applySceneState();
  stage.focus({ preventScroll: true });
})();
