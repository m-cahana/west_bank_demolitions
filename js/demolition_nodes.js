// *******************
// demolition node set up and transitions
// *******************

import { getRandomNumberBetween } from "./helper_functions.js";

export function initiateDemolitionNodes(
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
) {
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
            <strong>Locality:</strong> ${d.locality_cleaned}<br>
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
              ((CORE_XY_DOMAIN.END - CORE_XY_DOMAIN.START) / 8) * 1,
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

  // **9. Restart the simulation**
  simulation.alpha(0.75).restart();

  return { simulation, nodes, israeliLineRedraw };
}

export function showDemolitionNodes(svg) {
  svg.selectAll(".nodes").style("display", "block");
}

export function hideDemolitionNodes(svg) {
  svg.selectAll(".nodes").style("display", "none");
}

export function assignTargetPositions(
  palestinianDemolitions,
  baseLeftX,
  baseRightX,
  walkX,
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

  return palestinianDemolitions;
}

/**
 * Adds titled boxes above left and right node groups.
 */
export function splitNodesLeftRight(
  simulation,
  mapSvg,
  walkX,
  walkY,
  palestinianDemolitions,
  PERMIT_TEXT,
  CORE_XY_DOMAIN,
  RECT_ADJUSTMENT_FACTOR
) {
  const BUFFER_LEFT = 2;
  const BUFFER_RIGHT = 30;
  // **1. Assign random target positions**
  const BOUNDS = {
    LEFT: ((CORE_XY_DOMAIN.END - CORE_XY_DOMAIN.START) / 10) * 1 - BUFFER_LEFT,
    RIGHT:
      ((CORE_XY_DOMAIN.END - CORE_XY_DOMAIN.START) / 10) * 10 - BUFFER_RIGHT,
    TOP: 90,
    BOTTOM: 0,
  };

  palestinianDemolitions = assignTargetPositions(
    palestinianDemolitions,
    BOUNDS.LEFT,
    BOUNDS.RIGHT,
    walkX,
    BUFFER_LEFT,
    BUFFER_RIGHT
  );

  const permitCategories = {
    Granted: [walkX(BOUNDS.LEFT), 1],
    Denied: [walkX(BOUNDS.RIGHT), 99],
  };

  console.log(`walkX(BOUNDS.LEFT): ${walkX(BOUNDS.LEFT)}`);
  console.log(`walkX(BOUNDS.RIGHT): ${walkX(BOUNDS.RIGHT)}`);

  const permitNames = Object.keys(permitCategories);

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

  const permitLabels = mapSvg.append("g").attr("class", "permit-labels");

  permitLabels
    .selectAll(".permit-label")
    .data(permitNames)
    .enter()
    .append("g")
    .attr("class", "permit-label")
    // Position the group at the desired center
    .attr(
      "transform",
      (d) =>
        `translate(${permitCategories[d][0]}, ${walkY(
          BOUNDS.TOP + 7.5 / RECT_ADJUSTMENT_FACTOR
        )})`
    )
    .each(function (d) {
      const g = d3.select(this);

      // Append text at (0,0) and center it
      const textEl = g
        .append("text")
        .attr("text-anchor", "middle") // centers horizontally relative to x = 0
        .attr("dominant-baseline", "middle") // centers vertically relative to y = 0
        .text(`${d} (${permitCategories[d][1]}%)`)
        .attr("class", "label-text");

      // Ensure the text is rendered. In case the font hasn't loaded yet,
      // you might consider wrapping the measurement in a setTimeout.
      const textNode = textEl.node();
      const textWidth = textNode.getComputedTextLength();
      const bbox = textNode.getBBox();
      const rectWidth = textWidth + 2 * PERMIT_TEXT.width_padding;
      const rectHeight = bbox.height + 2 * PERMIT_TEXT.height_padding;

      // Instead of setting x and y offsets on the rectangle,
      // insert it at (0,0) and apply a transform to shift it by half its width/height.
      g.insert("rect", "text")
        .attr("class", "label-rect")
        .attr("width", rectWidth)
        .attr("height", rectHeight)
        .attr("transform", `translate(-${rectWidth / 2}, -${rectHeight / 2})`);
    });
}

export function removePermitLabels(svg) {
  svg.selectAll("g.permit-labels").remove();
}

export function hideGrantedPermits(nodes, RECT) {
  nodes.attr("opacity", (d) => (d.simulateGrant ? 0 : RECT.OPACITY));
}

export function showGrantedPermits(nodes, RECT) {
  nodes.attr("opacity", RECT.OPACITY);
}

// A helper that attaches tooltip events with or without the extra info.
export function attachTooltip(nodes, tooltip, includeExtra = false) {
  nodes
    .on("mouseover.tooltip", function (event, d) {
      // Create the base tooltip content.
      let content = `<strong>Housing units:</strong> ${d.housing_units}<br>
                     <strong>Locality:</strong> ${d.locality_cleaned}<br>
                     <strong>District:</strong> ${d.district}<br>`;
      // Conditionally add people_left_homeless.
      if (includeExtra && d.people_left_homeless !== undefined) {
        content += `<strong>People left homeless:</strong> ${d.people_left_homeless}<br>`;
      }

      tooltip
        .html(content)
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY + 10}px`)
        .classed("visible", true);

      // Optionally, add a highlighted class.
      d3.select(this).classed("highlighted", true);
    })
    .on("mousemove.tooltip", function (event) {
      tooltip
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY + 10}px`);
    })
    .on("mouseout.tooltip", function () {
      tooltip.classed("visible", false);
      d3.select(this).classed("highlighted", false);
    });

  return nodes;
}
