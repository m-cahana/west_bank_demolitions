document.addEventListener("DOMContentLoaded", () => {
  const footer = document.getElementById("footer");
  const vis = document.getElementById("vis");

  // Create an intersection observer
  const observerOptions = {
    root: null, // relative to the viewport
    rootMargin: "0px 0px 0px 0px",
    threshold: 0, // trigger when 10% of the observedDiv is visible
  };

  const observerCallback = (entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        vis.classList.add("static");
      } else {
        vis.classList.remove("static");
      }
    });
  };

  const observer = new IntersectionObserver(observerCallback, observerOptions);
  observer.observe(footer);
});
