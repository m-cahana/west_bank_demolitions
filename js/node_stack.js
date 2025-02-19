// *******************
// stack nodes by year to show homelessness
// *******************

export function stackNodes(
  palestinianDemolitions,
  mapSvg,
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
  // Quickly look up the aggregated sum for each year
  const aggregatedMap = new Map(aggregatedData);
  // Sort years in ascending order
  aggregatedData.sort((a, b) => d3.ascending(a[0], b[0]));

  // Calculate the effective chart dimensions.
  // The available drawing area for the bar chart is the adjusted height minus top and bottom margins.
  const chartHeight = ADJ_HEIGHT - BAR_MARGIN.TOP - BAR_MARGIN.BOTTOM;
  const chartWidth = ADJ_WIDTH - BAR_MARGIN.LEFT - BAR_MARGIN.RIGHT;

  // Create or update the bar chart group for axes and labels.
  // In this implementation, we translate the entire bar chart by (BAR_MARGIN.LEFT, BAR_MARGIN.TOP).
  let barChart = mapSvg.select(".bar-chart");
  if (barChart.empty()) {
    barChart = mapSvg
      .append("g")
      .attr("class", "bar-chart")
      .attr("transform", `translate(${BAR_MARGIN.LEFT}, ${BAR_MARGIN.TOP})`);

    // Append the X axis group and position it at the bottom of the chart area.
    barChart
      .append("g")
      .attr("class", "x-axis")
      .attr("transform", `translate(0, ${chartHeight})`)
      .call(
        d3.axisBottom(
          d3
            .scaleBand()
            .domain(aggregatedData.map((d) => d[0]))
            .range([0, chartWidth])
            .padding(0.2)
        )
      )
      .selectAll("text")
      .attr("transform", "translate(-10,0)rotate(-45)")
      .style("text-anchor", "end");

    // Append the x-axis label (centered).
    barChart
      .append("text")
      .attr("class", "x-label")
      .attr("text-anchor", "middle")
      .attr("x", chartWidth / 2)
      // Place the label below the x-axis. Adjust the offset (e.g., +BAR_MARGIN.BOTTOM - 10) as needed.
      .attr("y", chartHeight + BAR_MARGIN.BOTTOM)
      .text("Year");

    // Append the Y axis group.
    barChart
      .append("g")
      .attr("class", "y-axis")
      .call(
        d3.axisLeft(
          d3
            .scaleLinear()
            .domain([0, d3.max(aggregatedData, (d) => d[1])])
            .nice()
            .range([chartHeight, 0])
        )
      );

    // Append the y-axis label (centered and rotated).
    barChart
      .append("text")
      .attr("class", "y-label")
      .attr("text-anchor", "middle")
      // Set x to be centered in the chart area (negative because we're rotating).
      .attr("x", -chartHeight / 2)
      // Move it to the left with an offset. Adjust as needed for better placement.
      .attr("y", -BAR_MARGIN.LEFT + 30)
      .attr("transform", "rotate(-90)")
      .text("People Left Homeless");
  } else {
    // If the group already exists, ensure the axes and labels are shown.
    barChart
      .selectAll(".x-axis, .y-axis, .x-label, .y-label")
      .style("display", "block")
      .style("opacity", 1);
  }

  // --- Stack the Nodes by Year without reparenting ---
  // Get actual DOM nodes from the D3 selection.
  const nodeElements = nodes.nodes();

  // Group node elements by the demolition year.
  const nodesByYear = d3.group(nodeElements, (el) =>
    el.__data__.date_of_demolition.getFullYear()
  );

  // Create an x scale for node positioning using the same range as the axis.
  const xScale = d3
    .scaleBand()
    .domain(aggregatedData.map((d) => d[0]))
    .range([BAR_MARGIN.LEFT, chartWidth + BAR_MARGIN.LEFT])
    .padding(0.2);
  const nodeWidth = xScale.bandwidth() / 3;

  nodesByYear.forEach((elements, year) => {
    // Optionally sort nodes within the group.
    elements.sort((a, b) =>
      d3.ascending(
        a.__data__.people_left_homeless,
        b.__data__.people_left_homeless
      )
    );

    // Total of square roots of people_left_homeless for this year.
    const totalSqrt = d3.sum(elements, (el) =>
      Math.sqrt(el.__data__.people_left_homeless)
    );

    // The aggregated sum gives the full height of the bar.
    const aggregatedSum = aggregatedMap.get(year);
    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(aggregatedData, (d) => d[1])])
      .nice()
      .range([chartHeight, 0]);
    // Compute the bar's pixel height from the chart area
    const barPixelHeight = chartHeight - yScale(aggregatedSum);

    // Scale factor to convert each node's sqrt value to pixel height.
    const scaleFactor = totalSqrt > 0 ? barPixelHeight / totalSqrt : 0;

    let cumulative = 0; // Running total for stacking the nodes.
    elements.forEach((node) => {
      const d = node.__data__;
      const sqrtValue = Math.sqrt(d.people_left_homeless);
      const nodeHeight = sqrtValue * scaleFactor;
      cumulative += nodeHeight;

      // Compute base x and y in the chart's coordinate space.
      const baseX = xScale(year);
      // baseY is measured from the bottom of the chart area (chartHeight)
      const baseY = chartHeight - cumulative;

      // Since the nodes are drawn in the overall SVG (mapSvg) and not within the translated barChart group,
      // we add the same margin offsets used in the barChart transform.
      const newX = baseX + xScale.bandwidth() / 2 - nodeWidth / 2;
      const newY = baseY + BAR_MARGIN.TOP;

      // Update the node's position.
      d.x = newX;
      d.y = newY;

      d3.select(node)
        .transition()
        .duration(1000)
        .attr("x", newX)
        .attr("y", newY)
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
