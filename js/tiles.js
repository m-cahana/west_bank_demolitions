// *******************
// tile set up and functions
// *******************

import { demolitionImages } from "./demolition_imagery.js";
import { cleanLocality, formatDate } from "./helper_functions.js";

/**
 * Tiles selection of nodes into a grid layout covering the entire SVG.
 */
export function tileNodes(
  svg,
  palestinianDemolitions,
  MARGIN,
  ADJ_WIDTH,
  ADJ_HEIGHT,
  nodes,
  RECT,
  tileSimulation
) {
  // Show hidden nodes (for tiling)
  nodes.filter((d) => !d.showOnMap).style("display", "block");

  // Number of nodes to animate as falling tiles.
  const N = 9;
  // Filter nodes designated as tile nodes.
  const selectedNodes = palestinianDemolitions.filter((d) => d.tileNode);

  // Optionally: remove any existing transitions or popups
  // (if you want a clean slate before starting the simulation)

  // Instead of calculating a fixed grid layout, we set each tile's initial position.
  // For example, assign a random x position within the width of the overlay,
  // and start with a y-position above the visible area.
  selectedNodes.forEach((d) => {
    d.x = Math.random() * ADJ_HEIGHT; // you can adjust this for your desired x-range
    d.y = -50; // start above the view so they "fall" into the map overlay
    // You can still set dimensions, so they become like uniform squares.
    d.targetWidth = (ADJ_HEIGHT / N) * 2.5; // adjust tile size as needed
    d.targetHeight = d.targetWidth;
  });

  // Create patterns in <defs> as before for your demolition images.
  const defs = svg.append("defs");

  const uniqueLocalities = Array.from(
    new Set(selectedNodes.map((d) => d.locality))
  );
  uniqueLocalities.forEach((locality) => {
    const imgData = demolitionImages[locality];
    const imgFile = imgData ? imgData[0] : "default_placeholder.jpeg";
    defs
      .append("pattern")
      .attr("id", `tile-image-${cleanLocality(locality)}`)
      .attr("patternUnits", "objectBoundingBox")
      .attr("patternContentUnits", "objectBoundingBox")
      .attr("width", 1)
      .attr("height", 1)
      .append("image")
      .attr("href", `images/${imgFile}`)
      .attr("preserveAspectRatio", "xMidYMid slice")
      .attr("width", 1)
      .attr("height", 1);
  });

  // Select the nodes that will become tiles.
  const tiles = nodes.filter((d) => selectedNodes.includes(d));

  // Hide non-tile nodes.
  nodes
    .filter((d) => !d.tileNode)
    .attr("opacity", 0)
    .on("mouseover.tooltip", null)
    .on("mousemove.tooltip", null)
    .on("mouseout.tooltip", null);

  // Set initial attributes for the tiles based on the simulation's properties.
  tiles
    .attr("x", (d) => d.x)
    .attr("y", (d) => d.y)
    .attr("width", (d) => d.targetWidth)
    .attr("height", (d) => d.targetHeight)
    .style("fill", (d) => `url(#tile-image-${cleanLocality(d.locality)})`)
    .attr("opacity", RECT.TILE_OPACITY)
    .style("stroke-width", (d) => d.targetWidth * 0.02);

  tiles.classed("tile-node", true);

  // --- Create a Force Simulation for Free Falling and Collisions ---
  tileSimulation = d3
    .forceSimulation(selectedNodes)
    // Gravity: gently attract nodes to the bottom.
    .force("gravity", d3.forceY((d) => ADJ_HEIGHT * (3 / 4)).strength(0.05))
    // Optionally, a centering force in x if you want them to gravitate toward the center.
    .force(
      "centerX",
      d3
        .forceX(() => {
          const mapFO = document.querySelector(".map-foreignobject");
          console.log(mapFO.getBoundingClientRect().width);
          // Fallback to ADJ_WIDTH if the foreignObject isn't found
          const mapWidth = mapFO
            ? mapFO.getBoundingClientRect().width - MARGIN.LEFT
            : ADJ_WIDTH - MARGIN.LEFT;
          return mapWidth / 2;
        })
        .strength(0.1)
    )
    // Collision: prevent tiles from overlapping.
    .force(
      "collide",
      d3
        .forceCollide()
        .radius((d) => d.targetWidth / 2 + d.targetWidth * 0.05)
        .iterations(4)
    )
    .force("floor", floorForce)
    // Run the simulation gradually.
    .alphaDecay(0.005)
    .on("tick", ticked);

  // Function to update tile positions on every simulation tick.
  function ticked() {
    tiles.attr("x", (d) => d.x).attr("y", (d) => d.y);
  }

  // --- Add Drag Behavior ---
  tiles.call(
    d3.drag().on("start", dragstarted).on("drag", dragged).on("end", dragended)
  );

  function dragstarted(event, d) {
    // Increase simulation's energy on drag start so other nodes react.
    if (!event.active) tileSimulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    d.fx = event.x;
    d.fy = event.y;
  }

  function dragended(event, d) {
    if (!event.active) tileSimulation.alphaTarget(0);
    // Remove fixed positions to allow the simulation to resume its forces.
    d.fx = null;
    d.fy = null;
  }

  function floorForce(alpha) {
    const epsilon = 0.5; // threshold to avoid jitter
    tileSimulation.nodes().forEach((d) => {
      const bottomLimit = ADJ_HEIGHT - d.targetHeight;
      // if node's center is significantly below the bottom limit, clamp it
      if (d.y > bottomLimit + epsilon) {
        d.y = bottomLimit;
        d.vy = 0;
      } else if (Math.abs(d.y - bottomLimit) < epsilon) {
        // if the node is within the epsilon zone, force it to precisely the floor
        d.y = bottomLimit;
        d.vy = 0;
      }
    });
  }

  // Inside tileNodes() add a click handler for the tiles.
  tiles.on("click", function (event, d) {
    // stop propagation so the global click rule doesn't immediately close the popup.
    event.stopPropagation();
    // Select the parent so the pop-up shares the same coordinate system.
    const parent = d3.select(this.parentNode);
    // Remove any existing pop-up to avoid duplicates.
    parent.selectAll("g.popup").remove();

    // Use the tile's dimensions (assuming squares) to determine pop-up size.
    const tileSize = d.targetWidth;
    const popupScale = 2.8;
    const popupWidth = tileSize * popupScale;
    const popupHeight = tileSize * popupScale;

    // Determine the SVG parent's width and height.
    // First try to get them as attributes; if not defined, fallback to the bounding box.
    let parentWidth = parseFloat(parent.attr("width"));
    let parentHeight = parseFloat(parent.attr("height"));
    if (isNaN(parentWidth) || isNaN(parentHeight)) {
      const bbox = parent.node().getBBox();
      parentWidth = bbox.width;
      parentHeight = bbox.height;
    }
    // Calculate the center coordinates of the SVG parent.
    const centerX = parentWidth / 2;
    const centerY = parentHeight / 2;

    // Append a pop-up group and center it within the parent's container.
    const popup = parent
      .append("g")
      .attr("class", "popup")
      .attr(
        "transform",
        `translate(${centerX - popupWidth / 2}, ${centerY - popupHeight / 2})`
      );

    // Add background rectangle (styling moved to CSS via the "popup-bg" class)
    popup
      .append("rect")
      .attr("class", "popup-bg")
      .attr("width", popupWidth)
      .attr("height", popupHeight);

    // Define content region dimensions.
    const contentPadding = 5;
    const topRegionHeight = popupHeight * 0.6; // top 60%
    const bottomRegionHeight = popupHeight * 0.4; // bottom 40%
    const imageColWidth = popupWidth * 0.6; // left 60% of width
    const imageWidth = imageColWidth - 2 * contentPadding;
    const imageHeight = topRegionHeight - 2 * contentPadding;

    // Add the image with a CSS class.
    const imgData = demolitionImages[d.locality];
    const imageFile = imgData ? imgData[0] : "default_placeholder.jpeg";
    popup
      .append("image")
      .attr("class", "popup-image")
      .attr("x", contentPadding)
      .attr("y", contentPadding)
      .attr("width", imageWidth)
      .attr("height", imageHeight)
      .attr("href", `images/${imageFile}`)
      .attr("preserveAspectRatio", "xMidYMid slice");

    // Use a foreignObject for the caption and assign it the CSS class "popup-caption".
    const captionX = imageColWidth + contentPadding;
    const captionY = contentPadding;
    const captionWidth = popupWidth - captionX - contentPadding;
    const captionHeight = topRegionHeight - 2 * contentPadding;
    const captionText = `
    - ${d.locality_cleaned}, ${d.district}
    - Demolition: ${formatDate(d.date_of_demolition)}
    - ${d.housing_units} ${d.housing_units > 1 ? "homes" : "home"} demolished, 
    ${d.people_left_homeless} ${
      d.people_left_homeless > 1 ? "people" : "person"
    } left homeless
    - Photo: ${demolitionImages[d.locality][1]}, ${
      demolitionImages[d.locality][2]
    }
  `;

    popup
      .append("foreignObject")
      .attr("x", captionX)
      .attr("y", captionY)
      .attr("width", captionWidth)
      .attr("height", captionHeight)
      .append("xhtml:div")
      .attr("class", "popup-caption")
      .html(captionText);

    // Add a close ("×") button to the top right of the popup.
    const closeButtonPadding = 10;
    popup
      .append("text")
      .attr("class", "popup-close")
      .attr("x", popupWidth - closeButtonPadding)
      .attr("y", closeButtonPadding + 10)
      .text("×")
      .style("cursor", "pointer")
      .on("click", function () {
        // Remove the popup when "×" is clicked.
        popup.remove();
      });

    // Add a horizontal divider line between the image/caption and the filler content.
    popup
      .append("line")
      .attr("x1", contentPadding * 4)
      .attr("y1", topRegionHeight)
      .attr("x2", popupWidth - contentPadding * 4)
      .attr("y2", topRegionHeight)
      .style("stroke", "var(--palestinian)")
      .style("stroke-width", 1);

    // Add scrollable filler text in the bottom region using a foreignObject.
    popup
      .append("foreignObject")
      .attr("class", "popup-filler")
      .attr("x", contentPadding)
      .attr("y", topRegionHeight + contentPadding)
      .attr("width", popupWidth - 2 * contentPadding)
      .attr("height", bottomRegionHeight - 2 * contentPadding)
      .append("xhtml:div")
      .html(`${demolitionImages[d.locality][3]}`);
  });

  // Return the updated nodes if needed.
  return { nodes, tileSimulation };
}

