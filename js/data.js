// *******************
// data read-in
// *******************

import { getRandomOffset } from "./helper_functions.js";

// Permits`
export function getPalestinianPermits() {
  return d3.csv("data/raw/palestinian_permits.csv").then((data) => {
    data.forEach((d) => {
      d.year = Number(d.year);
      // 1 permit buffer to handle 1-permit length entries
      d.permits = Number(d.permits);
    });

    const palestinianPermits = data.filter(
      (d) => d.year >= 2010 && d.year <= 2019
    );

    return palestinianPermits;
  });
}

export function loadDemolitionsData(tileLocalities) {
  return d3.csv("data/processed/demolitions.csv").then((data) => {
    const BUFFER_RANGE = 10;

    data.forEach((d, index) => {
      d.housing_units = Number(d.housing_units);
      d.minors_left_homeless = Number(d.minors_left_homeless);
      d.people_left_homeless = Number(d.people_left_homeless);
      d.lat = Number(d.lat);
      d.long = Number(d.long);
      d.crossed = false;
      d.simulateGrant = Math.random() < 0.01; // 1% chance to skip opacity change
      d.id = index;

      d.date_of_demolition = new Date(d.date_of_demolition);

      d.locality_cleaned = d.locality_cleaned.replace(/\([^()]*\)/g, "").trim();

      d.offsetX = getRandomOffset(BUFFER_RANGE);
      d.offsetY = getRandomOffset(BUFFER_RANGE);

      // New column: 10% chance that this row is marked to show on the map
      d.showOnMap = Math.random() < 0.1; // 10% chance
    });

    // Filter out rows with demolition dates before January 1, 2010
    data = data.filter((d) => d.date_of_demolition >= new Date("2010-01-01"));

    const palestinianDemolitions = data.map((d) => {
      // Check condition and assign new column accordingly
      const tileNode = tileLocalities(d);
      return { ...d, tileNode, showOnMap: tileNode ? true : d.showOnMap };
    });

    console.log(palestinianDemolitions);

    // Extract and sort unique demolition dates
    const demolitionDates = [
      ...new Set(
        palestinianDemolitions
          .filter((d) => d.showOnMap)
          .map((d) => d.date_of_demolition)
      ),
    ].sort((a, b) => a - b);

    return { palestinianDemolitions, demolitionDates };
  });
}

export function getPalestinianDemolitions() {
  return palestinianDemolitions;
}

export function getDemolitionDates() {
  return demolitionDates;
}
