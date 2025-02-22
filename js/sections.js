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
let animationController, animatedQueue;
let animatedLines = [];
let israeliLine;
let tileSimulation;

let lastIndex = 0;
let activeIndex = 0;

let CORE_MARGIN = { LEFT: 150, RIGHT: 100, TOP: 50, BOTTOM: 20 };
let CORE_XY_DOMAIN = { START: 0, END: 100 };
let MARGIN = { LEFT: 150, RIGHT: 100, TOP: 50, BOTTOM: 20 };
let WIDTH = 800;
let HEIGHT = 500;
let HEIGHT_WIDTH_RATIO = HEIGHT / WIDTH;
let lineLabelOffset = -50;

const BAR_MARGIN = { TOP: 50, RIGHT: 30, BOTTOM: 50, LEFT: 70 };
const RECT = {
  WIDTH: 5,
  HEIGHT: 5,
  OPACITY: 0.9,
  DEMOLISHED_OPACITY: 0.1,
  TILE_OPACITY: 0.5,
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

const tileLocalities = (d) =>
  (d.locality === "Kh. al-Markez" && d.people_left_homeless == 12) ||
  (d.locality === "a-Rakeez" && d.people_left_homeless === 12) ||
  (d.locality === "al-Walajah" && d.people_left_homeless === 14) ||
  (d.locality === "Um al-Kheir" && d.people_left_homeless === 15) ||
  (d.locality === "Khan al-Ahmar (Bedouin Community)" &&
    d.people_left_homeless === 16) ||
  (d.locality === "Kh. Jenbah" && d.people_left_homeless === 13) ||
  (d.locality === "Kh. Ma'in" && d.people_left_homeless === 7) ||
  (d.locality === "Kh. Humsah" &&
    d.people_left_homeless === 11 &&
    d.minors_left_homeless === 6 &&
    d.date_of_demolition.getTime() === new Date("2021-02-01").getTime()) ||
  (d.locality === "Yatta" && d.people_left_homeless === 38) ||
  (d.locality === "'Ein Samia" &&
    d.people_left_homeless === 8 &&
    d.minors_left_homeless == 6);

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
  verticalHelper,
} from "./lines.js";
import {
  initiateDemolitionNodes,
  hideDemolitionNodes,
  splitNodesLeftRight,
  removePermitLabels,
  hideGrantedPermits,
  showGrantedPermits,
  attachTooltip,
} from "./demolition_nodes.js";
import {
  AnimationController,
  drawMap,
  hideMap,
  renderHiddenMapNodes,
} from "./map.js";
import { tileNodes, closeAllPopups, resetTileStyling } from "./tiles.js";
import { createPausableQueue } from "./helper_functions.js";
import {
  updateDimensions,
  redrawGraphics,
  debounce,
} from "./dynamic_scaling.js";
import { stackNodes, hideBarChartAxesAndLabels } from "./node_stack.js";

// *******************
// data read-in
// *******************

