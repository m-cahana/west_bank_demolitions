"use strict";
let svg;
let DOT_ADJUSTMENT_FACTOR = 1;
let ADJ_WIDTH, ADJ_HEIGHT;
let walkX, walkY, line, lineGroup;
let palestinianPermits;

let CORE_MARGIN = { LEFT: 150, RIGHT: 100, TOP: 50, BOTTOM: 20 };
let CORE_XY_DOMAIN = { START: 0, END: 100 };
let MARGIN = { LEFT: 150, RIGHT: 100, TOP: 50, BOTTOM: 20 };
let WIDTH = 800;
let HEIGHT = 500;
let HEIGHT_WIDTH_RATIO = HEIGHT / WIDTH;
let CORE_Y_START = 100;
let STEP_CONFIG = {
  LENGTH: 1,
  Y_CHANGE: 4,
  Y_START: CORE_Y_START,
  get STEPS_UNTIL_TURN() {
    return 100 / this.LENGTH;
  },
};

const SVG_HEIGHT_INCREMENT = 500;

import { scroller } from "./scroller.js";

// *******************
// read data
// *******************

d3.csv("data/raw/palestinian_permits.csv").then((data) => {
  data.forEach((d) => {
    d.year = Number(d.year);
    d.permits = Number(d.permits) + 1;
  });

  palestinianPermits = data;

  setTimeout(drawInitial, 100);
});

// *******************
// line functions and classes
// *******************

function duBoisLine(
  totalSteps = 105,
  stepLength = 25,
  initialY = 0,
  yChange = 10,
  Increment = true,
  nSteps = 10
) {
  let currentY = initialY;
  let steps = Array.from({ length: nSteps }, (_, i) => i);
  const data = [];

  for (let i = 0; i < totalSteps; i++) {
    const step = steps[i % nSteps] * stepLength;
    data.push({ step, value: currentY });

    if ((i + 1) % nSteps === 0) {
      steps.reverse(); // Reverse the steps to oscillate
      if (Increment) {
        currentY += yChange; // Increment Y after a full cycle
      } else {
        currentY -= yChange; // Decrement Y after a full cycle
      }
    }
  }

  return data;
}

class AnimatedLine {
  /**
   *
   * @param {d3.selection} lineGroup - The group element to append the path.
   * @param {string} className - Class name for the path.
   * @param {string} color - Stroke color for the path.
   * @param {Array} generatorParams - Parameters for the duBoisLine function.
   * @param {d3.line} lineGenerator - D3 line generator function.
   * @param {string} labelText - Optional text to display at the start of the line.
   * @param {number} animationSpeed - Optional animation speed in ms.
   * @param {function} onExceed - Function to call when the line exceeds the bounds.
   */
  constructor(
    lineGroup,
    className,
    color,
    generatorParams,
    lineGenerator,
    labelText = null,
    animationSpeed = 25,
    onExceed = null
  ) {
    this.data = [];
    this.generatorData = duBoisLine(...generatorParams); // Now an array
    this.currentIndex = 0; // To track the animation progress
    this.path = lineGroup
      .append("path")
      .attr("class", className)
      .attr("stroke", color)
      .attr("fill", "none")
      .attr("stroke-width", 2);
    this.lineGenerator = lineGenerator;

    this.labelText = labelText;
    this.animationSpeed = animationSpeed;
    this.onExceed = onExceed;
    this.text = null; // Placeholder for the text element

    // Initialize with the first point if labelText is provided
    if (this.labelText && this.generatorData.length > 0) {
      const firstPoint = this.generatorData[this.currentIndex];
      this.data.push(firstPoint);
      this.path.datum(this.data).attr("d", this.lineGenerator(this.data));
      this.currentIndex++;

      // Calculate the position using walkX and walkY scales
      const x = walkX(firstPoint.step);
      const y = walkY(firstPoint.value);

      // Append the text element at the starting point
      this.text = lineGroup
        .append("text")
        .attr("class", "dubois-label")
        .attr("x", x)
        .attr("y", y)
        .attr("dy", "-0.5em") // Adjust vertical position (above the point)
        .attr("fill", color) // Match the line color or choose another
        .text(this.labelText);
    }

    this.animate(); // Start the animation
  }

