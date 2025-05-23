import { getRandomNumberBetween } from "./helper_functions.js";
import { tileNodes } from "./tiles.js";
import { duBoisLine } from "./lines.js";
import { nodeStackPositioning } from "./node_stack.js";

export function debounce(func, wait) {
  let timeout;
  return function (...args) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
}

export function updateDimensions(
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
) {
  const container = document.getElementById("vis");
  const containerWidth = container.clientWidth;

  ADJ_WIDTH = Math.min(WIDTH, containerWidth);
  ADJ_HEIGHT = ADJ_WIDTH * HEIGHT_WIDTH_RATIO;

  RECT_ADJUSTMENT_FACTOR = ADJ_WIDTH / WIDTH;

  MARGIN = Object.keys(CORE_MARGIN).reduce((acc, key) => {
    acc[key] = CORE_MARGIN[key] * RECT_ADJUSTMENT_FACTOR;
    return acc;
  }, {});

  // update scales
  walkX.range([MARGIN.LEFT, ADJ_WIDTH - MARGIN.RIGHT]);
  walkY.range([ADJ_HEIGHT - MARGIN.BOTTOM, MARGIN.TOP]);

  // update SVG size
  svg
    .attr("width", ADJ_WIDTH + MARGIN.LEFT + MARGIN.RIGHT)
    .attr("height", ADJ_HEIGHT + MARGIN.TOP + MARGIN.BOTTOM);

  return {
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
  };
}

/**
 * Updates both the position and size of permit labels.
 *
 * @param {Number} ADJ_WIDTH - The current adjusted width of the view.
 * @param {Function} walkX - The updated x-scale function.
 * @param {Function} walkY - The updated y-scale function.
 * @param {Object} CORE_XY_DOMAIN - The domain (with START and END) used by walkX.
 * @param {Object} PERMIT_TEXT - Contains padding values (width_padding and height_padding).
 */
function updatePermitLabels(
  ADJ_WIDTH,
  walkX,
  walkY,
  CORE_XY_DOMAIN,
  PERMIT_TEXT,
  RECT_ADJUSTMENT_FACTOR
) {
  // Use a timeout to allow the browser to reflow the text elements
  setTimeout(() => {
    const BUFFER_LEFT = 2;
    const BUFFER_RIGHT = 30;

    // Define bounds based on your original logic.
    const BOUNDS = {
      LEFT:
        ((CORE_XY_DOMAIN.END - CORE_XY_DOMAIN.START) / 10) * 1 - BUFFER_LEFT,
      RIGHT:
        ((CORE_XY_DOMAIN.END - CORE_XY_DOMAIN.START) / 10) * 10 - BUFFER_RIGHT,
      TOP: 80,
      BOTTOM: 0,
    };

    // Determine x positions for each permit category.
    const permitCategories = {
      Granted: [walkX(BOUNDS.LEFT), 1],
      Denied: [walkX(BOUNDS.RIGHT), 99],
    };

    const yPosition = walkY(BOUNDS.TOP);

    // Now update each permit label.
    d3.selectAll("g.permit-label").each(function (d) {
      const g = d3.select(this);

      // Update the group’s position.
      const newX = permitCategories[d][0];
      g.attr("transform", `translate(${newX}, ${yPosition})`);

      // Use requestAnimationFrame to wait until the update is rendered.
      window.requestAnimationFrame(() => {
        // Re-measure the text element.
        const textEl = g.select("text.label-text");
        if (textEl.empty()) {
          return;
        }
        // The assumed centering: text is drawn at (0,0) with text-anchor "middle" and dominant-baseline "middle".
        const textNode = textEl.node();
        const bbox = textNode.getBBox();
        const textWidth = textNode.getComputedTextLength();

        // Calculate the new rectangle dimensions using padding.
        const rectWidth =
          textWidth + 2 * PERMIT_TEXT.width_padding * RECT_ADJUSTMENT_FACTOR;
        const rectHeight =
          bbox.height + 2 * PERMIT_TEXT.height_padding * RECT_ADJUSTMENT_FACTOR;

        // Update the background rectangle so that it remains centered behind the text.
        g.select("rect.label-rect")
          .attr("width", rectWidth)
          .attr("height", rectHeight)
          .attr(
            "transform",
            `translate(-${rectWidth / 2}, -${rectHeight / 2})`
          );
      });
    });
  }, 100); // Adjust this timeout delay (in ms) if needed
}

