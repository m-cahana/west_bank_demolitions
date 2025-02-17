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

  // Function to iterate through all dates
  function iterateDates(demolitionDates) {
    if (currentIndex >= demolitionDates.length) {
      // Stop the animation when all dates have been processed
      return;
    }

    const currentDate = demolitionDates[currentIndex];

    // Add points if any
    fadeBlocks(currentDate, nodes, RECT);
    currentIndex++;

    // Schedule the next iteration
    timeoutId = setTimeout(() => {
      if (!isPaused) {
        iterateDates(demolitionDates);
      }
    }, animationSpeed / demolitionDates.length);
  }

  return {
    start: function () {
      isPaused = false;
      currentIndex = 0;
      iterateDates(demolitionDates);
    },
    pause: function () {
      isPaused = true;
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    },
    resume: function () {
      if (!isPaused) return;
      isPaused = false;
      iterateDates(demolitionDates);
    },
  };
};

export function drawMap(
  mapGenerate,
  map,
  demolitionDates,
  nodes,
  RECT,
  simulation,
  animationController,
  palestinianDemolitions,
  RECT_ADJUSTMENT_FACTOR
) {
  if (mapGenerate) {
    // Set your Mapbox access token
    mapboxgl.accessToken =
      "pk.eyJ1IjoibWljaGFlbC1jYWhhbmEiLCJhIjoiY202anoyYWs1MDB5NTJtcHdscXRpYWlmeSJ9.sKNNFh9wACNAHYN4ExzyWQ";

    // Initialize the Mapbox map
    map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/light-v11",
      center: [35.1, 31.925], // [lng, lat]
      zoom: 7,
    });

    // Add zoom and rotation controls to the map.
    map.addControl(new mapboxgl.NavigationControl());
  } else {
    d3.select("#map").selectAll(".mapboxgl-canvas").style("display", "block");

    d3.select("#map").select("#date-display").style("display", "block");

    d3.selectAll(
      ".mapboxgl-ctrl-container, .mapboxgl-ctrl, .mapboxgl-control"
    ).style("display", "block");

    (async () => {
      try {
        // Await the completion of node transitions
        await initiateNodeTransition(nodes, map, RECT, simulation);

        adjustMapBounds();
        // Start the animation after transitions are complete
        animationController.start();
      } catch (error) {
        console.error("Error during node transition:", error);
      }
    })();
  }

  // Select existing 'date-display' or create it if it doesn't exist
  let dateDisplay = d3.select("#map").select("#date-display");
  if (dateDisplay.empty()) {
    dateDisplay = d3
      .select("#map")
      .append("div")
      .attr("id", "date-display")
      .style("position", "absolute")
      .text(`Year: ${demolitionDates[0].getFullYear()}`)
      .style("display", "block");
  } else {
    // If it exists, ensure it's visible
    dateDisplay
      .text(`Year: ${demolitionDates[0].getFullYear()}`)
      .style("display", "block");
  }

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

  // Once the map loads, create an SVG overlay for D3 elements
  map.on("load", async () => {
    try {
      // Await the completion of node transitions
      await initiateNodeTransition(nodes, map, RECT, simulation);

      adjustMapBounds();

      // Start the animation after transitions are complete
      animationController.start();
    } catch (error) {
      console.error("Error during node transition:", error);
    }
  });

  return { map, animationController };
}

export function hideMap() {
  // Select and hide only the map canvas(es)
  d3.select("#map").selectAll(".mapboxgl-canvas").style("display", "none");

  d3.select("#map").select("#date-display").style("display", "none");

  d3.selectAll(
    ".mapboxgl-ctrl-container, .mapboxgl-ctrl, .mapboxgl-control"
  ).style("display", "none");
}

export function initiateNodeTransition(nodes, map, RECT, simulation) {
  nodes.filter((d) => !d.showOnMap).style("display", "none");

  // Reparent nodes to the map overlay
  const mapOverlay = d3.select("#map").select("svg.map-overlay");
  nodes.each(function () {
    mapOverlay.node().appendChild(this);
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
