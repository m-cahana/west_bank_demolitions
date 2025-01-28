"use strict";
let svg;
let DOT_ADJUSTMENT_FACTOR = 1;
let ADJ_WIDTH, ADJ_HEIGHT;

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

function* walkGenerator(totalSteps = 50, initialValue = 2, min = 0, max = 4) {
  let v = initialValue;
  const data = [];
  for (let i = 0; i < totalSteps; ++i) {
    v += Math.random() - 0.5;
    v = Math.max(Math.min(v, max), min);
    data.push({ step: i, value: v });
    yield [...data];
  }
}

function* walkGeneratorTwo(totalSteps = 100, initialValue = 0, stepBreak = 10) {
  let v = initialValue;
  let direction = 1; // 1 for up, -1 for down
  let nBreaks = 10;
  const data = [];
  for (let i = 0; i < totalSteps; ++i) {
    console.log(v, v * 5, nBreaks);
    v += direction;
    data.push({ step: v * 5, value: nBreaks });

    if (v === stepBreak || v === 0) {
      direction *= -1; // Change direction
    }
    if ((v === 1 && direction === -1) || (v === 9 && direction === 1)) {
      nBreaks += 10;
    }

    yield [...data];
  }
}

// draw each visual initially, then hide most of them
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

  const walk = walkGeneratorTwo();

  console.log(walk);

  svg = d3
    .select("#vis")
    .append("svg")
    .attr("width", ADJ_WIDTH + MARGIN.LEFT + MARGIN.RIGHT)
    .attr("height", ADJ_HEIGHT + MARGIN.TOP + MARGIN.BOTTOM)
    .attr("opacity", 1);

  const walkX = d3
    .scaleLinear()
    .domain([0, 49])
    .range([MARGIN.LEFT, ADJ_WIDTH - MARGIN.RIGHT]);

  const walkY = d3
    .scaleLinear()
    .domain([0, 100])
    .range([ADJ_HEIGHT - MARGIN.BOTTOM, MARGIN.TOP]);

  const line = d3
    .line()
    .x((d) => walkX(d.step))
    .y((d) => walkY(d.value))
    .curve(d3.curveBumpY);

  svg
    .append("path")
    .attr("d", line(walk))
    .attr("stroke", "black")
    .attr("fill", "none")
    .attr("stroke-width", 2);

  const path = svg.select("path");

  const pathLength = path.node().getTotalLength();

  const transitionPath = d3.transition().ease(d3.easeSin).duration(2500);

  path
    .attr("stroke-dashoffset", pathLength)
    .attr("stroke-dasharray", pathLength)
    .transition(transitionPath)
    .attr("stroke-dashoffset", 0);

  const generator = walkGeneratorTwo();
  let data = [];

  function animate() {
    const result = generator.next();
    if (!result.done) {
      data = result.value;

      // Update Line
      path.datum(data).transition().duration(10).attr("d", line);

      // Continue Animation
      setTimeout(animate, 50);
    }
  }
  animate();
}

// *******************
// scroll
// *******************

// array of all visual functions
// to be called by the scroller functionality
let activationFunctions = [() => {}];

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
