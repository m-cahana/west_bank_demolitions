// *******************
// Line Functions and Classes
// *******************

export function duBoisLine(
  totalSteps = 105,
  stepLength = 25,
  initialY = 0,
  yChange = 10,
  Increment = true,
  nSteps = 10
) {
  let currentY = initialY;
  let steps = Array.from({ length: nSteps }, (_, i) => i);
  const data = [];

  for (let i = 0; i < totalSteps; i++) {
    const step = steps[i % nSteps] * stepLength;
    data.push({ step, value: currentY });

    if ((i + 1) % nSteps === 0) {
      steps.reverse(); // Reverse the steps to oscillate
      if (Increment) {
        currentY += yChange; // Increment Y after a full cycle
      } else {
        currentY -= yChange; // Decrement Y after a full cycle
      }
    }
  }

  return data;
}

export class AnimatedLine {
  /**
   * @param {d3.selection} lineGroup - The group element to append the path.
   * @param {string} className - Class name for the path.
   * @param {string} color - Stroke color for the path.
   * @param {Array} generatorParams - Parameters for the duBoisLine function.
   * @param {d3.line} lineGenerator - D3 line generator function.
   * @param {string} labelText - Optional text to display at the start of the line.
   * @param {number} animationSpeed - Optional animation speed in ms.
   */
  constructor(
    lineGroup,
    className,
    color,
    generatorParams,
    walkX,
    walkY,
    lineGenerator,
    labelText = null,
    RECT_ADJUSTMENT_FACTOR,
    yearText = null,
    animationSpeed = 5,
    strokeWidth = 3
  ) {
    this.data = [];
    this.generatorData = duBoisLine(...generatorParams);
    this.currentIndex = 0;
    this.path = lineGroup
      .append("path")
      .attr("class", className)
      .attr("stroke", color)
      .attr("fill", "none")
      .attr("stroke-width", strokeWidth);
    this.lineGenerator = lineGenerator;
    this.walkX = walkX;
    this.walkY = walkY;
    this.labelText = labelText;
    this.yearText = yearText;
    this.animationSpeed = animationSpeed;

    this.text = null;
    this.annotation = null;
    this.timeoutId = null;

    const firstPoint = this.generatorData[this.currentIndex];
    const lastPoint = this.generatorData[this.generatorData.length - 1];

    // If labelText is provided, initialize with the first point.
    if (this.labelText && this.generatorData.length > 0) {
      this.data.push(firstPoint);
      this.path.datum(this.data).attr("d", this.lineGenerator(this.data));
      this.currentIndex++;

      // Append the label at the starting point.
      this.text = lineGroup
        .append("text")
        .attr("class", "dubois-label")
        .attr("x", walkX(-10 / RECT_ADJUSTMENT_FACTOR))
        .attr("y", walkY(firstPoint.value - 1.5))
        .attr("dy", "-0.5em")
        .attr("fill", color)
        .text(this.labelText);
    }

    this.animate();

    if (this.yearText) {
      this.annotation = lineGroup
        .append("text")
        .attr("class", "dubois-label-year-annotation")
        .attr("x", walkX(lastPoint.step + 2))
        .attr("y", walkY(firstPoint.value - 1.5))
        .attr("dy", "-0.5em")
        .text(this.yearText);
    }
  }

  animate() {
    if (this.currentIndex < this.generatorData.length) {
      const point = this.generatorData[this.currentIndex];
      this.currentIndex++;

      this.data.push(point);
      this.path.datum(this.data).attr("d", this.lineGenerator(this.data));

      // Schedule the next step.
      this.timeoutId = setTimeout(() => this.animate(), this.animationSpeed);
    }
  }

  // Add a flush method to render the remaining points immediately.
  flush() {
    if (this.timeoutId !== null) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    while (this.currentIndex < this.generatorData.length) {
      const point = this.generatorData[this.currentIndex];
      this.data.push(point);
      this.currentIndex++;
    }
    // Update the line one final time.
    this.path.datum(this.data).attr("d", this.lineGenerator(this.data));
  }

  /**
   * Returns the current data points of the animated line.
   * @returns {Array<{ step: number, value: number }>}
   */
  getData() {
    return this.data;
  }
}

