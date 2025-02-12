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
   *
   * @param {d3.selection} lineGroup - The group element to append the path.
   * @param {string} className - Class name for the path.
   * @param {string} color - Stroke color for the path.
   * @param {Array} generatorParams - Parameters for the duBoisLine function.
   * @param {d3.line} lineGenerator - D3 line generator function.
   * @param {string} labelText - Optional text to display at the start of the line.
   * @param {number} animationSpeed - Optional animation speed in ms.
   *
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
    animationSpeed = 5,
    strokeWidth = 3
  ) {
    this.data = [];
    this.generatorData = duBoisLine(...generatorParams); // Now an array
    this.currentIndex = 0; // To track the animation progress
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
    this.animationSpeed = animationSpeed;

    this.text = null; // Placeholder for the text element
    this.timeoutId = null; // To store the setTimeout ID

    // Initialize with the first point if labelText is provided
    if (this.labelText && this.generatorData.length > 0) {
      const firstPoint = this.generatorData[this.currentIndex];
      this.data.push(firstPoint);
      this.path.datum(this.data).attr("d", this.lineGenerator(this.data));
      this.currentIndex++;

      // Append the text element at the starting point
      this.text = lineGroup
        .append("text")
        .attr("class", "dubois-label")
        .attr("x", walkX(-6))
        .attr("y", walkY(firstPoint.value - 1.5))
        .attr("dy", "-0.5em") // Adjust vertical position (above the point)
        .attr("fill", color) // Match the line color or choose another
        .text(this.labelText);
    }

    this.animate(); // Start the animation
  }

  animate() {
    if (this.currentIndex < this.generatorData.length) {
      const point = this.generatorData[this.currentIndex];
      this.currentIndex++;

      this.data.push(point);
      this.path.datum(this.data).attr("d", this.lineGenerator(this.data));

      // Store the timeout ID to allow stopping the animation
      this.timeoutId = setTimeout(() => this.animate(), this.animationSpeed);
    }
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
  line
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

    // Grab year info
    const years = palestinianPermits.map((d) => d.year);
    const yearStart = d3.min(years);
    const yearEnd = d3.max(years);

    // Append a new consolidated label
    svg
      .append("text")
      .attr("class", "dubois-label-decade")
      .attr("x", walkX(15))
      .attr("y", walkY(consolidatedPathData[0].value + 3))
      .attr("text-anchor", "start")
      .attr("fill", "black")
      .text("Permits granted to Palestinians in a decade");

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

  palestinianPermits.forEach((d) => {
    const pathData = duBoisLine(
      ...[
        d.permits,
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
  STEP_CONFIG
) {
  if (!israeliLineRedraw) {
    svg.selectAll(".dubois-label-year").attr("display", "block");
    svg.selectAll(".israeli-line-path").attr("display", "block");
    return; // Exit the function to prevent duplicate drawing
  } else {
    if (svg.select(".dubois-label-year").empty() === false) {
      svg.select(".dubois-label-year").remove();
      svg.select(".israeli-line-path").remove();
    }
    const yearlyIsraeliPermits = 2000;
    const speedImprovementFactor = 2; // 2x faster than default
    const israeliLine = new AnimatedLine(
      lineGroup,
      `israeli-line-path`,
      "black",
      [
        yearlyIsraeliPermits / speedImprovementFactor,
        STEP_CONFIG.LENGTH * speedImprovementFactor,
        STEP_CONFIG.Y_START - 1,
        STEP_CONFIG.Y_CHANGE,
        false,
        STEP_CONFIG.STEPS_UNTIL_TURN / speedImprovementFactor,
      ], // generatorParams: totalSteps, stepLength, initialY, yChange, Increment
      walkX,
      walkY,
      line,
      0
    );

    // Append a new consolidated label
    svg
      .append("text")
      .attr("class", "dubois-label-year")
      .attr("x", walkX(14.2))
      .attr("y", walkY(STEP_CONFIG.Y_START + 1.75))
      .attr("text-anchor", "start")
      .attr("fill", "black")
      .text("Permits granted to Israelis in a single year");
  }
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
