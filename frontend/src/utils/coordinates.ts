import type { FloorPlan } from '../types';

/**
 * Convert data coordinates (meters) to canvas pixel coordinates
 */
export function dataToCanvas(
  dataX: number,
  dataY: number,
  floorPlan: FloorPlan,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  const { data_min_x, data_max_x, data_min_y, data_max_y } = floorPlan;

  // Normalize to 0-1 range
  const normX = (dataX - data_min_x) / (data_max_x - data_min_x);
  const normY = (dataY - data_min_y) / (data_max_y - data_min_y);

  // Convert to canvas coordinates (y is flipped)
  const canvasX = normX * canvasWidth;
  const canvasY = (1 - normY) * canvasHeight;

  return { x: canvasX, y: canvasY };
}

/**
 * Convert canvas pixel coordinates to data coordinates (meters)
 */
export function canvasToData(
  canvasX: number,
  canvasY: number,
  floorPlan: FloorPlan,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  const { data_min_x, data_max_x, data_min_y, data_max_y } = floorPlan;

  // Normalize pixel to 0-1 range
  const normX = canvasX / canvasWidth;
  const normY = 1 - canvasY / canvasHeight; // Flip y

  // Convert to data coordinates
  const dataX = data_min_x + normX * (data_max_x - data_min_x);
  const dataY = data_min_y + normY * (data_max_y - data_min_y);

  return { x: dataX, y: dataY };
}

/**
 * Get color for heatmap intensity (0-1)
 * Uses a gradient from blue (cold) to red (hot)
 */
export function getHeatmapColor(intensity: number, alpha: number = 0.7): string {
  // Clamp intensity to 0-1
  const i = Math.max(0, Math.min(1, intensity));

  // Color gradient: blue -> cyan -> green -> yellow -> red
  let r: number, g: number, b: number;

  if (i < 0.25) {
    // Blue to cyan
    const t = i / 0.25;
    r = 0;
    g = Math.round(255 * t);
    b = 255;
  } else if (i < 0.5) {
    // Cyan to green
    const t = (i - 0.25) / 0.25;
    r = 0;
    g = 255;
    b = Math.round(255 * (1 - t));
  } else if (i < 0.75) {
    // Green to yellow
    const t = (i - 0.5) / 0.25;
    r = Math.round(255 * t);
    g = 255;
    b = 0;
  } else {
    // Yellow to red
    const t = (i - 0.75) / 0.25;
    r = 255;
    g = Math.round(255 * (1 - t));
    b = 0;
  }

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Format duration in seconds to human readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) {
    return `${Math.round(seconds)}s`;
  } else if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return `${mins}m ${secs}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${mins}m`;
  }
}

/**
 * Format large numbers with K/M suffix
 */
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  } else if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}