/**
 * Redraws all lines created in lines.js using updated scales and the line generator,
 * and recalculates the tile layout on resize.
 *
 * @param {Object} params - Parameters for updating the graphics.
 * @param {Array} params.animatedLines - Array of AnimatedLine instances.
 * @param {d3.selection} params.svg - The main SVG container.
 * @param {Function} params.walkX - Updated D3 scale for x coordinates.
 * @param {Function} params.walkY - Updated D3 scale for y coordinates.
 * @param {Number} params.ADJ_WIDTH - Adjusted view width.
 * @param {Number} params.ADJ_HEIGHT - Adjusted view height.
 * @param {d3.line} params.line - Updated D3 line generator.
 * @param {number} params.lineLabelOffset - Offset value for label positions.
 * @param {Object} params.STEP_CONFIG - Configuration for step settings.
 * @param {d3.selection} params.nodes - The node selection.
 * @param {Object} params.RECT - Rectangle configuration object.
 * @param {number} params.RECT_ADJUSTMENT_FACTOR - Factor for rectangle scaling.
 * @param {Object} params.CORE_XY_DOMAIN - Domain used by walkX and walkY.
 * @param {Object} params.map - (Optional) Map element with a resize method.
 * @param {Object} params.simulation - D3 simulation instance.
 * @param {Object} params.PERMIT_TEXT - Object with permit text padding (width_padding, height_padding).
 * @param {Array} params.palestinianDemolitions - Array of demolition data used in tiling.
 */
