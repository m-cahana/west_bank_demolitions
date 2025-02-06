"use strict";
let svg;
let DOT_ADJUSTMENT_FACTOR = 1;
let ADJ_WIDTH, ADJ_HEIGHT;
let walkX, walkY, line, lineGroup;
let palestinianPermits, palestinianDemolitions;

let simulation, nodes;
let mapSvg, mapContainer, nodesOverlay;

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
    d.skipOpacityChange = Math.random() < 0.01; // 5% chance to skip opacity change
    d.id = index;

    d.date_of_demolition = new Date(d.date_of_demolition);

    d.offsetX = getRandomOffset(BUFFER_RANGE);
    d.offsetY = getRandomOffset(BUFFER_RANGE);
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
      .text("Palestinian permits granted in a decade");

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
    .text("Israeli permits granted in a single year");
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

  // Define centering margins (adjust based on your SVG size and desired centering)
  const CENTERING_MARGIN_X = ADJ_WIDTH;
  const CENTERING_MARGIN_Y = ADJ_HEIGHT;

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
            <strong>District:</strong> ${d.district}<br>
            <strong>Date:</strong> ${d.date_of_demolition}`
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
  BUFFER_RIGHT = 20
) {
  palestinianDemolitions.forEach((d) => {
    if (d.skipOpacityChange) {
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

function drawMap() {
  // Set your Mapbox access token
  mapboxgl.accessToken =
    "pk.eyJ1IjoibWljaGFlbC1jYWhhbmEiLCJhIjoiY202anoyYWs1MDB5NTJtcHdscXRpYWlmeSJ9.sKNNFh9wACNAHYN4ExzyWQ";

  // Initialize the Mapbox map
  const map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/light-v11",
    center: [35.1, 31.925], // [lng, lat]
    zoom: 7.8,
  });

  // Add zoom and rotation controls to the map.
  map.addControl(new mapboxgl.NavigationControl());

  // Once the map loads, create an SVG overlay for D3 elements
  map.on("load", () => {
    // Save references to the map and overlay SVG for later use
    // Since we're avoiding the window object, we'll manage these within closures or pass them as parameters
    initiateNodeTransition(map);
  });
}
function hideMap() {
  // Select and hide only the map canvas(es)
  d3.select("#map").selectAll(".mapboxgl-canvas").style("display", "none");

  d3.selectAll(
    ".mapboxgl-ctrl-container, .mapboxgl-ctrl, .mapboxgl-control"
  ).style("display", "none");
}

function initiateNodeTransition(map) {
  // select existing nodes
  const nodes = svg.selectAll("rect.nodes");

  function updateNodePositions() {
    nodes
      .attr(
        "x",
        (d) =>
          map.project([d.long, d.lat]).x +
          d.offsetX -
          (d.housing_units ** 0.5 * RECT.WIDTH) / 2
      )
      .attr(
        "y",
        (d) =>
          map.project([d.long, d.lat]).y +
          d.offsetY -
          (d.housing_units ** 0.5 * RECT.HEIGHT) / 2
      );
  }

  // animate transition
  nodes
    .raise()
    .transition()
    .duration(2000) // Duration of the transition in milliseconds
    .attr(
      "x",
      (d) =>
        map.project([d.long, d.lat]).x +
        d.offsetX -
        (d.housing_units ** 0.5 * RECT.WIDTH) / 2
    )
    .attr(
      "y",
      (d) =>
        map.project([d.long, d.lat]).y +
        d.offsetY -
        (d.housing_units ** 0.5 * RECT.HEIGHT) / 2
    )
    .on("end", () => {
      console.log("Node transition to map completed.");
    });

  simulation.stop();

  // optional: Update node positions if map is moved later
  map.on("move", updateNodePositions);
  map.on("zoom", updateNodePositions);
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
  },
  () => {
    removePermitLabels();
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