async function initialize() {
  try {
    // Load Permits
    palestinianPermits = await getPalestinianPermits();

    // Load Demolitions
    const demolitionsData = await loadDemolitionsData(tileLocalities);
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

function redrawAll() {
  redrawGraphics({
    animatedLines,
    svg,
    walkX,
    walkY,
    ADJ_WIDTH,
    ADJ_HEIGHT,
    line,
    lineLabelOffset,
    STEP_CONFIG,
    nodes,
    RECT,
    RECT_ADJUSTMENT_FACTOR,
    CORE_XY_DOMAIN,
    map,
    simulation,
    PERMIT_TEXT,
    palestinianDemolitions,
    activeIndex,
    BAR_MARGIN,
    palestinianPermits,
    CORE_Y_START,
    MARGIN,
    tileSimulation,
  });
}

// Call updateDimensions and then update the graphics
function handleResize() {
  ({
    ADJ_WIDTH,
    ADJ_HEIGHT,
    WIDTH,
    HEIGHT,
    HEIGHT_WIDTH_RATIO,
    CORE_MARGIN,
    RECT_ADJUSTMENT_FACTOR,
    walkX,
    walkY,
    MARGIN,
    svg,
  } = updateDimensions(
    ADJ_WIDTH,
    ADJ_HEIGHT,
    WIDTH,
    HEIGHT,
    HEIGHT_WIDTH_RATIO,
    CORE_MARGIN,
    RECT_ADJUSTMENT_FACTOR,
    walkX,
    walkY,
    MARGIN,
    svg
  ));

  redrawAll();
}

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

  animatedQueue = createPausableQueue(palestinianPermits, (d) => {
    let lineInstance = new AnimatedLine(
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
      `${d.year} - ${d.permits}`,
      RECT_ADJUSTMENT_FACTOR
    );

    animatedLines.push(lineInstance);

    if (d.permits > STEP_CONFIG.STEPS_UNTIL_TURN) {
      STEP_CONFIG.Y_START -=
        Math.floor(d.permits / STEP_CONFIG.STEPS_UNTIL_TURN) *
        STEP_CONFIG.Y_CHANGE;
    } else {
      STEP_CONFIG.Y_START -= STEP_CONFIG.Y_CHANGE;
    }
  });

  // some map constants
  mapContainer = svg.append("g").attr("class", "map-container");

  // Append a div for Mapbox inside the map container
  svg
    .append("foreignObject")
    .attr("width", ADJ_WIDTH)
    .attr("height", ADJ_HEIGHT)
    .attr("x", 0)
    .attr("y", MARGIN.TOP)
    .attr("class", "map-foreignobject")
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

  handleResize();
  window.addEventListener("resize", debounce(handleResize, 10));
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
    animatedQueue.flush();

    fastConsolidate = consolidatePalestinianLines(
      palestinianPermits,
      STEP_CONFIG,
      svg,
      walkX,
      walkY,
      CORE_Y_START,
      fastConsolidate,
      line,
      lineLabelOffset
    ).then(() => {
      israeliLine = drawIsraeliLines(
        israeliLineRedraw,
        svg,
        walkX,
        walkY,
        lineGroup,
        line,
        STEP_CONFIG,
        israeliLine,
        lineLabelOffset,
        RECT_ADJUSTMENT_FACTOR
      );
    });
    hideDemolitionNodes(svg);
  },
  () => {
    if (israeliLine) {
      israeliLine.flush();
    }
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
      tooltip,
      RECT_ADJUSTMENT_FACTOR
    ));
    removePermitLabels(svg);
  },
  () => {
    splitNodesLeftRight(
      simulation,
      mapSvg,
      walkX,
      walkY,
      palestinianDemolitions,
      PERMIT_TEXT,
      CORE_XY_DOMAIN,
      RECT_ADJUSTMENT_FACTOR
    );
    hideMap();
    renderHiddenMapNodes(nodes);
    showGrantedPermits(nodes, RECT);
    animationController = AnimationController(demolitionDates, nodes, RECT);
    animationController.pause();
    nodes = attachTooltip(nodes, tooltip, false);
  },
  () => {
    removePermitLabels(svg);
    hideGrantedPermits(nodes, RECT);
    ({ map, animationController } = drawMap(
      mapGenerate,
      map,
      svg,
      ADJ_WIDTH,
      ADJ_HEIGHT,
      demolitionDates,
      nodes,
      RECT,
      simulation,
      animationController,
      palestinianDemolitions,
      RECT_ADJUSTMENT_FACTOR
    ));
    nodes = attachTooltip(nodes, tooltip, true);
    hideBarChartAxesAndLabels();
    redrawAll();
  },
  () => {
    animationController.pause();
    nodes.interrupt();
    mapGenerate = false;
    hideMap();
    renderHiddenMapNodes(nodes);
    stackNodes(
      palestinianDemolitions,
      mapSvg,
      ADJ_WIDTH,
      ADJ_HEIGHT,
      nodes,
      RECT,
      BAR_MARGIN
    );
    closeAllPopups();
    resetTileStyling(nodes, RECT, tileSimulation);
  },
  () => {
    hideBarChartAxesAndLabels();
    ({ nodes, tileSimulation } = tileNodes(
      svg,
      palestinianDemolitions,
      MARGIN,
      ADJ_WIDTH,
      ADJ_HEIGHT,
      nodes,
      RECT,
      tileSimulation
    ));
  },
];

// Initialize scroller
let scroll = scroller().container(d3.select("#graphic"));
scroll();

scroll.on("active", function (index) {
  activeIndex = index;

  console.log(`activeIndex: ${activeIndex}`);

  let sign = activeIndex - lastIndex < 0 ? -1 : 1;
  let scrolledSections = d3.range(lastIndex + sign, activeIndex + sign, sign);

  scrolledSections.forEach((i) => {
    activationFunctions[i]();
  });
  lastIndex = activeIndex;
});

// Reload on top of page
history.scrollRestoration = "manual";
