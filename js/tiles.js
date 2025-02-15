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
  RECT
) {
  // Ensure hidden nodes (that are not marked for the map) are visible for tiling.
  nodes.filter((d) => !d.showOnMap).style("display", "block");

  // Number of nodes to display in the grid.
  const N = 9;

  // Optionally shuffle or filter your nodes (here we filter using tileLocalities)
  const selectedNodes = palestinianDemolitions.filter((d) => d.tileNode);

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
    .filter((d) => !d.tileNode)
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
      d3.select(this).classed("tiled", true);
    });

  // Add click event to each tile node to open a pop-up.
  // When a tile is clicked, remove any existing pop-up, then create a new one.
  // The pop-up window size will be twice the tile's width/height
  // and will be centered relative to the entire grid.
  // Add click event to each tile node to open a pop-up.
  tiles.on("click", function (event, d) {
    // Remove any open pop-up.
    svg.selectAll(".tile-popup").remove();

    // Retrieve the SVG's dimensions.
    const svgWidth = parseFloat(svg.attr("width"));
    const svgHeight = parseFloat(svg.attr("height"));

    // Calculate the grid dimensions.
    // (Assuming your grid uses N=9 tiles, arranged as computed by calculateGridLayout)
    const gridWidth = cols * tileSize;
    const gridHeight = rows * tileSize;

    // Compute the offsets so that the grid is centered within the SVG.
    const gridOffsetX = (svgWidth - gridWidth) / 2;
    const gridOffsetY = (svgHeight - gridHeight) / 2;

    // Determine the center of the grid (the center of the 9 nodes).
    const centerX = gridOffsetX + gridWidth / 2;
    const centerY = gridOffsetY + gridHeight / 2;

    // Define the pop-up dimensions: 2x the tile's width & height.
    const popupWidth = 2 * tileSize;
    const popupHeight = 2 * tileSize;

    // Calculate top-left coordinates for the pop-up so that it is centered.
    const popupX = centerX - popupWidth / 2;
    const popupY = centerY - popupHeight / 2;

    // Append a group element for the pop-up.
    const popup = svg.append("g").attr("class", "tile-popup");

    // Pop-up background (a white window with rounded corners).
    popup
      .append("rect")
      .attr("x", popupX)
      .attr("y", popupY)
      .attr("width", popupWidth)
      .attr("height", popupHeight)
      .attr("fill", "white")
      .attr("stroke", "black")
      .attr("rx", 10)
      .attr("ry", 10);

    // Define margins for the image and text areas.
    const imageMargin = 10;
    const textMargin = 10;

    // Calculate the image area dimensions (top 60% of the pop-up, inset by imageMargin).
    const imageAreaX = popupX + imageMargin;
    const imageAreaY = popupY + imageMargin;
    const imageAreaWidth = popupWidth - 2 * imageMargin;
    const imageAreaHeight = popupHeight * 0.6 - 2 * imageMargin;

    // Retrieve the image file for this node.
    const imgData = demolitionImages[d.locality];
    const imgFile = imgData ? imgData[0] : "default_placeholder.jpeg";

    // Append the image for the top portion.
    popup
      .append("image")
      .attr("href", `images/${imgFile}`)
      .attr("x", imageAreaX)
      .attr("y", imageAreaY)
      .attr("width", imageAreaWidth)
      .attr("height", imageAreaHeight)
      .attr("preserveAspectRatio", "xMidYMid slice");

    // Calculate text area dimensions (bottom 40% of the pop-up, inset by textMargin).
    const textAreaX = popupX + textMargin;
    const textAreaY = popupY + popupHeight * 0.6 + textMargin;
    const textAreaWidth = popupWidth - 2 * textMargin;
    const textAreaHeight = popupHeight * 0.4 - 2 * textMargin;

    // Append a foreignObject element so the text area can scroll.
    popup
      .append("foreignObject")
      .attr("x", textAreaX)
      .attr("y", textAreaY)
      .attr("width", textAreaWidth)
      .attr("height", textAreaHeight)
      .append("xhtml:div")
      .style("width", "100%")
      .style("height", "100%")
      .style("overflow-y", "auto")
      .style("font-size", "14px")
      .style("color", "black")
      .style("padding", "5px").html(`
      <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Phasellus eget semper ipsum. Vestibulum velit justo, dapibus a lorem sed, dictum ultricies sem. Vivamus vel hendrerit erat, quis malesuada tellus. Donec ac tincidunt dolor, id lobortis magna.</p>
      <p>Sed sed mauris et risus semper dapibus. Curabitur id nibh a justo vestibulum mattis. Fusce ut nisi sapien. Praesent tincidunt fermentum risus, in sodales tortor elementum ac. Sed nec commodo nulla. Nam condimentum volutpat enim, in aliquam justo cursus a.</p>
      <p>Vestibulum ante ipsum primis in faucibus orci luctus et ultrices posuere cubilia curae; Integer auctor turpis in cursus consequat. Nam pretium leo eu est commodo, ac dapibus odio aliquet. Sed mollis blandit elit at ultrices.</p>
      <p>Proin imperdiet erat vel mi vehicula, eu dictum dolor commodo. Donec suscipit scelerisque leo, a pharetra mauris imperdiet nec. Nulla facilisi. Vivamus tristique bibendum massa, sit amet facilisis orci dapibus vitae.</p>
      <p>Donec euismod vitae ante ut venenatis. Vestibulum laoreet ex non quam feugiat, a molestie risus blandit. Suspendisse potenti. Nulla facilisi. Duis ultricies elit ac eros consequat, in bibendum neque faucibus.</p>
    `);

    // Define a size for the close (X) button.
    const closeButtonSize = 20;

    // Append a rectangle as a background for the close button in the top-right corner.
    popup
      .append("rect")
      .attr("class", "popup-close-btn")
      .attr("x", popupX + popupWidth - closeButtonSize - 5)
      .attr("y", popupY + 5)
      .attr("width", closeButtonSize)
      .attr("height", closeButtonSize)
      .attr("fill", "#ccc")
      .attr("stroke", "black")
      .attr("rx", 3)
      .attr("ry", 3)
      .style("cursor", "pointer")
      .on("click", function () {
        svg.selectAll(".tile-popup").remove();
      });

    // Append an "X" text on top of the close button.
    popup
      .append("text")
      .attr("x", popupX + popupWidth - closeButtonSize / 2 - 5)
      .attr("y", popupY + closeButtonSize / 2 + 5)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .text("X")
      .attr("fill", "black")
      .style("cursor", "pointer")
      .on("click", function () {
        svg.selectAll(".tile-popup").remove();
      });
  });

  return nodes;
}
