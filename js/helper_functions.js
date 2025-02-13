// *******************
// general helper function
// *******************

/**
 * Samples a percentage of items from an array.
 * @param {Array} array - The array to sample from.
 * @param {number} percentage - The percentage to sample (0-100).
 * @returns {Array} - The sampled subset of the array.
 */
export function samplePercentage(array, percentage) {
  const sampleSize = Math.floor(array.length * (percentage / 100));
  if (sampleSize <= 0 && array.length > 0)
    return [array[Math.floor(Math.random() * array.length)]];
  const shuffled = array.slice(); // Shallow copy
  // Fisher-Yates shuffle
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, sampleSize);
}

export function getRandomOffset(range) {
  return (Math.random() - 0.5) * 2 * range;
}

export function getRandomNumberBetween(start, end) {
  return Math.random() * (end - start + 1) + start;
}

/**
 * Clamps a number between a minimum and maximum value.
 * @param {number} num - The number to clamp.
 * @param {number} min - The minimum allowable value.
 * @param {number} max - The maximum allowable value.
 * @returns {number} - The clamped number.
 */
export function clamp(num, min, max) {
  return Math.max(min, Math.min(max, num));
}

export function cleanLocality(string) {
  return string.replace(/'/g, "").replace(/\s+/g, "-").replace(/['()]/g, "");
}

// Create a pausable queue for iterating with a delay.
export function createPausableQueue(array, callback) {
  let i = 0;
  let paused = false;
  let timeoutId = null;

  function iterate() {
    if (i < array.length) {
      if (!paused) {
        const d = array[i];
        callback(d, i, array);
        const delay = d.permits ? Math.max(30, d.permits * 30) : 30;
        i++;
        timeoutId = setTimeout(iterate, delay);
      }
    }
  }

  function pause() {
    paused = true;
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  }

  function resume() {
    if (paused) {
      paused = false;
      iterate();
    }
  }

  // flush immediately processes any remaining items.
  function flush() {
    pause(); // Cancel any scheduled iterate.
    while (i < array.length) {
      callback(array[i], i, array);
      i++;
    }
  }

  iterate();

  return { pause, resume, flush };
}
