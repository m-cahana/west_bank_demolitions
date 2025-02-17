// *******************
// stack nodes by year to show homelessness
// *******************

export function stackNodes(
  palestinianDemolitions,
  svg,
  ADJ_WIDTH,
  ADJ_HEIGHT,
  nodes,
  RECT,
  BAR_MARGIN
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
  const width = ADJ_WIDTH - BAR_MARGIN.left - BAR_MARGIN.right;
  const height = ADJ_HEIGHT - BAR_MARGIN.top - BAR_MARGIN.bottom;

  // Create or update the bar chart group for axes and labels
  let barChart = svg.select(".bar-chart");
  if (barChart.empty()) {
    barChart = svg
      .append("g")
      .attr("class", "bar-chart")
      .attr("transform", `translate(${BAR_MARGIN.left},${BAR_MARGIN.top})`);

    // Append X axis group.
    barChart
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${height})`)
      .call(
        d3.axisBottom(
          d3
            .scaleBand()
            .domain(aggregatedData.map((d) => d[0]))
            .range([0, width])
            .padding(0.2)
        )
      )
      .selectAll("text")
      .attr("transform", "translate(-10,0)rotate(-45)")
      .style("text-anchor", "end");

    // Append Y axis group.
    barChart
      .append("g")
      .attr("class", "y-axis")
      .call(
        d3.axisLeft(
          d3
            .scaleLinear()
            .domain([0, d3.max(aggregatedData, (d) => d[1])])
            .nice()
            .range([height, 0])
        )
      );

    // Append y-axis label.
    barChart
      .append("text")
      .attr("class", "y-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -height / 2)
      .attr("y", -BAR_MARGIN.top * 1.2)
      .attr("dy", "1em")
      .style("text-anchor", "middle")
      .text("People Left Homeless");

    // Append x-axis label.
    barChart
      .append("text")
      .attr("class", "x-label")
      .attr("x", width / 2)
      .attr("y", height + BAR_MARGIN.bottom * 1.1)
      .style("text-anchor", "middle")
      .text("Year");
  } else {
    // If the group already exists, ensure the axes and labels are visible.
    barChart
      .selectAll(".x-axis, .y-axis, .x-label, .y-label")
      .style("display", "block")
      .style("opacity", 1);
  }

  // --- Stack the Nodes by Year without reparenting ---
  // Get the actual DOM nodes from the D3 selection.
  const nodeElements = nodes.nodes();

  // Group node elements by year.
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
    const barPixelHeight =
      height -
      d3
        .scaleLinear()
        .domain([0, d3.max(aggregatedData, (d) => d[1])])
        .nice()
        .range([height, 0])(aggregatedSum);

    // A scale factor to convert each node's sqrt value to a pixel height.
    const scaleFactor = totalSqrt > 0 ? barPixelHeight / totalSqrt : 0;

    let cumulative = 0; // running total for stacking the nodes

    // Compute the node width as a fraction of the available band.
    const xScale = d3
      .scaleBand()
      .domain(aggregatedData.map((d) => d[0]))
      .range([0, width])
      .padding(0.2);
    const nodeWidth = xScale.bandwidth() / 3;

    elements.forEach((node) => {
      const d = node.__data__;
      const sqrtValue = Math.sqrt(d.people_left_homeless);
      const nodeHeight = sqrtValue * scaleFactor;
      cumulative += nodeHeight;

      // Compute base positions relative to the bar chart coordinate system.
      // xScale(year) gives the left edge of the band for that year.
      // We center the node by offsetting half the difference between the band and node width.
      const baseX = xScale(year) + (xScale.bandwidth() - nodeWidth);
      const baseY = height - cumulative;

      // Add the margin offset to align with the bar chart's placement.
      // Since we're not reparenting, the nodes remain in the original container.
      const finalX = baseX + BAR_MARGIN.left / 2;
      const finalY = baseY;

      d3.select(node)
        .transition()
        .duration(1000)
        .attr("x", finalX)
        .attr("y", finalY)
        .attr("width", nodeWidth)
        .attr("height", nodeHeight)
        .attr("opacity", RECT.OPACITY);
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
