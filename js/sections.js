"use strict";
let svg;
let DOT_ADJUSTMENT_FACTOR = 1;
let ADJ_WIDTH, ADJ_HEIGHT;
let walkX, walkY, line, lineGroup;
let palestinianPermits, palestinianDemolitions;

let simulation, nodes;

let CORE_MARGIN = { LEFT: 150, RIGHT: 100, TOP: 50, BOTTOM: 20 };
let CORE_XY_DOMAIN = { START: 0, END: 100 };
let MARGIN = { LEFT: 150, RIGHT: 100, TOP: 50, BOTTOM: 20 };
let WIDTH = 800;
let HEIGHT = 500;
let HEIGHT_WIDTH_RATIO = HEIGHT / WIDTH;

const DOT = { RADIUS: 5, OPACITY: 0.5 };
const RECT = { WIDTH: 5, HEIGHT: 5, OPACITY: 0.5 };

let CORE_Y_START = 100;
let STEP_CONFIG = {
  LENGTH: 1,
  Y_CHANGE: 5,
  Y_START: CORE_Y_START,
  get STEPS_UNTIL_TURN() {
    return 100 / this.LENGTH;
  },
};

import { scroller } from "./scroller.js";

// *******************
// Read Data
// *******************

// Permits
d3.csv("data/raw/palestinian_permits.csv").then((data) => {
  data.forEach((d) => {
    d.year = Number(d.year);
    // 1 permit buffer to handle 1-permit length entries
    d.permits = Number(d.permits) + 1;
  });

  palestinianPermits = data;

  setTimeout(drawInitial, 100);
});

// Demolitions
d3.csv("data/raw/demolitions.csv").then((data) => {
  // Convert column names to lowercase with underscores
  const columns = data.columns.map((col) =>
    col.toLowerCase().replace(/\s+/g, "_")
  );

  data.forEach((d) => {
    columns.forEach((col, i) => {
      d[col] = d[data.columns[i]];
      delete d[data.columns[i]];
    });
    d.housing_units = Number(d.housing_units);
    d.minors_left_homeless = Number(d.minors_left_homeless);
    d.people_left_homeless = Number(d.people_left_homeless);
    d.crossed = false;
    d.skipOpacityChange = Math.random() < 0.01; // 5% chance to skip opacity change
  });

  palestinianDemolitions = data;
});