  animate() {
    if (this.currentIndex < this.generatorData.length) {
      const point = this.generatorData[this.currentIndex];
      this.currentIndex++;

      this.data.push(point);
      this.path.datum(this.data).attr("d", this.lineGenerator(this.data));

      // Check if the next point exceeds the SVG bounds
      const x = walkX(point.step);
      const y = walkY(point.value);

      const isExceeding =
        x < MARGIN.LEFT ||
        x > ADJ_WIDTH - MARGIN.RIGHT ||
        y < MARGIN.TOP ||
        y > ADJ_HEIGHT - MARGIN.BOTTOM;

      if (isExceeding && this.onExceed) {
        this.onExceed(); // Trigger the zoom-out
      }

      setTimeout(() => this.animate(), this.animationSpeed);
    } else {
      console.log(`Animation complete for ${this.path.attr("class")}`);
      // Optionally, handle post-animation tasks here
    }
  }

  /**
   * Returns the current data points of the animated line.
   * @returns {Array<{ step: number, value: number }>}
   */
  getData() {
    return this.data;
  }
}
// Define the zoom-out function to scale only the y-axis
function triggerZoomOut(zoomFactor = 2) {
  // Calculate the center of the SVG
  const centerX = ADJ_WIDTH / zoomFactor;
  const centerY = ADJ_HEIGHT / zoomFactor;

  // Select the group containing the lines and apply the y-axis scaling
  svg
    .select(".permit-lines")
    .transition()
    .duration(2000) // Duration of the zoom-out in milliseconds
    .ease(d3.easeCubicOut) // Easing function for smoothness
    .attr(
      "transform",
      `translate(${centerX}, ${centerY}) scale(1, ${
        1 / zoomFactor
      }) translate(${-centerX}, ${-centerY})`
    )
    .on("end", () => {
      console.log("Zoom-out complete");
      // Optionally, you can add more transitions or interactions here
    });
}

// *******************
// activation functions
// *******************

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
    .domain([CORE_XY_DOMAIN.START, CORE_XY_DOMAIN.END])
    .range([MARGIN.LEFT, ADJ_WIDTH - MARGIN.RIGHT]);

  walkY = d3
    .scaleLinear()
    .domain([CORE_XY_DOMAIN.START, CORE_XY_DOMAIN.END])
    .range([ADJ_HEIGHT - MARGIN.BOTTOM, MARGIN.TOP]);

  line = d3
    .line()
    .x((d) => walkX(d.step))
    .y((d) => walkY(d.value))
    .curve(d3.curveBasis);

  // Append a group element to hold the paths
  lineGroup = svg.append("g").attr("class", "permit-lines");

  function forEachWithVariableDelay(array, callback) {
    let i = 0;

    function iterate() {
      if (i < array.length) {
        const d = array[i];
        callback(d, i, array);
        // Ensure that d.permits is a non-negative number
        const delay = Math.max(30, d.permits * 30);
        setTimeout(iterate, delay);
        i++;
      }
    }

    iterate();
  }

  forEachWithVariableDelay(palestinianPermits, (d) => {
    new AnimatedLine(
      lineGroup,
      `palestinian-${d.year}-line-path`,
      "green",
      [
        d.permits,
        STEP_CONFIG.LENGTH,
        STEP_CONFIG.Y_START,
        STEP_CONFIG.Y_CHANGE,
        false,
        STEP_CONFIG.STEPS_UNTIL_TURN,
      ], // generatorParams: totalSteps, stepLength, initialY, yChange, Increment
      line,
      d.year
    );

    if (d.permits > STEP_CONFIG.STEPS_UNTIL_TURN) {
      STEP_CONFIG.Y_START -=
        Math.floor(d.permits / STEP_CONFIG.STEPS_UNTIL_TURN) *
        STEP_CONFIG.Y_CHANGE;
    } else {
      STEP_CONFIG.Y_START -= STEP_CONFIG.Y_CHANGE;
    }
  });

  // const animatedLine1 = new AnimatedLine(
  //   lineGroup,
  //   "initial-line-path",
  //   "black",
  //   [25, STEP_CONFIG.LENGTH, STEP_CONFIG.Y_START, STEP_CONFIG.Y_CHANGE, false], // generatorParams: totalSteps, stepLength, initialY, yChange, Increment
  //   line,
  //   "2023",
  //   () => {
  //     Callback to initialize animatedLine2 after animatedLine1 completes
  //     const animatedLine2 = new AnimatedLine(
  //       lineGroup,
  //       "second-line-path",
  //       "blue",
  //       [25, STEP_CONFIG.LENGTH, 70, STEP_CONFIG.Y_CHANGE, false], // Adjust generatorParams for second line
  //       line,
  //       "2024"
  //     );
  //   }
  // );

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