export function consolidatePalestinianLines(
  palestinianPermits,
  STEP_CONFIG,
  svg,
  walkX,
  walkY,
  CORE_Y_START,
  fastConsolidate,
  line,
  lineLabelOffset
) {
  return new Promise((resolve, reject) => {
    palestinianPermits.forEach((d) => {
      svg.select(`.palestinian-${d.year}-line-path`).attr("display", "block");
    });

    STEP_CONFIG.Y_START = CORE_Y_START;

    const consolidatedPermits = palestinianPermits.reduce(
      (sum, d) => sum + d.permits,
      0
    );

    const consolidatedPathData = duBoisLine(
      consolidatedPermits,
      STEP_CONFIG.LENGTH,
      STEP_CONFIG.Y_START,
      STEP_CONFIG.Y_CHANGE,
      false,
      STEP_CONFIG.STEPS_UNTIL_TURN
    );

    let index_counter = 0;
    let transitionsCompleted = 0;
    const totalTransitions = palestinianPermits.length;

    if (totalTransitions === 0) {
      // No transitions to perform, resolve immediately
      resolve();
      return;
    }

    // Remove prior labels
    svg.selectAll(".dubois-label").attr("display", "none");
    svg.selectAll(".dubois-label-year-annotation").attr("display", "none");

    const firstPoint = consolidatedPathData[0];
    console.log(`firstPoint.value: ${firstPoint.value}`);
    const baseX = walkX(firstPoint.step); // Dynamically compute the x position

    // Append a new consolidated label
    svg
      .append("text")
      .attr("class", "dubois-label-decade")
      .attr("x", baseX + lineLabelOffset)
      .attr("y", walkY(firstPoint.value + 3))
      .attr("text-anchor", "start")
      .attr("fill", "black")
      .text(
        `Permits granted to Palestinians in a decade - ${consolidatedPermits}`
      );

    palestinianPermits.forEach((d) => {
      svg
        .select(`.palestinian-${d.year}-line-path`)
        .transition()
        .duration(fastConsolidate ? 0 : 1000) // duration in milliseconds
        .attr(
          "d",
          line(
            consolidatedPathData.slice(index_counter, index_counter + d.permits)
          )
        )
        .on("end", () => {
          transitionsCompleted++;
          if (transitionsCompleted === totalTransitions) {
            // All transitions complete
            fastConsolidate = true;

            if (consolidatedPermits > STEP_CONFIG.STEPS_UNTIL_TURN) {
              STEP_CONFIG.Y_START -=
                Math.floor(consolidatedPermits / STEP_CONFIG.STEPS_UNTIL_TURN) *
                  STEP_CONFIG.Y_CHANGE +
                STEP_CONFIG.Y_CHANGE;
            } else {
              STEP_CONFIG.Y_START -= STEP_CONFIG.Y_CHANGE;
            }

            // Resolve the promise after all transitions are done
            resolve();
          }
        });

      index_counter += d.permits - 1;
    });
  });

  return fastConsolidate;
}

export function unconsolidatePalestinianLines(
  fastConsolidate,
  israeliLineRedraw,
  svg,
  palestinianPermits,
  STEP_CONFIG,
  CORE_Y_START,
  line
) {
  fastConsolidate = false;
  israeliLineRedraw = true;
  STEP_CONFIG.Y_START = CORE_Y_START;

  // show prior labels, remove aggregate
  svg.selectAll(".dubois-label").attr("display", "block");
  svg.selectAll(".dubois-label-decade").attr("display", "none");
  svg.selectAll(".dubois-label-year-annotation").attr("display", "block");

  palestinianPermits.forEach((d) => {
    const pathData = duBoisLine(
      ...[
        d.permits + 1,
        STEP_CONFIG.LENGTH,
        STEP_CONFIG.Y_START,
        STEP_CONFIG.Y_CHANGE,
        false,
        STEP_CONFIG.STEPS_UNTIL_TURN,
      ]
    );

    svg
      .select(`.palestinian-${d.year}-line-path`)
      .transition()
      .duration(1000) // duration in milliseconds
      .attr("d", line(pathData));

    if (d.permits > STEP_CONFIG.STEPS_UNTIL_TURN) {
      STEP_CONFIG.Y_START -=
        Math.floor(d.permits / STEP_CONFIG.STEPS_UNTIL_TURN) *
        STEP_CONFIG.Y_CHANGE;
    } else {
      STEP_CONFIG.Y_START -= STEP_CONFIG.Y_CHANGE;
    }
  });

  return { fastConsolidate, israeliLineRedraw };
}

