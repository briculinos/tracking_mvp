import { useRef, useEffect, useState, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useCreateZone } from '../../hooks/useZones';
import { dataToCanvas, canvasToData, getHeatmapColor, formatNumber, formatDuration } from '../../utils/coordinates';
import type { HeatmapResponse, DwellTimeResponse, FloorPlan, Zone, ZoneStats, ViewMode, ScaleSettings, FloorPlanAdjustment, CalibrationState, CalibrationPoint } from '../../types';

/**
 * Transform a canvas point based on floor plan adjustments.
 * Supports both simple transform (scale/rotate/offset) and full affine transform.
 */
function transformPoint(
  x: number,
  y: number,
  adjustment: FloorPlanAdjustment,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  // Use affine transform if available and enabled
  if (adjustment.useAffine && adjustment.affine) {
    const { a, b, c, d, tx, ty } = adjustment.affine;
    return {
      x: a * x + b * y + tx,
      y: c * x + d * y + ty
    };
  }

  // Fall back to simple transform
  const offsetX = (adjustment.offsetX / 100) * canvasWidth;
  const offsetY = (adjustment.offsetY / 100) * canvasHeight;
  const scaleX = adjustment.scaleX ?? adjustment.scale ?? 1.0;
  const scaleY = adjustment.scaleY ?? adjustment.scale ?? 1.0;
  const rotation = (adjustment.rotation * Math.PI) / 180;

  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  // Translate to origin
  let px = x - centerX;
  let py = y - centerY;

  // Apply scale
  px *= scaleX;
  py *= scaleY;

  // Apply rotation
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  const rx = px * cos - py * sin;
  const ry = px * sin + py * cos;

  // Translate back and apply offset
  return {
    x: rx + centerX + offsetX,
    y: ry + centerY + offsetY
  };
}

/**
 * Inverse transform - converts canvas click position back to original data space.
 * Used when creating zones to get the correct data coordinates.
 */
function inverseTransformPoint(
  x: number,
  y: number,
  adjustment: FloorPlanAdjustment,
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  // Use inverse affine transform if available and enabled
  if (adjustment.useAffine && adjustment.affine) {
    const { a, b, c, d, tx, ty } = adjustment.affine;
    // Inverse of 2x2 matrix [a,b; c,d] is [d,-b; -c,a] / det
    const det = a * d - b * c;
    if (Math.abs(det) < 1e-10) {
      return { x, y }; // Can't invert, return as-is
    }
    const invDet = 1 / det;
    // First subtract translation, then apply inverse matrix
    const px = x - tx;
    const py = y - ty;
    return {
      x: (d * px - b * py) * invDet,
      y: (-c * px + a * py) * invDet
    };
  }

  // Fall back to inverse simple transform
  const offsetX = (adjustment.offsetX / 100) * canvasWidth;
  const offsetY = (adjustment.offsetY / 100) * canvasHeight;
  const scaleX = adjustment.scaleX ?? adjustment.scale ?? 1.0;
  const scaleY = adjustment.scaleY ?? adjustment.scale ?? 1.0;
  const rotation = (adjustment.rotation * Math.PI) / 180;

  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;

  // Reverse: subtract offset, translate to origin
  let px = x - offsetX - centerX;
  let py = y - offsetY - centerY;

  // Reverse rotation (negative angle)
  const cos = Math.cos(-rotation);
  const sin = Math.sin(-rotation);
  const rx = px * cos - py * sin;
  const ry = px * sin + py * cos;

  // Reverse scale
  const ux = scaleX !== 0 ? rx / scaleX : rx;
  const uy = scaleY !== 0 ? ry / scaleY : ry;

  // Translate back
  return {
    x: ux + centerX,
    y: uy + centerY
  };
}

/**
 * Apply zoom and pan transform to a point.
 */
function applyZoomPan(
  x: number,
  y: number,
  zoom: number,
  pan: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  return {
    x: (x - centerX) * zoom + centerX + pan.x,
    y: (y - centerY) * zoom + centerY + pan.y
  };
}

/**
 * Inverse zoom and pan transform - converts canvas position back to pre-zoom coordinates.
 */
function inverseZoomPan(
  x: number,
  y: number,
  zoom: number,
  pan: { x: number; y: number },
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  const centerX = canvasWidth / 2;
  const centerY = canvasHeight / 2;
  return {
    x: (x - pan.x - centerX) / zoom + centerX,
    y: (y - pan.y - centerY) / zoom + centerY
  };
}

interface VisibleStats {
  pointsInView: number;
  totalPoints: number;
  percentage: string;
}

interface Props {
  heatmapData: HeatmapResponse | DwellTimeResponse | null | undefined;
  floorPlan: FloorPlan | undefined;
  zones: Zone[];
  zoneStats: ZoneStats[];
  selectedZone: Zone | null;
  viewMode: ViewMode;
  isDrawingZone: boolean;
  storeId: number;
  floor: number;
  scaleSettings: ScaleSettings;
  floorPlanAdjustment: FloorPlanAdjustment;
  calibration?: CalibrationState;
  onZoneCreated: () => void;
  onSelectZone: (zone: Zone | null) => void;
  onDataRangeChange?: (min: number, max: number) => void;
  onCalibrationClick?: (point: CalibrationPoint) => void;
  onScaleSettingsChange?: (settings: ScaleSettings) => void;
  showFloorPlan?: boolean;
  showHeatmap?: boolean;
  // Zoom control props
  externalZoom?: number;
  onZoomChange?: (zoom: number) => void;
  onVisibleStatsChange?: (stats: VisibleStats | null) => void;
}

