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
    .attr("width", Math.min(ADJ_HEIGHT, ADJ_WIDTH) + MARGIN.LEFT + MARGIN.RIGHT)
    .attr(
      "height",
      Math.min(ADJ_HEIGHT, ADJ_WIDTH) + MARGIN.TOP + MARGIN.BOTTOM
    )
    .transition()
    .duration(1000) // Adjust duration as needed
    .attr("transform", `translate(${deltaX}, ${deltaY})`);

  return svg;
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

/**
 * tiles selection of nodes into a grid layout covering the entire SVG.
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
    .style("stroke", "white")
    .style("stroke-width", 1)
    .attr("x", (d) => d.tileTargetX)
    .attr("y", (d) => d.tileTargetY)
    .attr("width", (d) => d.targetWidth)
    .attr("height", (d) => d.targetHeight)
    .on("end", function (event, d) {
      d3.select(this).classed("tiled", true);
    });

  // Inside your tileNodes() function, after the tiles have been positioned...
  // In your tileNodes() function, after the tiles have been positioned...
  tiles.on("click", function (event, d) {
    // Select the parent so that the pop-up shares the same coordinate system.
    const parent = d3.select(this.parentNode);
    console.log(parent);
    // Remove any existing pop-up to avoid duplicates.
    parent.selectAll("g.popup").remove();

    // Use the tile's dimensions (assuming squares) to determine pop-up size.
    const tileSize = d.targetWidth;
    const popupScale = 2.8;
    const popupWidth = tileSize * popupScale;
    const popupHeight = tileSize * popupScale;

    // Calculate the grid center.
    const N = 9; // Number of tiled nodes in the grid.
    const {
      cols,
      rows,
      tileSize: gridTileSize,
    } = calculateGridLayout(N, ADJ_HEIGHT, ADJ_HEIGHT);
    const gridWidth = cols * gridTileSize;
    const gridHeight = rows * gridTileSize;
    const centerX = gridWidth / 2;
    const centerY = gridHeight / 2;

    // Add a pop-up group and move it so its center is over the grid center.
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

    // Define content region dimensions
    const contentPadding = 5;
    const topRegionHeight = popupHeight * 0.6; // top 60%
    const bottomRegionHeight = popupHeight * 0.4; // bottom 40%
    const imageColWidth = popupWidth * 0.6; // left 60% of width
    // Caption takes the remaining 40%
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

    // Add caption text on the right side.
    const captionX = imageColWidth + contentPadding;
    const captionY = contentPadding + 15;
    const captionText = `
      ${d.locality_cleaned}
      ${d.district}\n\u200B\n${formatDate(d.date_of_demolition)}
      ${d.housing_units} ${d.housing_units > 1 ? "homes" : "home"} demolished
      ${d.people_left_homeless} ${
      d.people_left_homeless > 1 ? "people" : "person"
    } left homeless`;

    // Create text element and use tspans for multi-line text.
    const caption = popup
      .append("text")
      .attr("class", "popup-caption")
      .attr("x", captionX)
      .attr("y", captionY);

    caption
      .selectAll("tspan")
      .data(
        captionText
          .split("\n")
          .map((line) => line.trim())
          .filter((line) => line.length > 0) // optionally remove empty lines
      )
      .enter()
      .append("tspan")
      .attr("x", captionX)
      .attr("dy", "1.2em")
      .text((txt) => txt);

    // Add a close ("x") button to the top right of the popup
    const closeButtonPadding = 10; // adjust padding as needed
    popup
      .append("text")
      .attr("class", "popup-close")
      .attr("x", popupWidth - closeButtonPadding) // position near the top right
      .attr("y", closeButtonPadding + 10) // adjust for text baseline
      .text("×")
      .style("cursor", "pointer")
      .on("click", function () {
        // Remove the popup when "x" is clicked
        popup.remove();
      });

    // Add scrollable filler text in the bottom region using a foreignObject.
    popup
      .append("foreignObject")
      .attr("class", "popup-filler")
      .attr("x", contentPadding)
      .attr("y", topRegionHeight + contentPadding)
      .attr("width", popupWidth - 2 * contentPadding)
      .attr("height", bottomRegionHeight - 2 * contentPadding)
      .append(
        "xhtml:div"
      ).html(`Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.<br>
           Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.<br>
           Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.<br>
           Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.<br>
            Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.<br>
           Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.<br>
           Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.<br>
           (Scroll for more...)`);
  });

  return nodes;
}

export function closeAllPopups() {
  d3.selectAll("g.popup").remove();
}
