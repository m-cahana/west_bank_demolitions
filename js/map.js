// *******************
// mapbox set up and functions
// *******************
export const AnimationController = function (demolitionDates, nodes, RECT) {
  let currentIndex = 0;
  let isPaused = false;
  let timeoutId = null;

  // Define speeds
  const animationSpeed = 5000; // 5 seconds per plate

  // Function to add a point and update the map
  function fadeBlocks(currentDate, nodes, RECT) {
    const formattedYear = currentDate.getFullYear();

    nodes.attr("opacity", (d) =>
      d.date_of_demolition <= currentDate && d.showOnMap
        ? RECT.DEMOLISHED_OPACITY
        : RECT.OPACITY
    );

    d3.select("#map").select("#date-display").text(`Year: ${formattedYear}`);
  }

  function iterateDates(demolitionDates) {
    if (currentIndex >= demolitionDates.length) {
      return;
    }

    const currentDate = demolitionDates[currentIndex];
    fadeBlocks(currentDate, nodes, RECT);
    currentIndex++;

    // Schedule the next iteration
    if (!isPaused) {
      // Add check here to prevent scheduling if already paused
      timeoutId = setTimeout(() => {
        if (!isPaused) {
          iterateDates(demolitionDates);
        }
      }, animationSpeed / demolitionDates.length);
    }
  }

  return {
    start: function () {
      isPaused = false;
      currentIndex = 0;
      if (timeoutId) {
        // Clear any existing timeout before starting
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      iterateDates(demolitionDates);
    },
    pause: function () {
      isPaused = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      // Add this to ensure nodes stop transitioning
      nodes.interrupt();
      nodes.transition().duration(0).attr("opacity", RECT.OPACITY);
    },
    resume: function () {
      if (!isPaused) return;
      isPaused = false;
      iterateDates(demolitionDates);
    },
  };
};

export function drawMap(
  map,
  svg,
  ADJ_WIDTH,
  ADJ_HEIGHT,
  demolitionDates,
  nodes,
  RECT,
  simulation,
  animationController,
  palestinianDemolitions,
  RECT_ADJUSTMENT_FACTOR
) {
  svg
    .select(".map-foreignobject")
    .attr("width", ADJ_WIDTH)
    .attr("height", ADJ_HEIGHT)
    .style("width", `${ADJ_WIDTH}px`)
    .style("height", `${ADJ_HEIGHT}px`);

  map = new mapboxgl.Map({
    container: "map",
    style: "mapbox://styles/mapbox/light-v11",
    center: [35.1, 31.925], // [lng, lat]
    zoom: 7,
  });

  showMap();

  function adjustMapBounds() {
    // calculate the bounding box
    const bounds = new mapboxgl.LngLatBounds();

    // extract coordinates
    const coordinates = palestinianDemolitions
      .filter((d) => d.showOnMap)
      .map((d) => [d.long, d.lat]);

    coordinates.forEach((coord) => {
      bounds.extend(coord);
    });

    // fit the map to the calculated bounds with padding
    map.fitBounds(bounds, {
      padding: 50 * RECT_ADJUSTMENT_FACTOR,
      duration: 1000, // duration in milliseconds for the animation
      essential: true, // ensure animation is not affected by user preferences
    });
  }

  map.on("load", async () => {
    await initiateNodeTransition(nodes, map, RECT, simulation);
    animationController.start();
  });

  return { map, animationController };
}

export function hideMap() {
  // Select and hide map canvas(es)
  d3.select("#map").selectAll(".mapboxgl-canvas").style("display", "none");

  // Hide date display
  d3.select("#map").select("#date-display").style("display", "none");

  // Hide all Mapbox controls and branding
  d3.selectAll(
    ".mapboxgl-ctrl-container, .mapboxgl-ctrl, .mapboxgl-control, .mapboxgl-ctrl-logo, .mapboxgl-ctrl-attrib"
  ).style("display", "none");
}

export function showMap() {
  // Show map canvas(es)
  d3.select("#map").selectAll(".mapboxgl-canvas").style("display", "block");

  // Show date display
  d3.select("#map").select("#date-display").style("display", "block");

  // Show all Mapbox controls and branding
  d3.selectAll(
    ".mapboxgl-ctrl-container, .mapboxgl-ctrl, .mapboxgl-control, .mapboxgl-ctrl-logo, .mapboxgl-ctrl-attrib"
  ).style("display", "block");
}

export function initiateNodeTransition(nodes, map, RECT, simulation) {
  nodes.filter((d) => !d.showOnMap).style("display", "none");

  // Reparent nodes to the map overlay
  const mapOverlay = d3.select("#map").select("svg.map-overlay");
  nodes.each(function () {
    // Store current positions before moving to overlay
    const node = d3.select(this);
    const currentX = node.attr("x");
    const currentY = node.attr("y");

    // Move to overlay and preserve position
    mapOverlay.node().appendChild(this);
    node.attr("x", currentX).attr("y", currentY);
  });

  function setNodePositions(selection, map) {
    selection
      .attr(
        "x",
        (d) =>
          map.project([d.long, d.lat]).x +
          d.offsetX -
          (Math.sqrt(d.housing_units) * RECT.WIDTH) / 2
      )
      .attr(
        "y",
        (d) =>
          map.project([d.long, d.lat]).y +
          d.offsetY -
          (Math.sqrt(d.housing_units) * RECT.HEIGHT) / 2
      );
  }

  function updateNodePositions() {
    setNodePositions(nodes, map);
  }

  // update node positions if map is moved later
  map.on("move", updateNodePositions);
  map.on("zoom", updateNodePositions);

  // animate transition
  return new Promise((resolve, reject) => {
    nodes
      .raise()
      .transition()
      .duration(1000)
      // ensure proper widths and heights
      .attr("width", (d) => d.housing_units ** (1 / 2) * RECT.WIDTH)
      .attr("height", (d) => d.housing_units ** (1 / 2) * RECT.HEIGHT)
      .call(setNodePositions, map)
      .on("end", () => {
        console.log("Node transition to map completed.");
        resolve();
      });

    simulation.stop();
  });
}

export function renderHiddenMapNodes(nodes) {
  nodes
    .filter((d) => !d.showOnMap && d.people_left_homeless > 0)
    .style("display", "block");
}
