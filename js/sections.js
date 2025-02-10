"use strict";
let svg;
let DOT_ADJUSTMENT_FACTOR = 1;
let ADJ_WIDTH, ADJ_HEIGHT;
let walkX, walkY, line, lineGroup;
let palestinianPermits, palestinianDemolitions, demolitionDates;
let simulation, nodes;
let map, mapSvg, mapContainer;
let fastConsolidate = false;
let israeliLineRedraw = true;
let mapGenerate = true;
let nodesOverlay;

let CORE_MARGIN = { LEFT: 150, RIGHT: 100, TOP: 50, BOTTOM: 20 };
let CORE_XY_DOMAIN = { START: 0, END: 100 };
let MARGIN = { LEFT: 150, RIGHT: 100, TOP: 50, BOTTOM: 20 };
let WIDTH = 800;
let HEIGHT = 500;
let HEIGHT_WIDTH_RATIO = HEIGHT / WIDTH;

const DOT = { RADIUS: 5, OPACITY: 0.5 };
const RECT = { WIDTH: 5, HEIGHT: 5, OPACITY: 0.5, DEMOLISHED_OPACITY: 0.1 };

let CORE_Y_START = 100;
let STEP_CONFIG = {
  LENGTH: 1,
  Y_CHANGE: 5,
  Y_START: CORE_Y_START,
  get STEPS_UNTIL_TURN() {
    return 100 / this.LENGTH;
  },
};

const PERMIT_TEXT = { width_padding: 10, height_padding: 10 };
const permitCategories = {
  Granted: [20, 1],
  Rejected: [70, 99],
};

const permitNames = Object.keys(permitCategories);

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

  palestinianPermits = data.filter((d) => (d.year > 2010) & (d.year <= 2020));

  setTimeout(drawInitial, 100);
});