// *******************
// Line Functions and Classes
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
   *
   */
  constructor(
    lineGroup,
    className,
    color,
    generatorParams,
    lineGenerator,
    labelText = null,
    animationSpeed = 5
  ) {
    this.data = [];
    this.generatorData = duBoisLine(...generatorParams); // Now an array
    this.currentIndex = 0; // To track the animation progress
    this.path = lineGroup
      .append("path")
      .attr("class", className)
      .attr("stroke", color)
      .attr("fill", "none")
      .attr("stroke-width", 5);
    this.lineGenerator = lineGenerator;

    this.labelText = labelText;
    this.animationSpeed = animationSpeed;

    this.text = null; // Placeholder for the text element

    // Initialize with the first point if labelText is provided
    if (this.labelText && this.generatorData.length > 0) {
      const firstPoint = this.generatorData[this.currentIndex];
      this.data.push(firstPoint);
      this.path.datum(this.data).attr("d", this.lineGenerator(this.data));
      this.currentIndex++;

      // Append the text element at the starting point
      this.text = lineGroup
        .append("text")
        .attr("class", "dubois-label")
        .attr("x", walkX(-6))
        .attr("y", walkY(firstPoint.value - 1.5))
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

      setTimeout(() => this.animate(), this.animationSpeed);
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

// *******************
// Other Helper Functions
// *******************

function getRandomNumberBetween(start, end) {
  return Math.random() * (end - start + 1) + start;
}

// *******************
// Activation Functions
// *******************

// Initialize tooltip once
const tooltip = d3.select("body").append("div").attr("class", "tooltip");

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
      "black",
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
}

function consolidatePalestinianLines() {
  return new Promise((resolve, reject) => {
    palestinianPermits.forEach((d) => {
      svg.select(`.palestinian-${d.year}-line-path`).attr("display", "block");
    });

    STEP_CONFIG.Y_START = CORE_Y_START;

    const consolidatedPermits = palestinianPermits.reduce(
      (sum, d) => sum + d.permits,
      0
    );

    console.log(consolidatedPermits);

    const consolidatedPathData = duBoisLine(
      consolidatedPermits,
      STEP_CONFIG.LENGTH,
      STEP_CONFIG.Y_START,
      STEP_CONFIG.Y_CHANGE,
      false,
      STEP_CONFIG.STEPS_UNTIL_TURN
    );

    let index_counter = 0;
    let transitionsCompleted = 0;
    const totalTransitions = palestinianPermits.length;

    if (totalTransitions === 0) {
      // No transitions to perform, resolve immediately
      resolve();
      return;
    }

    // Remove prior labels
    svg.selectAll("text").remove();

    // Grab year info
    const years = palestinianPermits.map((d) => d.year);
    const yearStart = d3.min(years);
    const yearEnd = d3.max(years);

    // Append a new consolidated label
    svg
      .append("text")
      .attr("class", "dubois-label")
      .attr("x", walkX(-6))
      .attr("y", walkY(consolidatedPathData[0].value - 1.5))
      .attr("dy", "-0.5em") // Adjust vertical position (above the point)
      .attr("fill", "black")
      .text(`${yearStart} - ${yearEnd}`);

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
        )
        .on("end", () => {
          transitionsCompleted++;
          if (transitionsCompleted === totalTransitions) {
            // All transitions complete

            if (consolidatedPermits > STEP_CONFIG.STEPS_UNTIL_TURN) {
              STEP_CONFIG.Y_START -=
                Math.floor(consolidatedPermits / STEP_CONFIG.STEPS_UNTIL_TURN) *
                  STEP_CONFIG.Y_CHANGE +
                STEP_CONFIG.Y_CHANGE;
            } else {
              STEP_CONFIG.Y_START -= STEP_CONFIG.Y_CHANGE;
            }

            // Resolve the promise after all transitions are done
            resolve();
          }
        });

      index_counter += d.permits - 1;
    });
  });
}

function unconsolidatePalestinianLines() {
  STEP_CONFIG.Y_START = CORE_Y_START;

  // Remove prior labels
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

    // Append new individual label
    svg
      .append("text")
      .attr("class", "dubois-label")
      .attr("x", walkX(-6))
      .attr("y", walkY(pathData[0].value - 1.5))
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
  const yearlyIsraeliPermits = 2000;
  const speedImprovementFactor = 2; // 2x faster than default
  const israeliLine = new AnimatedLine(
    lineGroup,
    `israeli-line-path`,
    "black",
    [
      yearlyIsraeliPermits / speedImprovementFactor,
      STEP_CONFIG.LENGTH * speedImprovementFactor,
      STEP_CONFIG.Y_START,
      STEP_CONFIG.Y_CHANGE,
      false,
      STEP_CONFIG.STEPS_UNTIL_TURN / speedImprovementFactor,
    ], // generatorParams: totalSteps, stepLength, initialY, yChange, Increment
    line,
    "2024 alone",
    0
  );

  console.log(Math.floor(2000 / STEP_CONFIG.STEPS_UNTIL_TURN));
  console.log(israeliLine.getData());
}

function hideIsraeliLines() {
  svg.selectAll(".israeli-line-path").attr("display", "none");
  svg.selectAll(".dubois-label").attr("display", "none");
}

function hidePalestinianLines() {
  palestinianPermits.forEach((d) => {
    svg.select(`.palestinian-${d.year}-line-path`).attr("display", "none");
  });
  svg.selectAll(".dubois-label").attr("display", "none");
}

