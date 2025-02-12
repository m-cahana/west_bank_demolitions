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
  walkY,
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
 * Adds titled boxes above left and right node groups.
 */
export function splitNodesLeftRight(
  simulation,
  svg,
  permitNames,
  walkX,
  walkY,
  permitCategories,
  palestinianDemolitions,
  PERMIT_TEXT
) {
  // **1. Assign random target positions**
  const BOUNDS = { LEFT: -10, RIGHT: 42.5, TOP: 90, BOTTOM: 0 };

  assignTargetPositions(
    palestinianDemolitions,
    BOUNDS.LEFT,
    BOUNDS.RIGHT,
    walkX,
    walkY
  );

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

export function removePermitLabels(svg) {
  svg.selectAll("g.permit-labels").remove();
}

export function hideGrantedPermits(nodes, RECT) {
  nodes.attr("opacity", (d) => (d.simulateGrant ? 0 : RECT.OPACITY));
}

export function showGrantedPermits(nodes, RECT) {
  nodes.attr("opacity", RECT.OPACITY);
}