// Demolitions
d3.csv("data/processed/demolitions.csv").then((data) => {
  // Convert column names to lowercase with underscores
  const BUFFER_RANGE = 10;

  data.forEach((d, index) => {
    d.housing_units = Number(d.housing_units);
    d.minors_left_homeless = Number(d.minors_left_homeless);
    d.people_left_homeless = Number(d.people_left_homeless);
    d.lat = Number(d.lat);
    d.long = Number(d.long);
    d.crossed = false;
    d.simulateGrant = Math.random() < 0.01; // 1% chance to skip opacity change
    d.id = index;

    d.date_of_demolition = new Date(d.date_of_demolition);

    d.offsetX = getRandomOffset(BUFFER_RANGE);
    d.offsetY = getRandomOffset(BUFFER_RANGE);
  });

  palestinianDemolitions = data.filter(
    (d) => d.date_of_demolition >= new Date("2011-01-01")
  );

  // *******************
  // Stratified Sampling: 20% Representative Sample
  // *******************

  // Group demolitions by locality
  const groupedByLocality = d3.group(palestinianDemolitions, (d) => d.locality);

  /**
   * Samples a percentage of items from an array.
   * @param {Array} array - The array to sample from.
   * @param {number} percentage - The percentage to sample (0-100).
   * @returns {Array} - The sampled subset of the array.
   */
  function samplePercentage(array, percentage) {
    const sampleSize = Math.floor(array.length * (percentage / 100));
    if (sampleSize <= 0 && array.length > 0)
      return [array[Math.floor(Math.random() * array.length)]];
    const shuffled = array.slice(); // Shallow copy
    // Fisher-Yates shuffle
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled.slice(0, sampleSize);
  }

  const samplePercentageValue = 10; // 20%
  const minSampleSize = 1; // Minimum samples per group

  const sampledData = Array.from(
    groupedByLocality,
    ([locality, demolitions]) => {
      let sample = samplePercentage(demolitions, samplePercentageValue);
      if (sample.length === 0 && demolitions.length > 0) {
        // Ensure at least one sample if the group is not empty
        sample = [demolitions[Math.floor(Math.random() * demolitions.length)]];
      }
      return sample;
    }
  ).flat();

  console.log(`Total Demolitions: ${palestinianDemolitions.length}`);
  console.log(`Sampled Demolitions: ${sampledData.length}`);

  // Replace palestinianDemolitions with sampledData for subsequent operations
  palestinianDemolitions = sampledData;

  // Proceed with drawing or further processing
  // e.g., setTimeout(drawInitial, 100);

  demolitionDates = [
    ...new Set(palestinianDemolitions.map((d) => d.date_of_demolition)),
  ].sort((a, b) => a - b);

  console.log(palestinianDemolitions);
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
    animationSpeed = 5,
    strokeWidth = 3
  ) {
    this.data = [];
    this.generatorData = duBoisLine(...generatorParams); // Now an array
    this.currentIndex = 0; // To track the animation progress
    this.path = lineGroup
      .append("path")
      .attr("class", className)
      .attr("stroke", color)
      .attr("fill", "none")
      .attr("stroke-width", strokeWidth);
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

function getRandomOffset(range) {
  return (Math.random() - 0.5) * 2 * range;
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

  // some map constants
  mapContainer = svg
    .append("g")
    .attr("class", "map-container")
    .attr("transform", `translate(${MARGIN.LEFT}, ${MARGIN.TOP})`);

  // Append a div for Mapbox inside the map container
  mapContainer
    .append("foreignObject")
    .attr("width", ADJ_WIDTH)
    .attr("height", ADJ_HEIGHT)
    .append("xhtml:div")
    .attr("id", "map") // This div will host the Mapbox map
    .style("position", "relative")
    .style("width", "100%")
    .style("height", "100%");

  mapSvg = d3
    .select("#map")
    .append("svg")
    .attr("class", "map-overlay")
    .style("width", "100%")
    .style("height", "100%")
    .style("position", "absolute")
    .style("top", 0)
    .style("left", 0)
    .style("pointer-events", "none");

  // Create a dedicated group for D3 nodes within the overlay SVG
  nodesOverlay = mapSvg.append("g").attr("class", "nodes-overlay");
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
    svg.selectAll(".dubois-label").attr("display", "none");

    // Grab year info
    const years = palestinianPermits.map((d) => d.year);
    const yearStart = d3.min(years);
    const yearEnd = d3.max(years);

    // Append a new consolidated label
    svg
      .append("text")
      .attr("class", "dubois-label-decade")
      .attr("x", walkX(15))
      .attr("y", walkY(consolidatedPathData[0].value + 3))
      .attr("text-anchor", "start")
      .attr("fill", "black")
      .text("Permits granted to Palestinians in a decade");

    palestinianPermits.forEach((d) => {
      svg
        .select(`.palestinian-${d.year}-line-path`)
        .transition()
        .duration(fastConsolidate ? 0 : 1000) // duration in milliseconds
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
            fastConsolidate = true;

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
  fastConsolidate = false;
  israeliLineRedraw = true;
  STEP_CONFIG.Y_START = CORE_Y_START;

  // show prior labels, remove aggregate
  svg.selectAll(".dubois-label").attr("display", "block");
  svg.selectAll(".dubois-label-decade").attr("display", "none");

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
  if (!israeliLineRedraw) {
    svg.selectAll(".dubois-label-year").attr("display", "block");
    svg.selectAll(".israeli-line-path").attr("display", "block");
    return; // Exit the function to prevent duplicate drawing
  } else {
    if (svg.select(".dubois-label-year").empty() === false) {
      svg.select(".dubois-label-year").remove();
      svg.select(".israeli-line-path").remove();
    }
    const yearlyIsraeliPermits = 2000;
    const speedImprovementFactor = 2; // 2x faster than default
    const israeliLine = new AnimatedLine(
      lineGroup,
      `israeli-line-path`,
      "black",
      [
        yearlyIsraeliPermits / speedImprovementFactor,
        STEP_CONFIG.LENGTH * speedImprovementFactor,
        STEP_CONFIG.Y_START - 1,
        STEP_CONFIG.Y_CHANGE,
        false,
        STEP_CONFIG.STEPS_UNTIL_TURN / speedImprovementFactor,
      ], // generatorParams: totalSteps, stepLength, initialY, yChange, Increment
      line,
      0
    );

    // Append a new consolidated label
    svg
      .append("text")
      .attr("class", "dubois-label-year")
      .attr("x", walkX(14.2))
      .attr("y", walkY(STEP_CONFIG.Y_START + 1.75))
      .attr("text-anchor", "start")
      .attr("fill", "black")
      .text("Permits granted to Israelis in a single year");
  }
}

function hideIsraeliLines() {
  svg.selectAll(".israeli-line-path").attr("display", "none");
  svg.selectAll(".dubois-label-year").attr("display", "none");
}

function hidePalestinianLines() {
  palestinianPermits.forEach((d) => {
    svg.select(`.palestinian-${d.year}-line-path`).attr("display", "none");
  });
  svg.selectAll(".dubois-label").attr("display", "none");
  svg.selectAll(".dubois-label-decade").attr("display", "none");
}

function initiateDemolitionNodes() {
  israeliLineRedraw = false;

  // **1. Remove existing nodes**
  svg.selectAll("rect.nodes").remove();

  // **2. Stop existing simulation if any**
  if (simulation) {
    simulation.stop();
  }

  // **3. Instantiate a new force simulation**
  simulation = d3.forceSimulation(palestinianDemolitions);

  // **5. Define rectangle size**
  const RECT_SIZE = RECT.WIDTH; // Assuming RECT.WIDTH === RECT.HEIGHT

  // **6. Create nodes as rectangles**
  nodes = svg
    .select(".nodes-overlay")
    .selectAll("rect.nodes") // Use a more specific selector to prevent duplicates
    .data(palestinianDemolitions)
    .enter()
    .append("rect")
    .attr("class", "nodes")
    .style("pointer-events", "all")
    .attr("width", (d) => d.housing_units ** (1 / 2) * RECT.WIDTH)
    .attr("height", (d) => d.housing_units ** (1 / 2) * RECT.HEIGHT)
    .attr("opacity", RECT.OPACITY)
    .on("mouseover", function (event, d) {
      console.log("mouseover");
      if (d3.select(this).attr("opacity") > 0) {
        tooltip
          .html(
            `<strong>Housing units:</strong> ${d.housing_units}<br>
            <strong>Locality:</strong> ${d.locality}<br>
            <strong>District:</strong> ${d.district}<br>`
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
      tooltip
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY + 10}px`);
    })
    .on("mouseout", function () {
      // Hide the tooltip when mouse moves away
      tooltip.classed("visible", false);

      // Remove highlight
      d3.select(this).classed("highlighted", false);
    });

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
              ((CORE_XY_DOMAIN.END - CORE_XY_DOMAIN.START) / 8) * -1,
              ((CORE_XY_DOMAIN.END - CORE_XY_DOMAIN.START) / 8) * 5
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
  BUFFER_RIGHT = 30
) {
  palestinianDemolitions.forEach((d) => {
    if (d.simulateGrant) {
      // Left-moving node: randomize within [baseLeftX - BUFFER_X, baseLeftX + BUFFER_X]
      d.targetX = walkX(
        baseLeftX + getRandomNumberBetween(-BUFFER_LEFT, BUFFER_LEFT)
      );
    } else {
      // Right-moving node: randomize within [baseRightX - BUFFER_X, baseRightX + BUFFER_X]
      d.targetX = walkX(
        baseRightX + getRandomNumberBetween(-BUFFER_RIGHT, BUFFER_RIGHT)
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
  const BOUNDS = { LEFT: -10, RIGHT: 42.5, TOP: 90, BOTTOM: 0 };

  assignTargetPositions(BOUNDS.LEFT, BOUNDS.RIGHT);

  // **2. Update the force simulation**
  simulation
    .force(
      "forceX",
      d3.forceX((d) => d.targetX).strength(0.2) // Increased strength for more decisive movement
    )
    .force(
      "forceY",
      d3
        .forceY((d) => walkY(getRandomNumberBetween(BOUNDS.BOTTOM, BOUNDS.TOP)))
        .strength(0.2) // Spread vertically
    )
    .alpha(0.75) // Ensure the simulation restarts effectively
    .restart();

  const permitLabels = svg.append("g").attr("class", "permit-labels");

  permitLabels
    .selectAll(".permit-label")
    .data(permitNames)
    .enter()
    .append("g")
    .attr("class", "permit-label")
    .attr(
      "transform",
      (d) =>
        `translate(${walkX(permitCategories[d][0])}, ${walkY(BOUNDS.TOP - 5)})`
    )
    .each(function (d) {
      const g = d3.select(this);

      // append text
      const text = g
        .append("text")
        .text(`${d} (${permitCategories[d][1]}%)`)
        .attr("class", "label-text");

      // get the bounding box of the text
      const bbox = text.node().getBBox();

      // append rectangle behind the text
      g.insert("rect", "text")
        .attr("class", "label-rect")
        .attr("x", bbox.x - PERMIT_TEXT.width_padding)
        .attr("y", bbox.y - PERMIT_TEXT.height_padding)
        .attr("width", bbox.width + 2 * PERMIT_TEXT.width_padding)
        .attr("height", bbox.height + 2 * PERMIT_TEXT.height_padding);
    });
}

function removePermitLabels() {
  svg.selectAll("g.permit-labels").remove();
}

function hideGrantedPermits() {
  nodes.attr("opacity", (d) => (d.simulateGrant ? 0 : RECT.OPACITY));
}

function showGrantedPermits() {
  nodes.attr("opacity", RECT.OPACITY);
}

const AnimationController = (function () {
  let currentIndex = 0;
  let isPaused = false;
  let timeoutId = null;

  // define speeds
  const animationSpeed = 5000; // 5 seconds per plate

  // function to add a point and update the map
  function fadeBlocks(currentDate) {
    const formattedYear = currentDate.getFullYear();

    nodes.attr("opacity", (d) =>
      d.date_of_demolition <= currentDate
        ? RECT.DEMOLISHED_OPACITY
        : RECT.OPACITY
    );

    d3.select("#map").select("#date-display").text(`Year: ${formattedYear}`);
  }

  // function to iterate through all dates
  function iterateDates() {
    if (currentIndex >= demolitionDates.length) {
      // stop the animation when all dates have been processed
      return;
    }

    const currentDate = demolitionDates[currentIndex];

    // add points if any
    fadeBlocks(currentDate);
    currentIndex++;

    // schedule the next iteration
    timeoutId = setTimeout(() => {
      if (!isPaused) {
        iterateDates();
      }
    }, animationSpeed / demolitionDates.length);
  }

  return {
    start: function () {
      isPaused = false;
      currentIndex = 0;
      iterateDates(demolitionDates);
    },
    pause: function () {
      isPaused = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
    resume: function () {
      if (!isPaused) return;
      isPaused = false;
      iterateDates();
    },
  };
})();

function drawMap() {
  if (mapGenerate) {
    // Set your Mapbox access token
    mapboxgl.accessToken =
      "pk.eyJ1IjoibWljaGFlbC1jYWhhbmEiLCJhIjoiY202anoyYWs1MDB5NTJtcHdscXRpYWlmeSJ9.sKNNFh9wACNAHYN4ExzyWQ";

    // Initialize the Mapbox map
    map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/light-v11",
      center: [35.1, 31.925], // [lng, lat]
      zoom: 7.8,
    });

    // Add zoom and rotation controls to the map.
    map.addControl(new mapboxgl.NavigationControl());
  } else {
    d3.select("#map").selectAll(".mapboxgl-canvas").style("display", "block");

    d3.select("#map").select("#date-display").style("display", "block");

    d3.selectAll(
      ".mapboxgl-ctrl-container, .mapboxgl-ctrl, .mapboxgl-control"
    ).style("display", "block");

    (async () => {
      try {
        // Await the completion of node transitions
        await initiateNodeTransition(map);
        // Start the animation after transitions are complete
        AnimationController.start();
      } catch (error) {
        console.error("Error during node transition:", error);
      }
    })();
  }

  // Select existing 'date-display' or create it if it doesn't exist
  let dateDisplay = d3.select("#map").select("#date-display");
  if (dateDisplay.empty()) {
    dateDisplay = d3
      .select("#map")
      .append("div")
      .attr("id", "date-display")
      .style("position", "absolute")
      .text(`Year: ${demolitionDates[0].getFullYear()}`)
      .style("display", "block");
  } else {
    // If it exists, ensure it's visible
    dateDisplay
      .text(`Year: ${demolitionDates[0].getFullYear()}`)
      .style("display", "block");
  }

  function adjustMapBounds() {
    // calculate the bounding box
    const bounds = new mapboxgl.LngLatBounds();

    // extract coordinates
    const coordinates = palestinianDemolitions.map((d) => [d.long, d.lat]);

    coordinates.forEach((coord) => {
      bounds.extend(coord);
    });

    // fit the map to the calculated bounds with padding
    map.fitBounds(bounds, {
      padding: 50 * DOT_ADJUSTMENT_FACTOR,
      duration: 1000, // duration in milliseconds for the animation
      essential: true, // ensure animation is not affected by user preferences
    });
  }

  // Once the map loads, create an SVG overlay for D3 elements
  map.on("load", async () => {
    try {
      // Await the completion of node transitions
      await initiateNodeTransition(map);
      // Start the animation after transitions are complete
      AnimationController.start();
    } catch (error) {
      console.error("Error during node transition:", error);
    }
  });
}

function hideMap() {
  // Select and hide only the map canvas(es)
  d3.select("#map").selectAll(".mapboxgl-canvas").style("display", "none");

  d3.select("#map").select("#date-display").style("display", "none");

  d3.selectAll(
    ".mapboxgl-ctrl-container, .mapboxgl-ctrl, .mapboxgl-control"
  ).style("display", "none");
}

/**
 * calculates the number of columns and rows for a grid layout.
 *
 * @param {number} N - Number of tiles.
 * @param {number} svgWidth - Width of the SVG.
 * @param {number} svgHeight - Height of the SVG.
 * @returns {Object} - Contains the number of columns, rows, and tile size.
 */
function calculateGridLayout(N, svgWidth, svgHeight) {
  const aspectRatio = svgWidth / svgHeight;

  // Initial estimation of columns based on aspect ratio
  let cols = Math.ceil(Math.sqrt(N * aspectRatio));
  let rows = Math.ceil(N / cols);

  // Adjust columns and rows to ensure all tiles fit
  while (cols * rows < N) {
    cols += 1;
    rows = Math.ceil(N / cols);
  }

  // Calculate tile size based on grid layout
  const tileWidth = svgWidth / cols;
  const tileHeight = svgHeight / rows;

  // Ensure tiles are squares by using the smaller dimension
  const tileSize = Math.min(tileWidth, tileHeight);

  return { cols, rows, tileSize };
}

function stackNodesByDistrict() {
  // Aggregate data by district
  const aggregatedData = d3.rollups(
    palestinianDemolitions,
    (v) => d3.sum(v, (d) => d.people_left_homeless),
    (d) => d.district // Grouping by 'district'
  );

  // Sort data by the number of people left homeless (descending)
  aggregatedData.sort((a, b) => d3.descending(a[1], b[1]));

  // Set dimensions for the bar chart
  const margin = { top: 50, right: 30, bottom: 100, left: 60 };
  const width = ADJ_WIDTH - margin.left - margin.right;
  const height = ADJ_HEIGHT - margin.top - margin.bottom;

  // Remove existing bar chart if any
  svg.selectAll(".bar-chart").remove();

  // Append a new group for the bar chart
  const barChart = svg
    .append("g")
    .attr("class", "bar-chart")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Set up scales
  const x = d3
    .scaleBand()
    .domain(aggregatedData.map((d) => d[0]))
    .range([0, width])
    .padding(0.2);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(aggregatedData, (d) => d[1]) * 1.1])
    .nice()
    .range([height, 0]);

  // Add X axis
  barChart
    .append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "translate(-10,0)rotate(-45)")
    .style("text-anchor", "end");

  // Add Y axis
  barChart.append("g").call(d3.axisLeft(y));

  // Add Y axis label
  barChart
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left + 15)
    .attr("x", -height / 2)
    .attr("dy", "-1.5em")
    .style("text-anchor", "middle")
    .text("Number of People Left Homeless");

  // Add X axis label
  barChart
    .append("text")
    .attr("x", width / 2)
    .attr("y", height + margin.bottom - 40)
    .style("text-anchor", "middle")
    .text("Districts");

  // Create a group for each bar (district)
  const barGroups = barChart
    .selectAll(".bar-group")
    .data(aggregatedData)
    .enter()
    .append("g")
    .attr("class", "bar-group")
    .attr("transform", (d) => `translate(${x(d[0])},0)`);

  // Group nodes by district
  const nodesByDistrict = d3.group(palestinianDemolitions, (d) => d.district);

  // Define a scale for stacking nodes vertically within bars
  const stackScale = d3
    .scaleLinear()
    .domain([0, d3.max(aggregatedData, (d) => d[1])])
    .range([height, 0]);

  // Position existing nodes within the bar chart
  nodes
    .attr("display", "none") // Hide nodes initially
    .filter((d) => d.district) // Ensure district exists
    .each(function (d) {
      // Select the corresponding bar group
      const barGroup = barChart
        .selectAll(".bar-group")
        .filter(function (barData) {
          return barData[0] === d.district;
        });

      if (!barGroup.empty()) {
        // Calculate the y-position based on cumulative people left homeless
        const cumulativeData = nodesByDistrict
          .get(d.district)
          .filter((nd) => nd.people_left_homeless <= d.people_left_homeless);
        const cumulativeSum = d3.sum(
          cumulativeData,
          (nd) => nd.people_left_homeless
        );

        // Define the position within the bar
        const barY =
          y(cumulativeSum) -
          (Math.sqrt(d.people_left_homeless) * RECT.HEIGHT) / 2;

        // Position the node within the bar
        d3.select(this)
          .attr("x", x(d.district) + x.bandwidth() / 4) // Center within the bar
          .attr("y", margin.top + barY)
          .attr("width", x.bandwidth() / 2)
          .attr("height", Math.sqrt(d.people_left_homeless) * RECT.HEIGHT)
          .attr("fill", "#404080")
          .attr("opacity", 0.6)
          .attr("display", "block"); // Show the node
      }
    })
    .on("mouseover", function (event, d) {
      tooltip
        .html(
          `<strong>District:</strong> ${d.district}<br>
           <strong>People Left Homeless:</strong> ${d.people_left_homeless}<br>`
        )
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY + 10}px`)
        .classed("visible", true);

      // Highlight the node
      d3.select(this).classed("highlighted", true);
    })
    .on("mousemove", function (event) {
      // Update tooltip position as the mouse moves
      tooltip
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY + 10}px`);
    })
    .on("mouseout", function () {
      // Hide the tooltip when mouse moves away
      tooltip.classed("visible", false);

      // Remove highlight
      d3.select(this).classed("highlighted", false);
    });
}

function rectSVG() {
  svg
    .attr("width", ADJ_WIDTH + MARGIN.LEFT + MARGIN.RIGHT)
    .attr("height", ADJ_HEIGHT + MARGIN.TOP + MARGIN.BOTTOM)
    .transition()
    .duration(0) // Adjust duration as needed
    .attr("transform", `translate(0,0)`);
}

function boxSVG() {
  const newWidth = Math.min(ADJ_HEIGHT, ADJ_WIDTH) + MARGIN.LEFT + MARGIN.RIGHT;
  const newHeight =
    Math.min(ADJ_HEIGHT, ADJ_WIDTH) + MARGIN.TOP + MARGIN.BOTTOM;

  // Calculate the difference between old and new sizes
  const deltaX = (ADJ_WIDTH + MARGIN.LEFT + MARGIN.RIGHT - newWidth) / 2;
  const deltaY = (ADJ_HEIGHT + MARGIN.TOP + MARGIN.BOTTOM - newHeight) / 2;

  svg
    .attr("width", Math.min(ADJ_HEIGHT, ADJ_WIDTH) + MARGIN.LEFT + MARGIN.RIGHT)
    .attr(
      "height",
      Math.min(ADJ_HEIGHT, ADJ_WIDTH) + MARGIN.TOP + MARGIN.BOTTOM
    )
    .transition()
    .duration(1000) // Adjust duration as needed
    .attr("transform", `translate(${deltaX}, ${deltaY})`);
}
/**
 * tiles selection of nodes into a grid layout covering the entire SVG.
 */
function tileNodes() {
  // number of nodes to display
  const N = 9;

  // shuffle the nodes array and select the first N nodes
  const shuffled = palestinianDemolitions
    .slice()
    .sort(() => 0.5 - Math.random());

  const selectedNodesTwo = palestinianDemolitions.filter(
    (d) =>
      d.locality == "Masafer Yatta" ||
      (d.locality == "a-Rakeez" && d.people_left_homeless == 12) ||
      (d.locality == "al-Walajah" && d.people_left_homeless == 5) ||
      (d.locality == "al-Walajah" && d.people_left_homeless == 5) ||
      (d.locality == "Um al-Kheir" && d.people_left_homeless == 15)
  );
  const selectedNodes = shuffled.slice(0, N);

  const { cols, rows, tileSize } = calculateGridLayout(
    N,
    ADJ_HEIGHT,
    ADJ_HEIGHT
  );

  // assign each selected node to a grid cell
  selectedNodes.forEach((d, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;

    // Calculate target position
    d.tileTargetX = col * tileSize;
    d.tileTargetY = row * tileSize;

    // Set target size to tileSize
    d.targetWidth = tileSize;
    d.targetHeight = tileSize;
  });

  // Define the pattern
  const defs = svg.append("defs");

  defs
    .append("pattern")
    .attr("id", "tile-image") // Unique identifier for the pattern
    .attr("patternUnits", "objectBoundingBox") // Scale pattern relative to the tile
    .attr("patternContentUnits", "objectBoundingBox") // Scale content relative to the pattern
    .attr("width", 1) // Full width of the bounding box
    .attr("height", 1) // Full height of the bounding box
    .append("image")
    .attr("href", "images/khirbet_main_demolition.jpg") // Path to your image
    .attr("preserveAspectRatio", "xMidYMid slice") // Adjust how the image scales within the pattern
    .attr("width", 1) // Full width of the pattern
    .attr("height", 1); // Full height of the pattern

  // Select the tile nodes and hide others
  const tiles = nodes.filter((d) => selectedNodes.includes(d));
  nodes.filter((d) => !selectedNodes.includes(d)).attr("opacity", 0);

  // Transition selected nodes to their grid positions and sizes
  tiles
    .transition()
    .duration(1000)
    .attr("opacity", RECT.OPACITY)
    .style("fill", "url(#tile-image)") // Apply the pattern fill
    .style("stroke", "white")
    .style("stroke-width", 1)
    .attr("x", (d) => d.tileTargetX)
    .attr("y", (d) => d.tileTargetY)
    .attr("width", (d) => d.targetWidth)
    .attr("height", (d) => d.targetHeight)
    .on("end", function (event, d) {
      // Optionally, handle post-transition logic here
      d3.select(this).classed("tiled", true);
    });
}

function initiateNodeTransition(map) {
  function setNodePositions(selection, map) {
    selection
      .attr(
        "x",
        (d) =>
          map.project([d.long, d.lat]).x +
          d.offsetX -
          (Math.sqrt(d.housing_units) * RECT.WIDTH) / 2
      )
      .attr(
        "y",
        (d) =>
          map.project([d.long, d.lat]).y +
          d.offsetY -
          (Math.sqrt(d.housing_units) * RECT.HEIGHT) / 2
      );
  }

  function updateNodePositions() {
    setNodePositions(nodes, map);
  }

  // update node positions if map is moved later
  map.on("move", updateNodePositions);
  map.on("zoom", updateNodePositions);

  // animate transition
  return new Promise((resolve, reject) => {
    nodes
      .raise()
      .transition()
      .duration(1000)
      // ensure proper widths and heights
      .style("stroke", "black")
      .attr("width", (d) => d.housing_units ** (1 / 2) * RECT.WIDTH)
      .attr("height", (d) => d.housing_units ** (1 / 2) * RECT.HEIGHT)
      .call(setNodePositions, map)
      .on("end", () => {
        console.log("Node transition to map completed.");
        resolve();
      });

    simulation.stop();
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
    removePermitLabels();
  },
  () => {
    splitNodesLeftRight();
    hideMap();
    showGrantedPermits();
    AnimationController.pause();
  },
  () => {
    removePermitLabels();
    hideGrantedPermits();
    drawMap();
    rectSVG();
  },
  () => {
    boxSVG();
    mapGenerate = false;
    hideMap();
    tileNodes();
    AnimationController.pause();
  },
];

// Initialize scroller
let scroll = scroller().container(d3.select("#graphic"));
scroll();
let lastIndex = 0;
let activeIndex = 0;
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