function initiateDemolitionNodes() {
  // **1. Remove existing nodes**
  svg.selectAll("rect.nodes").remove();

  // **2. Stop existing simulation if any**
  if (simulation) {
    simulation.stop();
  }

  // **3. Instantiate a new force simulation**
  simulation = d3.forceSimulation(palestinianDemolitions);

  // **4. Ensure a single tooltip instance**
  let existingTooltip = d3.select(".tooltip");
  let tooltipInstance;
  if (existingTooltip.empty()) {
    tooltipInstance = d3.select("body").append("div").attr("class", "tooltip");
  } else {
    tooltipInstance = existingTooltip;
  }

  // **5. Define rectangle size**
  const RECT_SIZE = RECT.WIDTH; // Assuming RECT.WIDTH === RECT.HEIGHT

  // **6. Create nodes as rectangles**
  console.log("create rects...");
  nodes = svg
    .selectAll("rect.nodes") // Use a more specific selector to prevent duplicates
    .data(palestinianDemolitions)
    .enter()
    .append("rect")
    .attr("class", "nodes")
    .attr(
      "x",
      (d) =>
        walkX(
          getRandomNumberBetween(
            (CORE_XY_DOMAIN.END - CORE_XY_DOMAIN.START) / 8,
            ((CORE_XY_DOMAIN.END - CORE_XY_DOMAIN.START) / 8) * 7
          )
        ) -
        RECT_SIZE / 2
    ) // Center the rectangle
    .attr(
      "y",
      (d) =>
        walkY(
          getRandomNumberBetween(
            (CORE_XY_DOMAIN.END - CORE_XY_DOMAIN.START) / 8,
            ((CORE_XY_DOMAIN.END - CORE_XY_DOMAIN.START) / 8) * 7
          )
        ) -
        RECT_SIZE / 2
    ) // Center the rectangle
    .attr("width", (d) => d.housing_units ** (1 / 2) * RECT.WIDTH)
    .attr("height", (d) => d.housing_units ** (1 / 2) * RECT.HEIGHT)
    .attr("fill", "steelblue") // Set a visible fill color
    .attr("opacity", RECT.OPACITY)
    .on("mouseover", function (event, d) {
      if (d3.select(this).attr("opacity") > 0) {
        // Show the tooltip
        tooltipInstance
          .html(
            `<strong>Housing units:</strong> ${d.housing_units}<br>
            <strong>District:</strong> ${d.district}<br>
            <strong>Locality:</strong> ${d.locality}`
          )
          .style("left", `${event.pageX + 10}px`) // Position tooltip near the mouse
          .style("top", `${event.pageY + 10}px`)
          .classed("visible", true);

        // Highlight the node
        d3.select(this).classed("highlighted", true);
      }
    })
    .on("mousemove", function (event) {
      // Update tooltip position as the mouse moves
      tooltipInstance
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY + 10}px`);
    })
    .on("mouseout", function () {
      // Hide the tooltip when mouse moves away
      tooltipInstance.classed("visible", false);

      // Remove highlight
      d3.select(this).classed("highlighted", false);
    });

  console.log("done...");

  // **7. Define each tick of simulation**
  simulation
    .on("tick", () => {
      nodes
        .attr("x", (d) => d.x - RECT_SIZE / 2) // Center the rectangle
        .attr("y", (d) => d.y - RECT_SIZE / 2);
    })
    // **8. Define forces**
    .force(
      "forceX",
      d3
        .forceX((d) =>
          walkX(
            getRandomNumberBetween(
              (CORE_XY_DOMAIN.END - CORE_XY_DOMAIN.START) / 8,
              ((CORE_XY_DOMAIN.END - CORE_XY_DOMAIN.START) / 8) * 7
            )
          )
        )
        .strength(0.075)
    )
    .force(
      "forceY",
      d3
        .forceY((d) =>
          walkY(
            getRandomNumberBetween(
              (CORE_XY_DOMAIN.END - CORE_XY_DOMAIN.START) / 8,
              ((CORE_XY_DOMAIN.END - CORE_XY_DOMAIN.START) / 8) * 7
            )
          )
        )
        .strength(0.075)
    )
    .force(
      "collide",
      d3.forceCollide().radius(2).strength(0.7) // Adjusted collision radius
    );

  console.log(nodes);

  // **9. Restart the simulation**
  simulation.alpha(0.75).restart();
}

function showDemolitionNodes() {
  svg.selectAll(".nodes").style("display", "block");
}

function hideDemolitionNodes() {
  svg.selectAll(".nodes").style("display", "none");
}

function assignTargetPositions(
  baseLeftX,
  baseRightX,
  BUFFER_LEFT = 2,
  BUFFER_RIGHT = 20
) {
  palestinianDemolitions.forEach((d) => {
    if (d.skipOpacityChange) {
      // Left-moving node: randomize within [baseLeftX - BUFFER_X, baseLeftX + BUFFER_X]
      d.targetX = walkX(
        clamp(
          baseLeftX + getRandomNumberBetween(-BUFFER_LEFT, BUFFER_LEFT),
          0,
          100
        )
      );
    } else {
      // Right-moving node: randomize within [baseRightX - BUFFER_X, baseRightX + BUFFER_X]
      d.targetX = walkX(
        clamp(
          baseRightX + getRandomNumberBetween(-BUFFER_RIGHT, BUFFER_RIGHT),
          0,
          100
        )
      );
    }
  });
}

/**
 * Clamps a number between a minimum and maximum value.
 * @param {number} num - The number to clamp.
 * @param {number} min - The minimum allowable value.
 * @param {number} max - The maximum allowable value.
 * @returns {number} - The clamped number.
 */
function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

/**
 * Adds titled boxes above left and right node groups.
 */
function splitNodesLeftRight() {
  // **1. Assign random target positions**
  assignTargetPositions(10, 80);

  // **2. Update the force simulation**
  simulation
    .force(
      "forceX",
      d3.forceX((d) => d.targetX).strength(0.2) // Increased strength for more decisive movement
    )
    .force(
      "forceY",
      d3.forceY((d) => walkY(getRandomNumberBetween(0, 100))).strength(0.2) // Spread vertically
    )
    .alpha(0.75) // Ensure the simulation restarts effectively
    .restart();
}

function drawMap() {
  console.log("drawing map...");
  svg
    .append("foreignObject")
    .attr("width", ADJ_WIDTH)
    .attr("height", ADJ_HEIGHT)
    .attr("x", 0)
    .attr("y", MARGIN.TOP)
    .attr("class", "map-foreignobject")
    .append("xhtml:div")
    .attr("id", "map"); // this div will host the Mapbox map

  // Set your Mapbox access token
  mapboxgl.accessToken =
    "pk.eyJ1IjoibWljaGFlbC1jYWhhbmEiLCJhIjoiY202anoyYWs1MDB5NTJtcHdscXRpYWlmeSJ9.sKNNFh9wACNAHYN4ExzyWQ";

  // Initialize the Mapbox map
  const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/light-v11",
    center: [35.250088, 31.95],
    zoom: 7.9,
  });

  // Add zoom and rotation controls to the map.
  map.addControl(new mapboxgl.NavigationControl());

  map.on("load", () => {
    // Create an SVG layer
    d3.select("#map")
      .append("svg")
      .attr("class", "d3-overlay")
      .style("position", "absolute")
      .style("top", 0)
      .style("left", 0)
      .style("width", "100%")
      .style("height", "100%")
      .style("pointer-events", "none"); // Allow mouse events to pass through
  });
}

// *******************
// Scroll
// *******************

// Array of all visual functions
// To be called by the scroller functionality
let activationFunctions = [
  () => {
    unconsolidatePalestinianLines();
    hideIsraeliLines();
  },
  () => {},
  () => {
    consolidatePalestinianLines().then(drawIsraeliLines);
    hideDemolitionNodes();
  },
  () => {
    hideIsraeliLines();
    hidePalestinianLines();
    initiateDemolitionNodes();
  },
  () => {
    splitNodesLeftRight();
  },
  () => {
    drawMap();
  },
];

// Initialize scroller
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

// Reload on top of page
history.scrollRestoration = "manual";