interface DrawingState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
}

export default function HeatmapCanvas({
  heatmapData,
  floorPlan,
  zones,
  zoneStats,
  selectedZone,
  viewMode,
  isDrawingZone,
  storeId,
  floor,
  scaleSettings,
  floorPlanAdjustment,
  calibration,
  onZoneCreated,
  onSelectZone,
  onDataRangeChange,
  onScaleSettingsChange,
  showFloorPlan = true,
  showHeatmap = true,
  onCalibrationClick,
  externalZoom,
  onZoomChange,
  onVisibleStatsChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });
  const [drawing, setDrawing] = useState<DrawingState | null>(null);
  const [hoveredCell, setHoveredCell] = useState<{ x: number; y: number; value: number } | null>(null);
  const [floorPlanImage, setFloorPlanImage] = useState<HTMLImageElement | null>(null);

  // Zoom and pan state
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStarted, setPanStarted] = useState(false); // Track if pan threshold exceeded
  const panStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const PAN_THRESHOLD = 8; // Minimum pixels to move before panning starts

  const createZone = useCreateZone();

  // Load floor plan image
  useEffect(() => {
    if (floorPlan) {
      const img = new Image();
      img.onload = () => setFloorPlanImage(img);
      img.onerror = () => setFloorPlanImage(null);
      img.src = floorPlan.url;
    } else {
      setFloorPlanImage(null);
    }
  }, [floorPlan]);

  // Update canvas dimensions - fixed size, no stretching
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setDimensions({
          width: rect.width,
          height: Math.max(600, window.innerHeight * 0.7),
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Sync zoom with external control
  useEffect(() => {
    if (externalZoom !== undefined && externalZoom !== zoom) {
      setZoom(externalZoom);
      // Reset pan when zoom is reset to 1
      if (externalZoom === 1) {
        setPan({ x: 0, y: 0 });
      }
    }
  }, [externalZoom]);

  // Wheel zoom handler - requires Ctrl/Cmd key to zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      // Only zoom when Ctrl (Windows/Linux) or Cmd (Mac) is held
      if (!e.ctrlKey && !e.metaKey) {
        return; // Allow normal page scroll
      }

      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.5, Math.min(10, zoom * zoomFactor));

      // Zoom toward mouse position
      const scale = newZoom / zoom;
      setPan(prev => ({
        x: mouseX - (mouseX - prev.x) * scale,
        y: mouseY - (mouseY - prev.y) * scale
      }));
      setZoom(newZoom);
      onZoomChange?.(newZoom);
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [zoom, onZoomChange]);

  // Reset zoom/pan when floor or store changes
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    onZoomChange?.(1);
  }, [storeId, floor]);

  // Calculate effective bounds for coordinate mapping
  // When floor plan exists, use floor plan bounds (show full image, let user adjust)
  // When no floor plan, use data bounds to auto-fit
  const dataBounds = heatmapData?.bounds;
  const hasValidDataBounds = dataBounds &&
    dataBounds.min_x !== Infinity && dataBounds.max_x !== -Infinity &&
    dataBounds.min_y !== Infinity && dataBounds.max_y !== -Infinity;

  // Create a virtual floor plan for coordinate mapping
  // When floor plan exists, use its bounds (full image shown, user adjusts alignment)
  // When no floor plan, use data bounds with margin
  const virtualFloorPlan: FloorPlan = (() => {
    if (floorPlan) {
      // Use floor plan's calibration bounds - show full image
      return {
        ...floorPlan,
      };
    }

    // No floor plan - use data bounds with margin
    const margin = 0.05;
    const dataRangeX = hasValidDataBounds ? (dataBounds.max_x - dataBounds.min_x) : 0;
    const dataRangeY = hasValidDataBounds ? (dataBounds.max_y - dataBounds.min_y) : 0;

    return {
      id: 0,
      store_id: storeId,
      floor: floor,
      filename: '',
      url: '',
      data_min_x: hasValidDataBounds ? dataBounds.min_x - dataRangeX * margin : 0,
      data_max_x: hasValidDataBounds ? dataBounds.max_x + dataRangeX * margin : 100,
      data_min_y: hasValidDataBounds ? dataBounds.min_y - dataRangeY * margin : 0,
      data_max_y: hasValidDataBounds ? dataBounds.max_y + dataRangeY * margin : 100,
      image_width: dimensions.width,
      image_height: dimensions.height,
      adjust_offset_x: 0,
      adjust_offset_y: 0,
      adjust_scale: 1.0,
      adjust_scale_x: 1.0,
      adjust_scale_y: 1.0,
      adjust_rotation: 0,
      created_at: '',
    };
  })();

  // Track min/max values for legend
  const [legendValues, setLegendValues] = useState<{ min: number; max: number } | null>(null);

  // Calculate visible stats when zoomed
  useEffect(() => {
    if (!onVisibleStatsChange || !heatmapData) {
      onVisibleStatsChange?.(null);
      return;
    }

    // If not zoomed, no need to filter
    if (zoom === 1 && pan.x === 0 && pan.y === 0) {
      onVisibleStatsChange(null);
      return;
    }

    const width = dimensions.width;
    const height = dimensions.height;

    // Calculate visible data bounds by inverse transforming canvas corners
    const corners = [
      { x: 0, y: 0 },
      { x: width, y: 0 },
      { x: 0, y: height },
      { x: width, y: height }
    ];

    const dataCorners = corners.map(corner => {
      const unzoomed = inverseZoomPan(corner.x, corner.y, zoom, pan, width, height);
      const untransformed = inverseTransformPoint(unzoomed.x, unzoomed.y, floorPlanAdjustment, width, height);
      return canvasToData(untransformed.x, untransformed.y, virtualFloorPlan, width, height);
    });

    const visibleBounds = {
      minX: Math.min(...dataCorners.map(c => c.x)),
      maxX: Math.max(...dataCorners.map(c => c.x)),
      minY: Math.min(...dataCorners.map(c => c.y)),
      maxY: Math.max(...dataCorners.map(c => c.y))
    };

    // Filter points by visible bounds
    if (viewMode === 'tracks' && (heatmapData as HeatmapResponse).points) {
      const points = (heatmapData as HeatmapResponse).points;
      const totalPoints = (heatmapData as HeatmapResponse).total_returned || points.length;
      const visiblePoints = points.filter(p =>
        p.x >= visibleBounds.minX && p.x <= visibleBounds.maxX &&
        p.y >= visibleBounds.minY && p.y <= visibleBounds.maxY
      );
      onVisibleStatsChange({
        pointsInView: visiblePoints.length,
        totalPoints,
        percentage: ((visiblePoints.length / totalPoints) * 100).toFixed(1)
      });
    } else if (viewMode === 'dwell' && (heatmapData as DwellTimeResponse).cells) {
      const cells = (heatmapData as DwellTimeResponse).cells;
      const visibleCells = cells.filter(c =>
        c.x >= visibleBounds.minX && c.x <= visibleBounds.maxX &&
        c.y >= visibleBounds.minY && c.y <= visibleBounds.maxY
      );
      const totalDwell = cells.reduce((sum, c) => sum + (c.avg_dwell_seconds || 0), 0);
      const visibleDwell = visibleCells.reduce((sum, c) => sum + (c.avg_dwell_seconds || 0), 0);
      onVisibleStatsChange({
        pointsInView: visibleCells.length,
        totalPoints: cells.length,
        percentage: totalDwell > 0 ? ((visibleDwell / totalDwell) * 100).toFixed(1) : '0'
      });
    }
  }, [zoom, pan, heatmapData, viewMode, dimensions, floorPlanAdjustment, virtualFloorPlan, onVisibleStatsChange]);

  // Draw the heatmap
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, dimensions.width, dimensions.height);

    // Draw floor plan background - preserve aspect ratio, no stretching
    // Apply zoom/pan transform for floor plan
    const centerX = dimensions.width / 2;
    const centerY = dimensions.height / 2;

    if (showFloorPlan && floorPlanImage) {
      const imgAspect = floorPlanImage.width / floorPlanImage.height;
      const canvasAspect = dimensions.width / dimensions.height;

      let drawWidth, drawHeight, drawX, drawY;

      if (imgAspect > canvasAspect) {
        // Image is wider - fit to width
        drawWidth = dimensions.width;
        drawHeight = dimensions.width / imgAspect;
        drawX = 0;
        drawY = (dimensions.height - drawHeight) / 2;
      } else {
        // Image is taller - fit to height
        drawHeight = dimensions.height;
        drawWidth = dimensions.height * imgAspect;
        drawX = (dimensions.width - drawWidth) / 2;
        drawY = 0;
      }

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);

      // Apply zoom/pan transform for floor plan
      ctx.save();
      ctx.translate(centerX + pan.x, centerY + pan.y);
      ctx.scale(zoom, zoom);
      ctx.translate(-centerX, -centerY);
      ctx.drawImage(floorPlanImage, drawX, drawY, drawWidth, drawHeight);
      ctx.restore();
    } else {
      // Clean white/light background
      ctx.fillStyle = showFloorPlan ? '#ffffff' : '#f8fafc';
      ctx.fillRect(0, 0, dimensions.width, dimensions.height);
    }

    // Draw heatmap - different approach for tracks (raw points) vs dwell (cells)
    const isTracksMode = viewMode === 'tracks';
    const hasPoints = isTracksMode && (heatmapData as HeatmapResponse)?.points?.length > 0;
    const hasCells = !isTracksMode && (heatmapData as DwellTimeResponse)?.cells?.length > 0;

    if (showHeatmap && (hasPoints || hasCells)) {
      // Create offscreen canvas for heatmap layer
      const heatmapCanvas = document.createElement('canvas');
      heatmapCanvas.width = dimensions.width;
      heatmapCanvas.height = dimensions.height;
      const heatmapCtx = heatmapCanvas.getContext('2d');

      if (heatmapCtx) {
        if (hasPoints) {
          // RAW POINTS MODE: Draw individual points with low opacity
          const points = (heatmapData as HeatmapResponse).points;

          // Step 1: Draw intensity on a grayscale canvas
          const intensityCanvas = document.createElement('canvas');
          intensityCanvas.width = dimensions.width;
          intensityCanvas.height = dimensions.height;
          const intensityCtx = intensityCanvas.getContext('2d');

          if (intensityCtx) {
            const width = dimensions.width;
            const height = dimensions.height;

            // Black background
            intensityCtx.fillStyle = 'black';
            intensityCtx.fillRect(0, 0, width, height);

            // Use additive blending so overlapping points accumulate
            intensityCtx.globalCompositeOperation = 'lighter';

            // Small radius, very low opacity - accumulates where points overlap
            const radius = 8;

            for (const point of points) {
              const canvasCoords = dataToCanvas(
                point.x,
                point.y,
                virtualFloorPlan,
                width,
                height
              );
              const transformed = transformPoint(
                canvasCoords.x,
                canvasCoords.y,
                floorPlanAdjustment,
                width,
                height
              );
              // Apply zoom/pan
              const { x: centerX, y: centerY } = applyZoomPan(
                transformed.x,
                transformed.y,
                zoom,
                pan,
                width,
                height
              );

              // Very low intensity per point - will accumulate
              const scaledRadius = radius * zoom;
              const gradient = intensityCtx.createRadialGradient(
                centerX, centerY, 0,
                centerX, centerY, scaledRadius
              );
              gradient.addColorStop(0, 'rgba(255, 255, 255, 0.03)');
              gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.015)');
              gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

              intensityCtx.fillStyle = gradient;
              intensityCtx.beginPath();
              intensityCtx.arc(centerX, centerY, scaledRadius, 0, Math.PI * 2);
              intensityCtx.fill();
            }

            intensityCtx.globalCompositeOperation = 'source-over';

            // Light blur to smooth
            heatmapCtx.filter = 'blur(6px)';
            heatmapCtx.drawImage(intensityCanvas, 0, 0);
            heatmapCtx.filter = 'none';

            // Step 3: Get blurred intensity for colorization
            const finalImageData = heatmapCtx.getImageData(0, 0, dimensions.width, dimensions.height);
            const finalData = finalImageData.data;

            // Find max intensity in blurred result for normalization
            let finalMaxIntensity = 0;
            for (let i = 0; i < finalData.length; i += 4) {
              if (finalData[i] > finalMaxIntensity) finalMaxIntensity = finalData[i];
            }

            // Convert pixel intensity to approximate track count for display
            // finalMaxIntensity is pixel value (0-255), multiply by factor to get track estimate
            const intensityToTracks = 10; // conversion factor
            const dataMax = Math.round(finalMaxIntensity * intensityToTracks);

            // Use color scale settings - these are actual track counts
            const scaleMin = scaleSettings.auto ? 0 : scaleSettings.min;
            const scaleMax = scaleSettings.auto ? dataMax : scaleSettings.max;

            // Convert back to pixel intensity for rendering
            const pixelMin = scaleMin / intensityToTracks;
            const pixelMax = scaleMax / intensityToTracks;
            const range = Math.max(1, pixelMax - pixelMin);

            // Report data range for legend display (actual track counts)
            if (!legendValues || legendValues.min !== scaleMin || legendValues.max !== scaleMax) {
              setTimeout(() => setLegendValues({ min: scaleMin, max: scaleMax }), 0);
            }
            if (scaleSettings.auto && onDataRangeChange) {
              setTimeout(() => onDataRangeChange(0, dataMax), 0);
            }

            // Step 4: Colorize based on normalized intensity
            for (let i = 0; i < finalData.length; i += 4) {
              const rawIntensity = finalData[i];
              const normalizedIntensity = Math.max(0, Math.min(1, (rawIntensity - pixelMin) / range));

              if (normalizedIntensity > 0.02) {
                // Map intensity to heatmap color (blue -> cyan -> green -> yellow -> red)
                let r, g, b;
                const t4 = normalizedIntensity * 4;
                if (t4 < 1) {
                  r = 0; g = Math.floor(255 * t4); b = 255;
                } else if (t4 < 2) {
                  r = 0; g = 255; b = Math.floor(255 * (2 - t4));
                } else if (t4 < 3) {
                  r = Math.floor(255 * (t4 - 2)); g = 255; b = 0;
                } else {
                  r = 255; g = Math.floor(255 * (4 - t4)); b = 0;
                }

                finalData[i] = r;
                finalData[i + 1] = g;
                finalData[i + 2] = b;
                finalData[i + 3] = Math.floor(220 * Math.min(1, normalizedIntensity * 1.5));
              } else {
                finalData[i + 3] = 0; // Transparent
              }
            }

            heatmapCtx.putImageData(finalImageData, 0, 0);
          }
        } else {
          // DWELL TIME MODE: Use same smooth rendering with value-based intensity
          const cells = (heatmapData as DwellTimeResponse).cells;

          const getValue = (cell: any) => cell.avg_dwell_seconds || 0;
          const values = cells.map(getValue);
          const dataMaxValue = Math.max(...values);
          const dataMinValue = Math.min(...values);

          // Use color scale settings - these are actual seconds
          const minValue = scaleSettings.auto ? dataMinValue : scaleSettings.min;
          const maxValue = scaleSettings.auto ? dataMaxValue : scaleSettings.max;
          const range = maxValue - minValue || 1;

          // Update legend (use setTimeout to avoid infinite loop) - show actual seconds
          if (!legendValues || legendValues.min !== minValue || legendValues.max !== maxValue) {
            setTimeout(() => setLegendValues({ min: minValue, max: maxValue }), 0);
          }
          if (scaleSettings.auto && onDataRangeChange) {
            setTimeout(() => onDataRangeChange(Math.round(dataMinValue), Math.round(dataMaxValue)), 0);
          }

          // Step 1: Draw intensity on grayscale canvas
          const intensityCanvas = document.createElement('canvas');
          intensityCanvas.width = dimensions.width;
          intensityCanvas.height = dimensions.height;
          const intensityCtx = intensityCanvas.getContext('2d');

          if (intensityCtx) {
            intensityCtx.fillStyle = 'black';
            intensityCtx.fillRect(0, 0, dimensions.width, dimensions.height);

            const radius = 15;

            for (const cell of cells) {
              const value = getValue(cell);
              if (value === 0) continue;

              const intensity = Math.max(0, Math.min(1, (value - minValue) / range));
              const canvasCoords = dataToCanvas(
                cell.x,
                cell.y,
                virtualFloorPlan,
                dimensions.width,
                dimensions.height
              );
              const transformed = transformPoint(
                canvasCoords.x,
                canvasCoords.y,
                floorPlanAdjustment,
                dimensions.width,
                dimensions.height
              );
              // Apply zoom/pan
              const { x: centerX, y: centerY } = applyZoomPan(
                transformed.x,
                transformed.y,
                zoom,
                pan,
                dimensions.width,
                dimensions.height
              );

              // Draw with intensity-based opacity
              const scaledRadius = radius * zoom;
              const gradient = intensityCtx.createRadialGradient(
                centerX, centerY, 0,
                centerX, centerY, scaledRadius
              );
              const alpha = 0.1 + intensity * 0.4;
              gradient.addColorStop(0, `rgba(255, 255, 255, ${alpha})`);
              gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');

              intensityCtx.fillStyle = gradient;
              intensityCtx.beginPath();
              intensityCtx.arc(centerX, centerY, scaledRadius, 0, Math.PI * 2);
              intensityCtx.fill();
            }

            // Step 2: Apply blur
            heatmapCtx.filter = 'blur(6px)';
            heatmapCtx.drawImage(intensityCanvas, 0, 0);
            heatmapCtx.filter = 'none';

            // Step 3: Colorize
            const imageData = heatmapCtx.getImageData(0, 0, dimensions.width, dimensions.height);
            const data = imageData.data;

            let maxI = 0;
            for (let i = 0; i < data.length; i += 4) {
              if (data[i] > maxI) maxI = data[i];
            }

            for (let i = 0; i < data.length; i += 4) {
              const normalizedIntensity = maxI > 0 ? data[i] / maxI : 0;

              if (normalizedIntensity > 0.02) {
                let r, g, b;
                const t4 = normalizedIntensity * 4;
                if (t4 < 1) {
                  r = 0; g = Math.floor(255 * t4); b = 255;
                } else if (t4 < 2) {
                  r = 0; g = 255; b = Math.floor(255 * (2 - t4));
                } else if (t4 < 3) {
                  r = Math.floor(255 * (t4 - 2)); g = 255; b = 0;
                } else {
                  r = 255; g = Math.floor(255 * (4 - t4)); b = 0;
                }

                data[i] = r;
                data[i + 1] = g;
                data[i + 2] = b;
                data[i + 3] = Math.floor(220 * Math.min(1, normalizedIntensity * 1.5));
              } else {
                data[i + 3] = 0;
              }
            }

            heatmapCtx.putImageData(imageData, 0, 0);
          }
        }

        // Draw heatmap to main canvas (both modes already processed)
        ctx.drawImage(heatmapCanvas, 0, 0);
      }
    }

    // Draw zones
    for (const zone of zones) {
      const isSelected = selectedZone?.id === zone.id;
      const stats = zoneStats.find((s) => s.zone_id === zone.id);

      // Convert zone coordinates to canvas, then transform
      const topLeftCanvas = dataToCanvas(
        Math.min(zone.x1, zone.x2),
        Math.max(zone.y1, zone.y2),
        virtualFloorPlan,
        dimensions.width,
        dimensions.height
      );
      const bottomRightCanvas = dataToCanvas(
        Math.max(zone.x1, zone.x2),
        Math.min(zone.y1, zone.y2),
        virtualFloorPlan,
        dimensions.width,
        dimensions.height
      );
      const topLeftTransformed = transformPoint(topLeftCanvas.x, topLeftCanvas.y, floorPlanAdjustment, dimensions.width, dimensions.height);
      const bottomRightTransformed = transformPoint(bottomRightCanvas.x, bottomRightCanvas.y, floorPlanAdjustment, dimensions.width, dimensions.height);
      // Apply zoom/pan
      const topLeft = applyZoomPan(topLeftTransformed.x, topLeftTransformed.y, zoom, pan, dimensions.width, dimensions.height);
      const bottomRight = applyZoomPan(bottomRightTransformed.x, bottomRightTransformed.y, zoom, pan, dimensions.width, dimensions.height);

      const width = bottomRight.x - topLeft.x;
      const height = bottomRight.y - topLeft.y;

      // Draw zone rectangle
      ctx.strokeStyle = isSelected ? '#2563eb' : '#6b7280';
      ctx.lineWidth = isSelected ? 3 : 2;
      ctx.setLineDash(isSelected ? [] : [5, 5]);
      ctx.strokeRect(topLeft.x, topLeft.y, width, height);
      ctx.setLineDash([]);

      // Draw zone background
      ctx.fillStyle = isSelected ? 'rgba(37, 99, 235, 0.1)' : 'rgba(107, 114, 128, 0.05)';
      ctx.fillRect(topLeft.x, topLeft.y, width, height);

      // Draw zone label
      ctx.fillStyle = isSelected ? '#2563eb' : '#374151';
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(zone.name, topLeft.x + width / 2, topLeft.y + 22);

      // Draw stats
      if (stats) {
        ctx.font = 'bold 20px sans-serif';
        ctx.fillStyle = '#1f2937';
        if (viewMode === 'dwell') {
          // Dwell mode: show average dwell time
          const dwellText = stats.avg_dwell_seconds
            ? `avg ${formatDuration(stats.avg_dwell_seconds)}`
            : 'No dwell data';
          ctx.fillText(
            dwellText,
            topLeft.x + width / 2,
            topLeft.y + height / 2 + 5
          );
        } else {
          // Tracks mode: show accumulated visits (visitor-days)
          ctx.fillText(
            `${formatNumber(stats.visitor_days)} visits`,
            topLeft.x + width / 2,
            topLeft.y + height / 2 + 5
          );
        }
      }
    }

    // Draw zone being created
    if (drawing) {
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(
        Math.min(drawing.startX, drawing.currentX),
        Math.min(drawing.startY, drawing.currentY),
        Math.abs(drawing.currentX - drawing.startX),
        Math.abs(drawing.currentY - drawing.startY)
      );
      ctx.setLineDash([]);

      ctx.fillStyle = 'rgba(37, 99, 235, 0.1)';
      ctx.fillRect(
        Math.min(drawing.startX, drawing.currentX),
        Math.min(drawing.startY, drawing.currentY),
        Math.abs(drawing.currentX - drawing.startX),
        Math.abs(drawing.currentY - drawing.startY)
      );
    }

    // Draw color legend - vertical, positioned at top right
    const legendBarWidth = 20;
    const legendBarHeight = 120;
    const legendBoxWidth = 160;  // Wide enough for large numbers
    const legendX = dimensions.width - legendBoxWidth - 15;
    const legendY = 15;

    // Legend background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.beginPath();
    ctx.roundRect(legendX, legendY, legendBoxWidth, legendBarHeight + 80, 8);
    ctx.fill();
    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(legendX, legendY, legendBoxWidth, legendBarHeight + 80, 8);
    ctx.stroke();

    // Legend title
    ctx.fillStyle = '#111827';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(
      viewMode === 'tracks' ? 'Track Density' : 'Dwell Time',
      legendX + legendBoxWidth / 2,
      legendY + 20
    );

    // Legend subtitle (unit)
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#6b7280';
    ctx.fillText(
      viewMode === 'tracks' ? '(tracks per cell)' : '(seconds)',
      legendX + legendBoxWidth / 2,
      legendY + 36
    );

    // Vertical color gradient bar - positioned on the left side of the box
    const gradientX = legendX + 15;
    const gradientY = legendY + 50;
    const gradient = ctx.createLinearGradient(0, gradientY, 0, gradientY + legendBarHeight);
    gradient.addColorStop(0, getHeatmapColor(1, 1));  // Top = max (red)
    gradient.addColorStop(0.25, getHeatmapColor(0.75, 1));
    gradient.addColorStop(0.5, getHeatmapColor(0.5, 1));
    gradient.addColorStop(0.75, getHeatmapColor(0.25, 1));
    gradient.addColorStop(1, getHeatmapColor(0, 1));  // Bottom = min (blue)
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.roundRect(gradientX, gradientY, legendBarWidth, legendBarHeight, 4);
    ctx.fill();

    // Gradient border
    ctx.strokeStyle = '#9ca3af';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(gradientX, gradientY, legendBarWidth, legendBarHeight, 4);
    ctx.stroke();

    // Min/max values will be rendered as HTML inputs for interactivity

    // Draw calibration points
    if (calibration?.isCalibrating) {
      const heatmapColor = '#ef4444'; // red for heatmap points
      const floorplanColor = '#22c55e'; // green for floorplan points

      // Draw heatmap points (numbered)
      calibration.heatmapPoints.forEach((point, index) => {
        // Circle
        ctx.beginPath();
        ctx.arc(point.x, point.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = heatmapColor;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Number label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${index + 1}`, point.x, point.y + 5);
      });

      // Draw floorplan points (numbered)
      calibration.floorplanPoints.forEach((point, index) => {
        // Circle
        ctx.beginPath();
        ctx.arc(point.x, point.y, 12, 0, Math.PI * 2);
        ctx.fillStyle = floorplanColor;
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Number label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${index + 1}`, point.x, point.y + 5);
      });

      // Draw lines connecting corresponding points
      const numPairs = Math.min(calibration.heatmapPoints.length, calibration.floorplanPoints.length);
      for (let i = 0; i < numPairs; i++) {
        const hp = calibration.heatmapPoints[i];
        const fp = calibration.floorplanPoints[i];
        ctx.beginPath();
        ctx.moveTo(hp.x, hp.y);
        ctx.lineTo(fp.x, fp.y);
        ctx.strokeStyle = '#fbbf24'; // yellow line
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

  }, [heatmapData, floorPlanImage, zones, zoneStats, selectedZone, drawing, dimensions, viewMode, virtualFloorPlan, legendValues, scaleSettings, floorPlanAdjustment, onDataRangeChange, calibration, showFloorPlan, showHeatmap, zoom, pan]);

  // Handle mouse events for zone drawing and calibration
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Handle calibration clicks
      if (calibration?.isCalibrating && onCalibrationClick) {
        onCalibrationClick({ x, y });
        return;
      }

      if (!isDrawingZone) {
        // Check if clicked on a zone (zones are drawn with transform applied)
        for (const zone of zones) {
          const topLeftCanvas = dataToCanvas(
            Math.min(zone.x1, zone.x2),
            Math.max(zone.y1, zone.y2),
            virtualFloorPlan,
            dimensions.width,
            dimensions.height
          );
          const bottomRightCanvas = dataToCanvas(
            Math.max(zone.x1, zone.x2),
            Math.min(zone.y1, zone.y2),
            virtualFloorPlan,
            dimensions.width,
            dimensions.height
          );
          // Apply transform to get the actual screen position of the zone
          const tl = transformPoint(topLeftCanvas.x, topLeftCanvas.y, floorPlanAdjustment, dimensions.width, dimensions.height);
          const br = transformPoint(bottomRightCanvas.x, bottomRightCanvas.y, floorPlanAdjustment, dimensions.width, dimensions.height);
          // Apply zoom/pan
          const topLeft = applyZoomPan(tl.x, tl.y, zoom, pan, dimensions.width, dimensions.height);
          const bottomRight = applyZoomPan(br.x, br.y, zoom, pan, dimensions.width, dimensions.height);

          // Handle case where transform might flip coordinates
          const minX = Math.min(topLeft.x, bottomRight.x);
          const maxX = Math.max(topLeft.x, bottomRight.x);
          const minY = Math.min(topLeft.y, bottomRight.y);
          const maxY = Math.max(topLeft.y, bottomRight.y);

          if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
            onSelectZone(selectedZone?.id === zone.id ? null : zone);
            return;
          }
        }
        // Not clicking on a zone - start panning
        setIsPanning(true);
        panStartRef.current = { x, y, panX: pan.x, panY: pan.y };
        return;
      }

      setDrawing({
        startX: x,
        startY: y,
        currentX: x,
        currentY: y,
      });
    },
    [isDrawingZone, zones, selectedZone, virtualFloorPlan, dimensions, onSelectZone, calibration, onCalibrationClick, floorPlanAdjustment, zoom, pan]
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Handle panning with threshold
      if (isPanning) {
        const dx = x - panStartRef.current.x;
        const dy = y - panStartRef.current.y;

        // Check if we've exceeded the pan threshold
        if (!panStarted) {
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance < PAN_THRESHOLD) {
            return; // Don't pan yet
          }
          setPanStarted(true);
        }

        setPan({
          x: panStartRef.current.panX + dx,
          y: panStartRef.current.panY + dy
        });
        return;
      }

      // Update drawing
      if (drawing) {
        setDrawing((prev) => prev ? { ...prev, currentX: x, currentY: y } : null);
      }

      // Find hovered cell (only for dwell mode which still has cells)
      if (viewMode === 'dwell' && (heatmapData as DwellTimeResponse)?.cells) {
        const dwellData = heatmapData as DwellTimeResponse;
        // Need to inverse zoom/pan first, then inverse floor plan adjustment
        const unzoomed = inverseZoomPan(x, y, zoom, pan, dimensions.width, dimensions.height);
        const untransformed = inverseTransformPoint(unzoomed.x, unzoomed.y, floorPlanAdjustment, dimensions.width, dimensions.height);
        const dataCoords = canvasToData(untransformed.x, untransformed.y, virtualFloorPlan, dimensions.width, dimensions.height);
        const gridSize = dwellData.grid_size;

        const cell = dwellData.cells.find((c) => {
          return (
            Math.abs(c.x - dataCoords.x) < gridSize / 2 &&
            Math.abs(c.y - dataCoords.y) < gridSize / 2
          );
        });

        if (cell) {
          setHoveredCell({ x: dataCoords.x, y: dataCoords.y, value: cell.avg_dwell_seconds });
        } else {
          setHoveredCell(null);
        }
      } else {
        // Raw points mode - no hover info
        setHoveredCell(null);
      }
    },
    [drawing, heatmapData, virtualFloorPlan, dimensions, viewMode, isPanning, panStarted, zoom, pan, floorPlanAdjustment]
  );

  const handleMouseUp = useCallback(async () => {
    // Stop panning if we were panning
    if (isPanning) {
      setIsPanning(false);
      setPanStarted(false);
      return;
    }

    if (!drawing || !isDrawingZone) return;

    const width = Math.abs(drawing.currentX - drawing.startX);
    const height = Math.abs(drawing.currentY - drawing.startY);

    // Minimum size check
    if (width < 20 || height < 20) {
      setDrawing(null);
      return;
    }

    // First inverse zoom/pan, then inverse floor plan adjustment
    const unzoomedStart = inverseZoomPan(
      Math.min(drawing.startX, drawing.currentX),
      Math.min(drawing.startY, drawing.currentY),
      zoom, pan, dimensions.width, dimensions.height
    );
    const unzoomedEnd = inverseZoomPan(
      Math.max(drawing.startX, drawing.currentX),
      Math.max(drawing.startY, drawing.currentY),
      zoom, pan, dimensions.width, dimensions.height
    );

    // Apply inverse floor plan adjustment
    const invStart = inverseTransformPoint(
      unzoomedStart.x,
      unzoomedStart.y,
      floorPlanAdjustment,
      dimensions.width,
      dimensions.height
    );
    const invEnd = inverseTransformPoint(
      unzoomedEnd.x,
      unzoomedEnd.y,
      floorPlanAdjustment,
      dimensions.width,
      dimensions.height
    );

    // Convert to data coordinates
    const topLeft = canvasToData(
      invStart.x,
      invStart.y,
      virtualFloorPlan,
      dimensions.width,
      dimensions.height
    );
    const bottomRight = canvasToData(
      invEnd.x,
      invEnd.y,
      virtualFloorPlan,
      dimensions.width,
      dimensions.height
    );

    const zoneName = prompt('Enter zone name:', `Zone ${zones.length + 1}`);
    if (!zoneName) {
      setDrawing(null);
      return;
    }

    try {
      await createZone.mutateAsync({
        name: zoneName,
        store_id: storeId,
        floor: floor,
        x1: topLeft.x,
        y1: topLeft.y,
        x2: bottomRight.x,
        y2: bottomRight.y,
      });
      toast.success('Zone created');
      onZoneCreated();
    } catch {
      toast.error('Failed to create zone');
    }

    setDrawing(null);
  }, [drawing, isDrawingZone, virtualFloorPlan, dimensions, zones, storeId, floor, createZone, onZoneCreated, floorPlanAdjustment, isPanning, zoom, pan]);

  // Determine cursor style
  const cursorStyle = calibration?.isCalibrating
    ? 'cursor-crosshair'
    : isDrawingZone
      ? 'cursor-crosshair'
      : isPanning
        ? 'cursor-grabbing'
        : 'cursor-grab';

  return (
    <div ref={containerRef} className="relative">
      <canvas
        ref={canvasRef}
        width={dimensions.width}
        height={dimensions.height}
        className={cursorStyle}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => {
          setHoveredCell(null);
          if (drawing) setDrawing(null);
        }}
      />

      {/* Tooltip */}
      {hoveredCell && (
        <div
          className="absolute bg-gray-900 text-white text-xs px-2 py-1 rounded pointer-events-none"
          style={{
            left: 10,
            bottom: 10,
          }}
        >
          {viewMode === 'tracks'
            ? `${formatNumber(hoveredCell.value)} tracks`
            : `${formatDuration(hoveredCell.value)} dwell time`}
          <br />
          <span className="text-gray-400">
            ({hoveredCell.x.toFixed(1)}, {hoveredCell.y.toFixed(1)})
          </span>
        </div>
      )}

      {/* Mode indicators */}
      {isDrawingZone && !calibration?.isCalibrating && (
        <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
          Click and drag to draw a zone
        </div>
      )}
      {calibration?.isCalibrating && (
        <div className="absolute top-2 left-2 bg-green-600 text-white text-sm px-3 py-2 rounded shadow-lg">
          <div className="font-semibold">
            {calibration.step === 'heatmap'
              ? `Calibration: Click HEATMAP point ${calibration.heatmapPoints.length + 1}/3`
              : `Calibration: Click FLOOR PLAN point ${calibration.floorplanPoints.length + 1}/3`
            }
          </div>
          <div className="text-xs mt-1 opacity-80">
            {calibration.step === 'heatmap'
              ? 'Click on a recognizable feature on the heatmap'
              : 'Click on the same feature on the floor plan'
            }
          </div>
        </div>
      )}

      {/* No data message */}
      {(!heatmapData ||
        (viewMode === 'tracks' && (heatmapData as HeatmapResponse)?.points?.length === 0) ||
        (viewMode === 'dwell' && (heatmapData as DwellTimeResponse)?.cells?.length === 0)
      ) && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="bg-white/90 px-4 py-2 rounded-lg text-gray-600">
            No data for selected filters
          </div>
        </div>
      )}

      {/* Legend min/max inputs - positioned next to gradient bar */}
      {legendValues && onScaleSettingsChange && (
        <>
          {/* Max value input - top of gradient (red) */}
          <input
            type="number"
            min="1"
            value={scaleSettings.auto ? legendValues.max : scaleSettings.max}
            onChange={(e) => {
              const newMax = Math.max(1, parseInt(e.target.value) || 1);
              onScaleSettingsChange({
                ...scaleSettings,
                auto: false,
                max: newMax,
              });
            }}
            className="absolute w-24 px-2 py-1 text-sm text-gray-700 bg-white border border-gray-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-right"
            style={{ right: 22, top: 55 }}
            title="Click to edit maximum value"
          />
          {/* Min value input - bottom of gradient (blue) */}
          <input
            type="number"
            min="0"
            value={scaleSettings.auto ? legendValues.min : scaleSettings.min}
            onChange={(e) => {
              const newMin = Math.max(0, parseInt(e.target.value) || 0);
              onScaleSettingsChange({
                ...scaleSettings,
                auto: false,
                min: newMin,
              });
            }}
            className="absolute w-24 px-2 py-1 text-sm text-gray-700 bg-white border border-gray-300 rounded focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-right"
            style={{ right: 22, top: 155 }}
            title="Click to edit minimum value"
          />
        </>
      )}
    </div>
  );
}
