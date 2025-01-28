"use strict";
let svg;
let DOT_ADJUSTMENT_FACTOR = 1;
let ADJ_WIDTH, ADJ_HEIGHT;
let walkX, walkY, line;

let CORE_MARGIN = { LEFT: 150, RIGHT: 100, TOP: 50, BOTTOM: 20 };
let MARGIN = { LEFT: 150, RIGHT: 100, TOP: 50, BOTTOM: 20 };
let WIDTH = 800;
let HEIGHT = 500;
let HEIGHT_WIDTH_RATIO = HEIGHT / WIDTH;

import { scroller } from "./scroller.js";

// *******************
// read data
// *******************

d3.csv("data/raw/demolitions.csv").then((data) => {
  console.log(data);

  setTimeout(drawInitial, 100);
});

// *******************
// functions
// *******************

function* duBoisLine(
  totalSteps = 105,
  stepLength = 25,
  initialY = 0,
  yChange = 10,
  Increment = true,
  nSteps = 10
) {
  let currentY = initialY;
  let steps = Array.from({ length: nSteps }, (_, i) => i);

  for (let i = 0; i < totalSteps; i++) {
    const step = steps[i % nSteps] * stepLength;
    yield { step, value: currentY };

    if ((i + 1) % nSteps === 0) {
      steps.reverse(); // Reverse the steps to oscillate
      if (Increment) {
        currentY += yChange; // Increment Y after a full cycle
      } else {
        currentY -= yChange; // Decrement Y after a full cycle
      }
    }
  }
}

function drawInitial() {
  const container = document.getElementById("vis");
  const containerWidth = container.clientWidth;

  ADJ_WIDTH = Math.min(WIDTH, containerWidth);
  ADJ_HEIGHT = ADJ_WIDTH * HEIGHT_WIDTH_RATIO;

  DOT_ADJUSTMENT_FACTOR = ADJ_WIDTH / WIDTH;

  MARGIN = Object.keys(CORE_MARGIN).reduce((acc, key) => {
    acc[key] = CORE_MARGIN[key] * DOT_ADJUSTMENT_FACTOR;
    return acc;
  }, {});

  svg = d3
    .select("#vis")
    .append("svg")
    .attr("width", ADJ_WIDTH + MARGIN.LEFT + MARGIN.RIGHT)
    .attr("height", ADJ_HEIGHT + MARGIN.TOP + MARGIN.BOTTOM)
    .attr("opacity", 1);

  walkX = d3
    .scaleLinear()
    .domain([0, 49 * 5]) // Adjust domain based on stepLength and totalSteps
    .range([MARGIN.LEFT, ADJ_WIDTH - MARGIN.RIGHT]);

  walkY = d3
    .scaleLinear()
    .domain([0, 100])
    .range([ADJ_HEIGHT - MARGIN.BOTTOM, MARGIN.TOP]);

  line = d3
    .line()
    .x((d) => walkX(d.step))
    .y((d) => walkY(d.value))
    .curve(d3.curveBasis);

  // Initialize empty data array
  let data = [];

  // Append a group element to hold the paths
  const lineGroup = svg.append("g").attr("class", "line-group");

  // Append the initial path element with empty data
  const path = lineGroup
    .append("path")
    .attr("class", "initial-line-path") // Distinct class for initial line
    .datum(data)
    .attr("d", line(data))
    .attr("stroke", "black")
    .attr("fill", "none")
    .attr("stroke-width", 5);

  const generator = duBoisLine(25, 25, 100, 10, false);

  function animate() {
    const result = generator.next();
    if (!result.done) {
      data.push(result.value);

      // Update the path with a smooth transition
      path
        .datum(data)
        .transition()
        .duration(0) // Duration of the transition in milliseconds
        .ease(d3.easeLinear) // Easing function for smoothness
        .attr("d", line);

      // Schedule the next animation step
      setTimeout(animate, 25); // Delay between animation steps in milliseconds
    } else {
      // Animation complete, trigger zoom-out
      // triggerZoomOut();
    }
  }
  animate();

  // Define the zoom-out function
  function triggerZoomOut() {
    // Calculate the center of the SVG
    const centerX = ADJ_WIDTH / 2;
    const centerY = ADJ_HEIGHT / 2;

    // Select the group containing the line
    lineGroup
      .transition()
      .duration(2000) // Duration of the zoom-out in milliseconds
      .ease(d3.easeCubicOut) // Easing function for smoothness
      .attr(
        "transform",
        `translate(${centerX}, ${centerY}) scale(0.5) translate(${-centerX}, ${-centerY})`
      )
      .on("end", () => {
        console.log("Zoom-out complete");
        // Optionally, you can add more transitions or interactions here
      });
  }
}

function drawPalestinianLines() {
  console.log("drawPalestinianLines");

  // Step 1: **Do not remove existing paths**. Instead, append a new path.

  // Step 2: Define a separate line generator if different properties are needed.
  // If the same scales and generator can be reused, use the existing 'line'.
  // Otherwise, define a new one. Here, we reuse the existing 'line' for consistency.

  // Step 3: Append a new path element for the new line
  const newPath = svg
    .select(".line-group")
    .append("path")
    .attr("class", "palestinian-line-path") // Distinct class for the new line
    .datum([]) // Initialize with empty data
    .attr("d", line) // Set the initial 'd' attribute using the existing line generator
    .attr("stroke", "red") // Choose a different color for the new line
    .attr("fill", "none")
    .attr("stroke-width", 5);

  // Step 4: Animate the new line drawing
  const generator = duBoisLine(105, 25, 70, 10, false); // Adjust 'initialY' to position below
  let data = [];

  function animate() {
    const result = generator.next();
    if (!result.done) {
      data.push(result.value);

      newPath
        .datum(data)
        .transition()
        .duration(0) // Instant update; adjust for smoother transitions
        .ease(d3.easeLinear)
        .attr("d", line);

      // Schedule the next animation frame
      setTimeout(animate, 25); // Adjust the delay as needed
    } else {
      // Optionally, trigger any post-animation effects here
      console.log("New line drawing complete");
    }
  }

  // Start the animation
  animate();
}

// *******************
// scroll
// *******************

// array of all visual functions
// to be called by the scroller functionality
let activationFunctions = [() => {}, drawPalestinianLines, () => {}];

// scroll
let scroll = scroller().container(d3.select("#graphic"));
scroll();
let lastIndex,
  activeIndex = 0;
scroll.on("active", function (index) {
  activeIndex = index;

  let sign = activeIndex - lastIndex < 0 ? -1 : 1;
  let scrolledSections = d3.range(lastIndex + sign, activeIndex + sign, sign);

  scrolledSections.forEach((i) => {
    activationFunctions[i]();
  });
  lastIndex = activeIndex;
});

// reload on top of page
history.scrollRestoration = "manual";
