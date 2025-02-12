"use strict";

// *******************
// variable setup
// *******************

let svg;
let RECT_ADJUSTMENT_FACTOR = 1;
let ADJ_WIDTH, ADJ_HEIGHT;
let walkX, walkY, line, lineGroup;
let palestinianPermits, palestinianDemolitions, demolitionDates;
let simulation, nodes;
let map, mapSvg, mapContainer;
let fastConsolidate = false;
let israeliLineRedraw = true;
let mapGenerate = true;
let nodesOverlay;
let animationController;

let CORE_MARGIN = { LEFT: 150, RIGHT: 100, TOP: 50, BOTTOM: 20 };
let CORE_XY_DOMAIN = { START: 0, END: 100 };
let MARGIN = { LEFT: 150, RIGHT: 100, TOP: 50, BOTTOM: 20 };
let WIDTH = 800;
let HEIGHT = 500;
let HEIGHT_WIDTH_RATIO = HEIGHT / WIDTH;

const RECT = {
  WIDTH: 5,
  HEIGHT: 5,
  OPACITY: 0.5,
  DEMOLISHED_OPACITY: 0.1,
  TILE_OPACITY: 0.7,
};

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

const tileLocalities = (d) =>
  d.locality === "Masafer Yatta" ||
  (d.locality === "a-Rakeez" && d.people_left_homeless === 12) ||
  (d.locality === "al-Walajah" && d.people_left_homeless === 14) ||
  (d.locality === "Um al-Kheir" && d.people_left_homeless === 15) ||
  (d.locality === "Khan al-Ahmar (Bedouin Community)" &&
    d.people_left_homeless === 16) ||
  (d.locality === "Kh. Jenbah" && d.people_left_homeless === 13) ||
  (d.locality === "Kh. Ma'in" && d.people_left_homeless === 7);

// *******************
// function imports
// *******************

import { scroller } from "./scroller.js";
import { getPalestinianPermits, loadDemolitionsData } from "./data.js";
import {
  duBoisLine,
  AnimatedLine,
  consolidatePalestinianLines,
  unconsolidatePalestinianLines,
  drawIsraeliLines,
  hideIsraeliLines,
  hidePalestinianLines,
} from "./lines.js";
import {
  initiateDemolitionNodes,
  hideDemolitionNodes,
  splitNodesLeftRight,
  removePermitLabels,
  hideGrantedPermits,
  showGrantedPermits,
} from "./demolition_nodes.js";
import { AnimationController, drawMap, hideMap } from "./map.js";
import { rectSVG, boxSVG, tileNodes } from "./tiles.js";

// *******************
// data read-in
// *******************

async function initialize() {
  try {
    // Load Permits
    palestinianPermits = await getPalestinianPermits();

    // Load Demolitions
    const demolitionsData = await loadDemolitionsData();
    palestinianDemolitions = demolitionsData.palestinianDemolitions;
    demolitionDates = demolitionsData.demolitionDates;

    drawInitial();
    // Other initialization code can be placed here
  } catch (error) {
    console.error("Error loading data:", error);
  }
}

initialize();

// *******************
// activation functions
// *******************

// Initialize tooltip once
const tooltip = d3.select("body").append("div").attr("class", "tooltip");

function drawInitial() {
  const container = document.getElementById("vis");
  const containerWidth = container.clientWidth;

  ADJ_WIDTH = Math.min(WIDTH, containerWidth);
  ADJ_HEIGHT = ADJ_WIDTH * HEIGHT_WIDTH_RATIO;

  RECT_ADJUSTMENT_FACTOR = ADJ_WIDTH / WIDTH;

  MARGIN = Object.keys(CORE_MARGIN).reduce((acc, key) => {
    acc[key] = CORE_MARGIN[key] * RECT_ADJUSTMENT_FACTOR;
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
      walkX,
      walkY,
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

// *******************
// scroll
// *******************

// Array of all visual functions
// To be called by the scroller functionality
let activationFunctions = [
  () => {
    ({ fastConsolidate, israeliLineRedraw } = unconsolidatePalestinianLines(
      fastConsolidate,
      israeliLineRedraw,
      svg,
      palestinianPermits,
      STEP_CONFIG,
      CORE_Y_START,
      line
    ));
    hideIsraeliLines(svg);
  },
  () => {},
  () => {
    fastConsolidate = consolidatePalestinianLines(
      palestinianPermits,
      STEP_CONFIG,
      svg,
      walkX,
      walkY,
      CORE_Y_START,
      fastConsolidate,
      line
    ).then(() => {
      drawIsraeliLines(
        israeliLineRedraw,
        svg,
        walkX,
        walkY,
        lineGroup,
        line,
        STEP_CONFIG
      );
    });
    hideDemolitionNodes(svg);
  },
  () => {
    hideIsraeliLines(svg);
    hidePalestinianLines(palestinianPermits, svg);
    ({ simulation, nodes, israeliLineRedraw } = initiateDemolitionNodes(
      nodes,
      israeliLineRedraw,
      svg,
      simulation,
      palestinianDemolitions,
      RECT,
      walkX,
      walkY,
      CORE_XY_DOMAIN,
      tooltip
    ));
    removePermitLabels(svg);
  },
  () => {
    splitNodesLeftRight(
      simulation,
      svg,
      permitNames,
      walkX,
      walkY,
      permitCategories,
      palestinianDemolitions,
      PERMIT_TEXT
    );
    hideMap();
    showGrantedPermits(nodes, RECT);
    animationController = AnimationController(demolitionDates, nodes, RECT);
    animationController.pause();
  },
  () => {
    removePermitLabels(svg);
    hideGrantedPermits(nodes, RECT);
    ({ map, animationController } = drawMap(
      mapGenerate,
      map,
      demolitionDates,
      nodes,
      RECT,
      simulation,
      animationController
    ));
    svg = rectSVG(svg, ADJ_WIDTH, ADJ_HEIGHT, MARGIN);
  },
  () => {
    animationController.pause();
    nodes.interrupt();
    svg = boxSVG(svg, MARGIN, ADJ_WIDTH, ADJ_HEIGHT);
    mapGenerate = false;
    hideMap();
    nodes = tileNodes(
      svg,
      palestinianDemolitions,
      ADJ_HEIGHT,
      nodes,
      RECT,
      tileLocalities
    );
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
