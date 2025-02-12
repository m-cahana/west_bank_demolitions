// *******************
// tile set up and functions
// *******************

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
  // number of nodes to display
  const N = 9;

  // shuffle the nodes array and select the first N nodes
  const shuffled = palestinianDemolitions
    .slice()
    .sort(() => 0.5 - Math.random());

  const selectedNodesTwo = palestinianDemolitions.filter(
    (d) =>
      d.locality == "Masafer Yatta" ||
      (d.locality == "a-Rakeez" && d.people_left_homeless == 12) ||
      (d.locality == "al-Walajah" && d.people_left_homeless == 5) ||
      (d.locality == "al-Walajah" && d.people_left_homeless == 5) ||
      (d.locality == "Um al-Kheir" && d.people_left_homeless == 15)
  );
  const selectedNodes = shuffled.slice(0, N);

  const { cols, rows, tileSize } = calculateGridLayout(
    N,
    ADJ_HEIGHT,
    ADJ_HEIGHT
  );

  // assign each selected node to a grid cell
  selectedNodes.forEach((d, i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;

    // Calculate target position
    d.tileTargetX = col * tileSize;
    d.tileTargetY = row * tileSize;

    // Set target size to tileSize
    d.targetWidth = tileSize;
    d.targetHeight = tileSize;
  });

  // Define the pattern
  const defs = svg.append("defs");

  defs
    .append("pattern")
    .attr("id", "tile-image") // Unique identifier for the pattern
    .attr("patternUnits", "objectBoundingBox") // Scale pattern relative to the tile
    .attr("patternContentUnits", "objectBoundingBox") // Scale content relative to the pattern
    .attr("width", 1) // Full width of the bounding box
    .attr("height", 1) // Full height of the bounding box
    .append("image")
    .attr("href", "images/khirbet_main_demolition.jpg") // Path to your image
    .attr("preserveAspectRatio", "xMidYMid slice") // Adjust how the image scales within the pattern
    .attr("width", 1) // Full width of the pattern
    .attr("height", 1); // Full height of the pattern

  // Select the tile nodes and hide others
  const tiles = nodes.filter((d) => selectedNodes.includes(d));

  nodes.filter((d) => !selectedNodes.includes(d)).attr("opacity", 0);

  // Transition selected nodes to their grid positions and sizes
  tiles
    .transition()
    .duration(1000)
    .attr("opacity", RECT.OPACITY)
    .style("fill", "url(#tile-image)") // Apply the pattern fill
    .style("stroke", "white")
    .style("stroke-width", 1)
    .attr("x", (d) => d.tileTargetX)
    .attr("y", (d) => d.tileTargetY)
    .attr("width", (d) => d.targetWidth)
    .attr("height", (d) => d.targetHeight)
    .on("end", function (event, d) {
      // Optionally, handle post-transition logic here
      d3.select(this).classed("tiled", true);
    });

  return nodes;
}
