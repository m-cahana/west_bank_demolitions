document.addEventListener("DOMContentLoaded", () => {
  const downArrow = document.querySelector(".down-arrow");

  function getNextNonGhostStep(currentStep) {
    let nextStep = currentStep.nextElementSibling;
    while (nextStep && nextStep.classList.contains("ghost")) {
      nextStep = nextStep.nextElementSibling;
    }
    return nextStep;
  }

  downArrow.addEventListener("click", () => {
    const currentStep = downArrow.closest(".step");
    const nextStep = getNextNonGhostStep(currentStep);

    if (nextStep) {
      nextStep.scrollIntoView({ behavior: "smooth", block: "start" });

      // If using custom scroller functions, integrate here
      // Example:
      // activateStep(nextStep);
    } else {
      console.warn("No next non-ghost step found.");
    }
  });
});
