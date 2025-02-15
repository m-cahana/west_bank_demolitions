// *******************
// stack nodes by year to show homelessness
// *******************

export function stackNodes(
  palestinianDemolitions,
  svg,
  ADJ_WIDTH,
  ADJ_HEIGHT,
  nodes,
  RECT
) {
  // --- Aggregate Data ---
  const aggregatedData = d3.rollups(
    palestinianDemolitions,
    (v) => d3.sum(v, (d) => d.people_left_homeless),
    (d) => d.date_of_demolition.getFullYear()
  );
  // For quick look-up of the aggregated sum for each year:
  const aggregatedMap = new Map(aggregatedData);
  // Sort years in ascending order
  aggregatedData.sort((a, b) => d3.ascending(a[0], b[0]));

  // --- Chart Dimensions and Scales ---
  const margin = { top: 50, right: 30, bottom: 50, left: 200 };
  const width = ADJ_WIDTH - margin.left - margin.right;
  const height = ADJ_HEIGHT - margin.top - margin.bottom;

  // x-scale: maps years (as numbers) to bands
  const x = d3
    .scaleBand()
    .domain(aggregatedData.map((d) => d[0]))
    .range([0, width])
    .padding(0.2);

  // y-scale: maps aggregated homelessness values to vertical pixel positions
  const y = d3
    .scaleLinear()
    .domain([0, d3.max(aggregatedData, (d) => d[1])])
    .nice()
    .range([height, 0]);

  // --- Create or Update the Bar Chart Group and Axes ---
  // Check if a group with class "bar-chart" already exists.
  let barChart = svg.select(".bar-chart");

  if (barChart.empty()) {
    // Create the group and translate it by the margins so that (0,0) is the top-left
    // corner of the chart (not the full SVG).
    barChart = svg
      .append("g")
      .attr("class", "bar-chart")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    // Append X axis group.
    barChart
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${height})`)
      .call(d3.axisBottom(x))
      .selectAll("text")
      .attr("transform", "translate(-10,0)rotate(-45)")
      .style("text-anchor", "end");

    // Append Y axis group.
    barChart.append("g").attr("class", "y-axis").call(d3.axisLeft(y));

    // Append y-axis label.
    barChart
      .append("text")
      .attr("class", "y-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -margin.top * 1.2) // Fixed offset; adjust as needed.
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .text("People Left Homeless");

    // Append x-axis label.
    barChart
      .append("text")
      .attr("class", "x-label")
      .attr("x", width / 2)
      .attr("y", height + margin.bottom * 1.1) // Adjust based on bottom margin.
      .style("text-anchor", "middle")
      .text("Year");
  } else {
    // If the group already exists, update scales and simply make sure these elements are visible.
    barChart
      .selectAll(".x-axis, .y-axis, .x-label, .y-label")
      .style("display", "block")
      .style("opacity", 1);
  }

  // --- Reparent the Nodes ---
  // If the nodes (e.g., rectangles or other elements) were previously appended to svg,
  // move (or reparent) them into the barChart group so that they use the same coordinate system.
  // --- Reparent only non-tile nodes ---
  nodes
    .filter((d) => !d.tileNode)
    .each(function () {
      barChart.node().appendChild(this);
    });

  // --- Stack the Nodes by Year ---
  // Now that nodes share the same coordinate system (the bar chart group), position them.
  const nodeElements = nodes.nodes();
  const nodesByYear = d3.group(nodeElements, (el) =>
    el.__data__.date_of_demolition.getFullYear()
  );

  nodesByYear.forEach((elements, year) => {
    // Optionally sort nodes within the group.
    elements.sort((a, b) =>
      d3.ascending(
        a.__data__.people_left_homeless,
        b.__data__.people_left_homeless
      )
    );

    // Sum of the square roots of people_left_homeless for this year.
    const totalSqrt = d3.sum(elements, (el) =>
      Math.sqrt(el.__data__.people_left_homeless)
    );

    // The aggregated sum gives us the total height of the bar.
    const aggregatedSum = aggregatedMap.get(year);
    const barPixelHeight = height - y(aggregatedSum);

    // A scale factor to convert each node's sqrt value to a pixel height.
    const scaleFactor = totalSqrt > 0 ? barPixelHeight / totalSqrt : 0;

    let cumulative = 0; // running total for stacking the nodes

    // Node width is a fraction of the available band.
    const nodeWidth = x.bandwidth() / 3;

    elements.forEach((node) => {
      const d = node.__data__;
      const sqrtValue = Math.sqrt(d.people_left_homeless);
      const nodeHeight = sqrtValue * scaleFactor;
      cumulative += nodeHeight;

      // Compute base positions relative to the bar chart coordinate system.
      const baseX = x(year) + (x.bandwidth() - nodeWidth) / 2;
      const baseY = height - cumulative;

      // For nodes reparented to the bar chart, the "base" coordinates are correct.
      // For tile nodes (that remain in the original container), add the bar chart group's
      // transform offset (margin) so that they appear in the right global position.
      const finalX = d.tileNode ? baseX + margin.left : baseX;
      const finalY = d.tileNode ? baseY + margin.top : baseY;

      d3.select(node)
        .transition()
        .duration(1000)
        .attr("x", finalX)
        .attr("y", finalY)
        .attr("width", nodeWidth)
        .attr("height", nodeHeight)
        .attr("fill", "#404080")
        .attr("opacity", 0.6);
    });
  });
}

export function hideBarChartAxesAndLabels() {
  d3.select(".bar-chart")
    .selectAll(".x-axis, .y-axis, .x-label, .y-label")
    .transition()
    .duration(500)
    .style("opacity", 0)
    .on("end", function () {
      d3.select(this).style("display", "none");
    });
}
