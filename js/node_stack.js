// *******************
// mapbox set up and functions
// *******************

export function stackNodesByDistrict() {
  // Aggregate data by district
  const aggregatedData = d3.rollups(
    palestinianDemolitions,
    (v) => d3.sum(v, (d) => d.people_left_homeless),
    (d) => d.district // Grouping by 'district'
  );

  // Sort data by the number of people left homeless (descending)
  aggregatedData.sort((a, b) => d3.descending(a[1], b[1]));

  // Set dimensions for the bar chart
  const margin = { top: 50, right: 30, bottom: 100, left: 60 };
  const width = ADJ_WIDTH - margin.left - margin.right;
  const height = ADJ_HEIGHT - margin.top - margin.bottom;

  // Remove existing bar chart if any
  svg.selectAll(".bar-chart").remove();

  // Append a new group for the bar chart
  const barChart = svg
    .append("g")
    .attr("class", "bar-chart")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  // Set up scales
  const x = d3
    .scaleBand()
    .domain(aggregatedData.map((d) => d[0]))
    .range([0, width])
    .padding(0.2);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(aggregatedData, (d) => d[1]) * 1.1])
    .nice()
    .range([height, 0]);

  // Add X axis
  barChart
    .append("g")
    .attr("transform", `translate(0,${height})`)
    .call(d3.axisBottom(x))
    .selectAll("text")
    .attr("transform", "translate(-10,0)rotate(-45)")
    .style("text-anchor", "end");

  // Add Y axis
  barChart.append("g").call(d3.axisLeft(y));

  // Add Y axis label
  barChart
    .append("text")
    .attr("transform", "rotate(-90)")
    .attr("y", -margin.left + 15)
    .attr("x", -height / 2)
    .attr("dy", "-1.5em")
    .style("text-anchor", "middle")
    .text("Number of People Left Homeless");

  // Add X axis label
  barChart
    .append("text")
    .attr("x", width / 2)
    .attr("y", height + margin.bottom - 40)
    .style("text-anchor", "middle")
    .text("Districts");

  // Create a group for each bar (district)
  const barGroups = barChart
    .selectAll(".bar-group")
    .data(aggregatedData)
    .enter()
    .append("g")
    .attr("class", "bar-group")
    .attr("transform", (d) => `translate(${x(d[0])},0)`);

  // Group nodes by district
  const nodesByDistrict = d3.group(palestinianDemolitions, (d) => d.district);

  // Define a scale for stacking nodes vertically within bars
  const stackScale = d3
    .scaleLinear()
    .domain([0, d3.max(aggregatedData, (d) => d[1])])
    .range([height, 0]);

  // Position existing nodes within the bar chart
  nodes
    .attr("display", "none") // Hide nodes initially
    .filter((d) => d.district) // Ensure district exists
    .each(function (d) {
      // Select the corresponding bar group
      const barGroup = barChart
        .selectAll(".bar-group")
        .filter(function (barData) {
          return barData[0] === d.district;
        });

      if (!barGroup.empty()) {
        // Calculate the y-position based on cumulative people left homeless
        const cumulativeData = nodesByDistrict
          .get(d.district)
          .filter((nd) => nd.people_left_homeless <= d.people_left_homeless);
        const cumulativeSum = d3.sum(
          cumulativeData,
          (nd) => nd.people_left_homeless
        );

        // Define the position within the bar
        const barY =
          y(cumulativeSum) -
          (Math.sqrt(d.people_left_homeless) * RECT.HEIGHT) / 2;

        // Position the node within the bar
        d3.select(this)
          .attr("x", x(d.district) + x.bandwidth() / 4) // Center within the bar
          .attr("y", margin.top + barY)
          .attr("width", x.bandwidth() / 2)
          .attr("height", Math.sqrt(d.people_left_homeless) * RECT.HEIGHT)
          .attr("fill", "#404080")
          .attr("opacity", 0.6)
          .attr("display", "block"); // Show the node
      }
    })
    .on("mouseover", function (event, d) {
      tooltip
        .html(
          `<strong>District:</strong> ${d.district}<br>
             <strong>People Left Homeless:</strong> ${d.people_left_homeless}<br>`
        )
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY + 10}px`)
        .classed("visible", true);

      // Highlight the node
      d3.select(this).classed("highlighted", true);
    })
    .on("mousemove", function (event) {
      // Update tooltip position as the mouse moves
      tooltip
        .style("left", `${event.pageX + 10}px`)
        .style("top", `${event.pageY + 10}px`);
    })
    .on("mouseout", function () {
      // Hide the tooltip when mouse moves away
      tooltip.classed("visible", false);

      // Remove highlight
      d3.select(this).classed("highlighted", false);
    });
}
