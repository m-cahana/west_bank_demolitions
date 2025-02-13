// *******************
// tile set up and functions
// *******************

import { demolitionImages } from "./demolition_imagery.js";

import { cleanLocality } from "./helper_functions.js";

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
  ADJ_HEIGHT,
  nodes,
  RECT,
  tileLocalities
) {
  // Ensure hidden nodes (that are not marked for the map) are visible for tiling.
  nodes.filter((d) => !d.showOnMap).style("display", "block");

  // Number of nodes to display in the grid.
  const N = 9;

  // Optionally shuffle or filter your nodes (here we filter using tileLocalities)
  const selectedNodes = palestinianDemolitions.filter(tileLocalities);

  // Calculate grid layout (columns, rows, tile size) for the given dimensions.
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

  // Create the <defs> block for SVG patterns.
  const defs = svg.append("defs");

  // Get the unique localities from the selected nodes.
  const uniqueLocalities = Array.from(
    new Set(selectedNodes.map((d) => d.locality))
  );

  // For each locality, create a pattern using the exact locality name.
  uniqueLocalities.forEach((locality) => {
    // Retrieve the image data from the mapping.
    const imgData = demolitionImages[locality];

    // Use a fallback image if the mapping is missing an entry.
    const imgFile = imgData ? imgData[0] : "default_placeholder.jpeg";

    console.log(`${cleanLocality(locality)}: ${imgFile}`);

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

  // Select the tile nodes based on the selectedNodes array and hide others.
  const tiles = nodes.filter((d) => selectedNodes.includes(d));
  nodes
    .filter((d) => !selectedNodes.includes(d))
    .attr("opacity", 0)
    .on("mouseover.tooltip", null)
    .on("mousemove.tooltip", null)
    .on("mouseout.tooltip", null);

  // Animate the selected nodes to their grid positions and apply the pattern fill.
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
      // Optionally handle any post-transition logic here.
      d3.select(this).classed("tiled", true);
    });

  return nodes;
}