export function closeAllPopups() {
  d3.selectAll("g.popup").remove();
}

/**
 * Resets tile-specific styling so that the nodes revert to their original appearance.
 * This function removes the pattern fill, resets stroke and opacity, and removes the
 * "tiled" class so that highlighting and other behaviors work as they did originally.
 *
 * @param {d3.selection} nodes - The D3 selection of node elements.
 * @param {Object} RECT - The RECT object containing standard dimensions and opacities.
 */
export function resetTileStyling(nodes, RECT, tileSimulation) {
  // Stop the simulation if it's running.
  if (tileSimulation) {
    tileSimulation.stop();
    tileSimulation = null;
  }
  nodes
    .filter((d) => d.tileNode)
    .interrupt("resetTile")
    .transition("resetTile")
    .duration(500)
    // Reset the fill style to the original CSS value.
    // In your style.css, .nodes is defined with:
    //   fill: var(--palestinian);
    .style("fill", "var(--palestinian)")
    // Remove any tile-defined stroke and revert to the default (none).
    .style("stroke", "none")
    // Remove an inline stroke-width so that CSS or simulation can control it.
    .style("stroke-width", null)
    // Reset the opacity to the original value from RECT.
    .attr("opacity", RECT.OPACITY)
    // Optionally, if tileNodes rewrites geometry (x, y, width, height),
    // you may want them to be updated via the simulation instead.
    // Revert the tile-specific class.
    .on("end", function () {
      d3.select(this).classed("tiled", false);
    });
}

// --- global Click Listener ---
// This listener checks for clicks anywhere in the document.
// If the click target isn't a tile node (i.e. doesn't have the "tile-node" class in its ancestry),
// it will close any open pop-ups.
d3.select(document).on("click.closePopup", function (event) {
  // Don't close the popup if a tile node or a popup element was clicked
  if (!event.target.closest(".tile-node") && !event.target.closest(".popup")) {
    closeAllPopups();
  }
});