function consolidatePalestinianLines() {
  STEP_CONFIG.Y_START = CORE_Y_START;

  const conslidatedPermits = palestinianPermits.reduce(
    (sum, d) => sum + d.permits,
    0
  );

  const consolidatedPathData = duBoisLine(
    ...[
      conslidatedPermits,
      STEP_CONFIG.LENGTH,
      STEP_CONFIG.Y_START,
      STEP_CONFIG.Y_CHANGE,
      false,
      STEP_CONFIG.STEPS_UNTIL_TURN,
    ]
  );

  let index_counter = 0;

  palestinianPermits.forEach((d) => {
    svg
      .select(`.palestinian-${d.year}-line-path`)
      .transition()
      .duration(1000) // duration in milliseconds
      .attr(
        "d",
        line(
          consolidatedPathData.slice(index_counter, index_counter + d.permits)
        )
      );

    index_counter += d.permits - 1;
  });

  // remove prior labels
  svg.selectAll("text").remove();

  // grab year info
  const years = palestinianPermits.map((d) => d.year);
  const yearStart = d3.min(years);
  const yearEnd = d3.max(years);

  // append a new consolidated label
  svg
    .append("text")
    .attr("class", "dubois-label")
    .attr("x", walkX(consolidatedPathData[0].step))
    .attr("y", walkY(consolidatedPathData[0].value))
    .attr("dy", "-0.5em") // Adjust vertical position (above the point)
    .attr("fill", "black")
    .text(`${yearStart} - ${yearEnd}`);

  if (conslidatedPermits > STEP_CONFIG.STEPS_UNTIL_TURN) {
    STEP_CONFIG.Y_START -=
      Math.floor(conslidatedPermits / STEP_CONFIG.STEPS_UNTIL_TURN) *
        STEP_CONFIG.Y_CHANGE +
      STEP_CONFIG.Y_CHANGE;
  } else {
    STEP_CONFIG.Y_START -= STEP_CONFIG.Y_CHANGE;
  }
}

function unconsolidatePalestinianLines() {
  STEP_CONFIG.Y_START = CORE_Y_START;

  // remove prior labels
  svg.selectAll("text").remove();

  palestinianPermits.forEach((d) => {
    const pathData = duBoisLine(
      ...[
        d.permits,
        STEP_CONFIG.LENGTH,
        STEP_CONFIG.Y_START,
        STEP_CONFIG.Y_CHANGE,
        false,
        STEP_CONFIG.STEPS_UNTIL_TURN,
      ]
    );

    svg
      .select(`.palestinian-${d.year}-line-path`)
      .transition()
      .duration(1000) // duration in milliseconds
      .attr("d", line(pathData));

    // append new individual label
    svg
      .append("text")
      .attr("class", "dubois-label")
      .attr("x", walkX(pathData[0].step))
      .attr("y", walkY(pathData[0].value))
      .attr("dy", "-0.5em") // Adjust vertical position (above the point)
      .attr("fill", "black")
      .text(`${d.year}`);

    if (d.permits > STEP_CONFIG.STEPS_UNTIL_TURN) {
      STEP_CONFIG.Y_START -=
        Math.floor(d.permits / STEP_CONFIG.STEPS_UNTIL_TURN) *
        STEP_CONFIG.Y_CHANGE;
    } else {
      STEP_CONFIG.Y_START -= STEP_CONFIG.Y_CHANGE;
    }
  });
}

function drawIsraeliLines() {
  const israeliLine = new AnimatedLine(
    lineGroup,
    `israeli-line-path`,
    "blue",
    [
      2000,
      STEP_CONFIG.LENGTH,
      STEP_CONFIG.Y_START,
      STEP_CONFIG.Y_CHANGE,
      false,
      STEP_CONFIG.STEPS_UNTIL_TURN,
    ], // generatorParams: totalSteps, stepLength, initialY, yChange, Increment
    line,
    "2024",
    1
  );

  console.log(Math.floor(2000 / STEP_CONFIG.STEPS_UNTIL_TURN));
  console.log(israeliLine.getData());
}

function removeIsraeliLines() {
  svg.selectAll(".israeli-line-path").remove();
}

// *******************
// scroll
// *******************

// array of all visual functions
// to be called by the scroller functionality
let activationFunctions = [
  unconsolidatePalestinianLines,
  () => {
    removeIsraeliLines();
    consolidatePalestinianLines();
  },
  drawIsraeliLines,
  () => {},
];

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
