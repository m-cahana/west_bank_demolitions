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
  // The pop-up will be centered on the grid of tiles and its image centered within it.
  tiles.on("click", function (event, d) {
    console.log(`d: ${d}`);
    console.log(`d.locality: ${d.locality}`);
    // Remove any open pop-up.
    svg.selectAll(".tile-popup").remove();

    // Retrieve the SVG's dimensions.
    const svgWidth = parseFloat(svg.attr("width"));
    const svgHeight = parseFloat(svg.attr("height"));

    // Calculate the grid dimensions.
    const gridWidth = cols * tileSize;
    const gridHeight = rows * tileSize;

    // Center the grid within the SVG.
    const gridOffsetX = (svgWidth - gridWidth) / 2;
    const gridOffsetY = (svgHeight - gridHeight) / 2;

    // Determine the center of the grid.
    const gridCenterX = gridOffsetX + gridWidth / 2;
    const gridCenterY = gridOffsetY + gridHeight / 2;

    // Define the pop-up dimensions.
    // (You can adjust popUpFactor as needed; here we keep it to scale relative to the tile size).
    const popUpFactor = 2.8;
    const popupWidth = popUpFactor * tileSize;
    const popupHeight = popUpFactor * tileSize;

    // Calculate top-left coordinates for the pop-up so that it is perfectly centered.
    const popupX = gridCenterX - popupWidth / 2;
    const popupY = gridCenterY - popupHeight / 2;

    // Append a group element for the pop-up.
    const popup = svg.append("g").attr("class", "tile-popup");

    // Pop-up background: a white window with border.
    popup
      .append("rect")
      .attr("x", popupX)
      .attr("y", popupY)
      .attr("width", popupWidth)
      .attr("height", popupHeight)
      .attr("fill", "white")
      .attr("stroke", "black")
      .attr("rx", 0)
      .attr("ry", 0);

    // Use a constant margin so that everything in the pop-up is symmetrically inset.
    const imageMargin = 20;
    const textMargin = 20;

    // Calculate the image area dimensions (top 60% of the pop-up, with equal margins).
    const imageAreaX = popupX + imageMargin;
    const imageAreaY = popupY + imageMargin;
    const imageAreaWidth = popupWidth * 0.6 - 2 * imageMargin;
    const imageAreaHeight = popupHeight * 0.6 - 2 * imageMargin;

    // Retrieve the image file for this node.
    const imgData = demolitionImages[d.locality];
    const imgFile = imgData ? imgData[0] : "default_placeholder.jpeg";

    // Append the image for the top portion and center it within its area.
    popup
      .append("image")
      .attr("href", `images/${imgFile}`)
      .attr("x", imageAreaX)
      .attr("y", imageAreaY)
      .attr("width", imageAreaWidth)
      .attr("height", imageAreaHeight)
      .attr("preserveAspectRatio", "xMidYMid slice");

    // Calculate the image area dimensions (top 60% of the pop-up, with equal margins).
    const captionAreaX = popupX / 0.425 + imageMargin;
    const captionAreaY = popupY / 0.8 + imageMargin;
    const captionAreaWidth = popupWidth * 0.6 - 2 * imageMargin;
    const captionAreaHeight = popupHeight * 0.6 - 2 * imageMargin;

    popup
      .append("foreignObject")
      .attr("class", "popup-text")
      .attr("x", captionAreaX)
      .attr("y", captionAreaY)
      .attr("width", captionAreaWidth)
      .attr("height", captionAreaHeight)
      .append("xhtml:div")
      .attr("class", "popup-text-content")
      .html(
        `<pre>
        ${d.locality_cleaned} 
            ${d.district} 
            
        ${formatDate(d.date_of_demolition)} 
          ${d.people_left_homeless} people left homeless
        </pre>`
      );

    // Append a foreignObject for additional text content (if needed).
    const textAreaX = popupX + textMargin;
    const textAreaY = popupY + popupHeight * 0.6 + textMargin - imageMargin;
    const textAreaWidth = popupWidth - 2 * textMargin;
    const textAreaHeight = popupHeight * 0.4 - 2 * textMargin;

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

    // Define the size for the close (X) button.
    const closeButtonSize = 20;

    // Append an "X" text in the upper-right corner of the pop-up.
    popup
      .append("text")
      .attr("x", popupX + popupWidth - closeButtonSize - 5)
      .attr("y", popupY + closeButtonSize + 5)
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