export function drawIsraeliLines(
  israeliLineRedraw,
  svg,
  walkX,
  walkY,
  lineGroup,
  line,
  STEP_CONFIG,
  israeliLine,
  lineLabelOffset,
  RECT_ADJUSTMENT_FACTOR
) {
  if (!israeliLineRedraw) {
    svg.selectAll(".dubois-label-year").attr("display", "block");
    svg.selectAll(".israeli-line-path").attr("display", "block");
    return israeliLine; // Exit the function to prevent duplicate drawing
  } else {
    if (svg.select(".dubois-label-year").empty() === false) {
      svg.select(".dubois-label-year").remove();
      svg.select(".israeli-line-path").remove();
    }
    const yearlyIsraeliPermits = 2000;
    const speedImprovementFactor = 2; // 2x faster than default
    israeliLine = new AnimatedLine(
      lineGroup,
      `israeli-line-path`,
      "black",
      [
        yearlyIsraeliPermits / speedImprovementFactor,
        STEP_CONFIG.LENGTH * speedImprovementFactor,
        STEP_CONFIG.Y_START - 1,
        STEP_CONFIG.Y_CHANGE / 1.4,
        false,
        STEP_CONFIG.STEPS_UNTIL_TURN / speedImprovementFactor,
      ], // generatorParams: totalSteps, stepLength, initialY, yChange, Increment
      walkX,
      walkY,
      line,
      0,
      RECT_ADJUSTMENT_FACTOR
    );

    const israeliLineData = d3.select(".israeli-line-path").datum();
    const firstIsraeliPoint = israeliLineData[0];
    const baseXYear = walkX(firstIsraeliPoint.step);

    // Append a new consolidated label
    svg
      .append("text")
      .attr("class", "dubois-label-year")
      .attr("x", baseXYear + lineLabelOffset)
      .attr("y", walkY(STEP_CONFIG.Y_START + 3.5))
      .attr("text-anchor", "start")
      .attr("fill", "black")
      .text(
        `Permits granted to Israeli settlers in a single year - ${yearlyIsraeliPermits.toLocaleString()}`
      );

    return israeliLine;
  }
}

export function verticalHelper(svg, walkX, MARGIN, ADJ_HEIGHT) {
  // Append the vertical line at x = walkX(100)
  // Start with y2 equal to MARGIN.TOP so that it "grows" downward
  const verticalLine = svg
    .append("line")
    .attr("x1", walkX(100))
    .attr("x2", walkX(100))
    .attr("y1", MARGIN.TOP)
    .attr("y2", MARGIN.TOP) // initial value
    .attr("stroke", "black")
    .attr("stroke-width", 2);

  // Animate the line to extend from top to bottom within the margins
  verticalLine
    .transition()
    .duration(1000) // duration in milliseconds
    .ease(d3.easeLinear)
    .attr("y2", ADJ_HEIGHT - MARGIN.BOTTOM);

  // Now append the text label rotated by 90 degrees and placed to the right of the line.
  // Adjust the x position to be to the right of walkX(100) by adding an offset.
  const xLabel = walkX(100) + 15; // 15px right of the line (adjust as needed)
  const yLabel = (MARGIN.TOP + (ADJ_HEIGHT - MARGIN.BOTTOM)) / 2; // vertically centered

  svg
    .append("text")
    .attr("transform", `translate(${xLabel}, ${yLabel}) rotate(90)`)
    .attr("text-anchor", "middle")
    .attr("fill", "black")
    .text("100 permits");
}

export function hideIsraeliLines(svg) {
  svg.selectAll(".israeli-line-path").attr("display", "none");
  svg.selectAll(".dubois-label-year").attr("display", "none");
}

export function hidePalestinianLines(palestinianPermits, svg) {
  palestinianPermits.forEach((d) => {
    svg.select(`.palestinian-${d.year}-line-path`).attr("display", "none");
  });
  svg.selectAll(".dubois-label").attr("display", "none");
  svg.selectAll(".dubois-label-decade").attr("display", "none");
}
