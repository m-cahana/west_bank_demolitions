// *******************
// tile set up and functions
// *******************

import { demolitionImages } from "./demolition_imagery.js";
import { cleanLocality, formatDate } from "./helper_functions.js";

export function rectSVG(svg, ADJ_WIDTH, ADJ_HEIGHT, MARGIN) {
  svg
    .attr("width", ADJ_WIDTH + MARGIN.LEFT + MARGIN.RIGHT)
    .attr("height", ADJ_HEIGHT + MARGIN.TOP + MARGIN.BOTTOM)
    .transition()
    .duration(0) // Adjust duration as needed
    .attr("transform", `translate(0,0)`);

  return svg;
}

export function boxSVG(svg, MARGIN, ADJ_WIDTH, ADJ_HEIGHT) {
  const newWidth = Math.min(ADJ_HEIGHT, ADJ_WIDTH) + MARGIN.LEFT + MARGIN.RIGHT;
  const newHeight =
    Math.min(ADJ_HEIGHT, ADJ_WIDTH) + MARGIN.TOP + MARGIN.BOTTOM;

  // Calculate the difference between old and new sizes
  const deltaX = (ADJ_WIDTH + MARGIN.LEFT + MARGIN.RIGHT - newWidth) / 2;
  const deltaY = (ADJ_HEIGHT + MARGIN.TOP + MARGIN.BOTTOM - newHeight) / 2;

  svg
    .attr("width", newWidth)
    .attr("height", newHeight)
    .transition()
    .duration(1000) // Adjust duration as needed
    .attr("transform", `translate(${deltaX}, ${deltaY})`);

  return svg;
}

/**
 * Calculates the number of columns and rows for a grid layout.
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

/**
 * Tiles selection of nodes into a grid layout covering the entire SVG.
 */
export function tileNodes(
  svg,
  palestinianDemolitions,
  MARGIN,
  ADJ_HEIGHT,
  nodes,
  RECT,
  RECT_ADJUSTMENT_FACTOR
) {
  // Show hidden nodes (for tiling)
  nodes.filter((d) => !d.showOnMap).style("display", "block");

  // Number of nodes to display in the grid.
  const N = 9;
  // Filter nodes designated as tile nodes.
  const selectedNodes = palestinianDemolitions.filter((d) => d.tileNode);

  // Calculate grid layout (columns, rows, and tile size using the adjusted height)
  const { cols, rows, tileSize } = calculateGridLayout(
    N,
    ADJ_HEIGHT,
    ADJ_HEIGHT
  );

  // Assign each selected node a target grid position and dimensions.
  selectedNodes.forEach((d, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    d.tileTargetX = col * tileSize;
    d.tileTargetY = row * tileSize;
    d.targetWidth = tileSize;
    d.targetHeight = tileSize;
  });

  // Create <defs> for SVG patterns using your demolition images.
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

  // Select the nodes that will be tiled.
  const tiles = nodes.filter((d) => selectedNodes.includes(d));

  // Hide the rest of the nodes.
  nodes
    .filter((d) => !d.tileNode)
    .attr("opacity", 0)
    .on("mouseover.tooltip", null)
    .on("mousemove.tooltip", null)
    .on("mouseout.tooltip", null);

  // Transition the tiles to their grid positions and apply pattern fill.
  tiles
    .transition()
    .duration(1000)
    .attr("opacity", RECT.TILE_OPACITY)
    .style("fill", (d) => `url(#tile-image-${cleanLocality(d.locality)})`)
    .attr("x", (d) => d.tileTargetX)
    .attr("y", (d) => d.tileTargetY)
    .attr("width", (d) => d.targetWidth)
    .attr("height", (d) => d.targetHeight)
    .on("end", function (event, d) {
      d3.select(this).classed("tiled", true);
    });

  // Inside tileNodes() add a click handler for the tiles.
  tiles.on("click", function (event, d) {
    // Select the parent so the pop-up shares the same coordinate system.
    const parent = d3.select(this.parentNode);
    // Remove any existing pop-up to avoid duplicates.
    parent.selectAll("g.popup").remove();

    // Use the tile's dimensions (assuming squares) to determine pop-up size.
    const tileSize = d.targetWidth;
    const popupScale = 2.8;
    const popupWidth = tileSize * popupScale;
    const popupHeight = tileSize * popupScale;

    // Calculate the grid center.
    const {
      cols,
      rows,
      tileSize: gridTileSize,
    } = calculateGridLayout(N, ADJ_HEIGHT, ADJ_HEIGHT);
    const gridWidth = cols * gridTileSize;
    const gridHeight = rows * gridTileSize;
    const centerX = gridWidth / 2;
    const centerY = gridHeight / 2;

    // Add a pop-up group and center it over the grid.
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
      ${d.locality_cleaned}
      ${d.district}<br/>
      Demolition: ${formatDate(d.date_of_demolition)}
      ${d.housing_units} ${
      d.housing_units > 1 ? "homes" : "home"
    } demolished, ${d.people_left_homeless} ${
      d.people_left_homeless > 1 ? "people" : "person"
    } left homeless<br/>
    Photo: ${demolitionImages[d.locality][1]}, ${
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
    const closeButtonPadding = 10; // adjust padding as needed
    popup
      .append("text")
      .attr("class", "popup-close")
      .attr("x", popupWidth - closeButtonPadding) // position near the top right
      .attr("y", closeButtonPadding + 10) // adjust for text baseline
      .text("×")
      .style("cursor", "pointer")
      .on("click", function () {
        // Remove the popup when "×" is clicked.
        popup.remove();
      });

    // Add horizontal divider line between the image/caption and the filler content
    popup
      .append("line")
      .attr("x1", contentPadding * 4) // start a little right of the popup's left edge
      .attr("y1", topRegionHeight) // at the bottom of the top region
      .attr("x2", popupWidth - contentPadding * 4) // end a little before the popup's right edge
      .attr("y2", topRegionHeight)
      .style("stroke", "var(--palestinian)") // uses the Palestinian color from style.css
      .style("stroke-width", 1); // adjust thickness as desired

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

  return nodes;
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
export function resetTileStyling(nodes, RECT) {
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