export function redrawGraphics({
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
}) {
  animatedLines.forEach((instance) => {
    instance.path.attr("d", line(instance.data));
    if (instance.text) {
      const firstPoint = instance.data[0];
      const lastPoint = instance.data[instance.data.length - 1];
      instance.text
        .attr("x", walkX(-12 / RECT_ADJUSTMENT_FACTOR))
        .attr("y", walkY(firstPoint.value - 1.5));
      if (instance.annotation) {
        instance.annotation
          .attr("x", walkX(lastPoint.step + 2))
          .attr("y", walkY(firstPoint.value - 1.5));
      }
    }
  });

  svg.selectAll("path.palestinian-line-path").each(function (d) {
    d3.select(this).attr("d", line(d));
  });

  let israeliPath = svg.select(".israeli-line-path");
  if (!israeliPath.empty()) {
    const israeliData = israeliPath.datum();
    israeliPath.attr("d", line(israeliData));

    let israeliLabel = svg.select(".dubois-label-year");
    if (!israeliLabel.empty() && israeliData && israeliData.length > 0) {
      const firstIsraeliPoint = israeliData[0];
      const baseXYear = walkX(firstIsraeliPoint.step);
      israeliLabel
        .attr("x", baseXYear + lineLabelOffset)
        .attr("y", walkY(STEP_CONFIG.Y_START + 3.5));
    }
  }
  let palestinianLabel = svg.select(".dubois-label-decade");
  if (!palestinianLabel.empty() && palestinianPermits) {
    const consolidatedPermits = palestinianPermits.reduce(
      (sum, d) => sum + d.permits,
      0
    );

    const consolidatedPathData = duBoisLine(
      consolidatedPermits,
      STEP_CONFIG.LENGTH,
      CORE_Y_START,
      STEP_CONFIG.Y_CHANGE,
      false,
      STEP_CONFIG.STEPS_UNTIL_TURN
    );

    const firstPoint = consolidatedPathData[0];

    palestinianLabel
      .attr("x", walkX(firstPoint.step) + lineLabelOffset)
      .attr("y", walkY(firstPoint.value + 3));

    let index_counter = 0;
    palestinianPermits.forEach((d) => {
      svg
        .select(`.palestinian-${d.year}-line-path`)
        .transition()
        .duration(0) // duration in milliseconds
        .attr(
          "d",
          line(
            consolidatedPathData.slice(index_counter, index_counter + d.permits)
          )
        );
      index_counter += d.permits - 1;
    });
  }

  if (activeIndex == 5) {
    svg
      .select(".map-foreignobject")
      .attr("width", ADJ_WIDTH)
      .attr("height", ADJ_HEIGHT)
      .style("width", `${ADJ_WIDTH}px`)
      .style("height", `${ADJ_HEIGHT}px`);

    if (map && typeof map.resize === "function") {
      map.resize();
    }
  }

  // [2] Update node dimensions and re-center them
  if (nodes && !nodes.empty() && [3, 4].includes(activeIndex)) {
    nodes
      .attr(
        "x",
        (d) =>
          d.x -
          (Math.sqrt(d.housing_units) * RECT.WIDTH * RECT_ADJUSTMENT_FACTOR) / 2
      )
      .attr(
        "y",
        (d) =>
          d.y -
          (Math.sqrt(d.housing_units) * RECT.HEIGHT * RECT_ADJUSTMENT_FACTOR) /
            2
      );

    nodes
      .filter((d) => !d.tileNode)
      .attr(
        "width",
        (d) => Math.sqrt(d.housing_units) * RECT.WIDTH * RECT_ADJUSTMENT_FACTOR
      )
      .attr(
        "height",
        (d) => Math.sqrt(d.housing_units) * RECT.HEIGHT * RECT_ADJUSTMENT_FACTOR
      );
  }

  // [3] Update the simulation forces and restart the simulation
  if (simulation && activeIndex == 3) {
    simulation.force(
      "forceX",
      d3
        .forceX((d) =>
          walkX(
            getRandomNumberBetween(
              ((CORE_XY_DOMAIN.END - CORE_XY_DOMAIN.START) / 8) * 1,
              ((CORE_XY_DOMAIN.END - CORE_XY_DOMAIN.START) / 8) * 7
            )
          )
        )
        .strength(0.075)
    );
    simulation.force(
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
    );
    simulation.alpha(1).restart();
  }

  // [4] Update tileNodes layout based on the new dimensions.
  // Make sure to pass your data array for Palestinian demolitions.
  if (palestinianDemolitions && nodes && activeIndex == 7) {
    simulation.stop();
    tileSimulation.stop();
    tileNodes(
      svg,
      palestinianDemolitions,
      MARGIN,
      ADJ_WIDTH,
      ADJ_HEIGHT,
      nodes,
      RECT,
      tileSimulation
    );
  }

  // [5] Finally, update the positions and sizes of the permit labels.
  setTimeout(() => {
    updatePermitLabels(
      ADJ_WIDTH,
      walkX,
      walkY,
      CORE_XY_DOMAIN,
      PERMIT_TEXT,
      RECT_ADJUSTMENT_FACTOR
    );
  }, 50);

  // update bar chart
  if (activeIndex == 6) {
    const aggregatedData = d3.rollups(
      palestinianDemolitions,
      (v) => d3.sum(v, (d) => d.people_left_homeless),
      (d) => d.date_of_demolition.getFullYear()
    );
    // Sort years in ascending order
    aggregatedData.sort((a, b) => d3.ascending(a[0], b[0]));
    const aggregatedMap = new Map(aggregatedData);

    const chartHeight = ADJ_HEIGHT - BAR_MARGIN.TOP - BAR_MARGIN.BOTTOM;
    const chartWidth = ADJ_WIDTH - BAR_MARGIN.LEFT - BAR_MARGIN.RIGHT;

    nodeStackPositioning(
      nodes,
      aggregatedData,
      aggregatedMap,
      chartWidth,
      chartHeight,
      BAR_MARGIN,
      RECT
    );

    svg
      .select(".bar-chart")
      .attr("transform", `translate(${BAR_MARGIN.LEFT}, ${BAR_MARGIN.TOP})`);

    svg
      .select(".x-axis")
      .attr("transform", `translate(0, ${chartHeight})`)
      .call(
        d3.axisBottom(
          d3
            .scaleBand()
            .domain(aggregatedData.map((d) => d[0]))
            .range([0, chartWidth])
            .padding(0.2)
        )
      );

    svg
      .select(".x-label")
      .attr("x", chartWidth / 2)
      .attr("y", chartHeight + BAR_MARGIN.BOTTOM);

    svg.select(".y-axis").call(
      d3.axisLeft(
        d3
          .scaleLinear()
          .domain([0, d3.max(aggregatedData, (d) => d[1])])
          .nice()
          .range([chartHeight, 0])
      )
    );

    svg
      .select(".y-label")
      .attr("x", -chartHeight / 2)
      .attr("y", -BAR_MARGIN.LEFT + 30);
  }
}
