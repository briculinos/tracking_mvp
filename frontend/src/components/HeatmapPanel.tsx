import { useState, useCallback } from 'react';
import HeatmapCanvas from './HeatmapCanvas';
import type {
  FloorPlan,
  FloorPlanAdjustment,
  Zone,
  ZoneStats,
  HeatmapResponse,
  DwellTimeResponse,
  ViewMode,
  ScaleSettings,
  CalibrationState,
  CalibrationPoint,
} from '../types';

type DisplayMode = 'full' | 'heatmapOnly' | 'dataOnly';

interface VisibleStats {
  pointsInView: number;
  totalPoints: number;
  percentage: string;
}

interface HeatmapPanelProps {
  title: string;
  viewMode: ViewMode;
  heatmapData: HeatmapResponse | DwellTimeResponse | null | undefined;
  floorPlan: FloorPlan | undefined;
  zones: Zone[];
  zoneStats: ZoneStats[];
  selectedZone: Zone | null;
  isDrawingZone: boolean;
  storeId: number;
  floor: number;
  scaleSettings: ScaleSettings;
  floorPlanAdjustment: FloorPlanAdjustment;
  calibration: CalibrationState;
  isLoading: boolean;
  onZoneCreated: () => void;
  onSelectZone: (zone: Zone | null) => void;
  onDataRangeChange: (min: number, max: number) => void;
  onCalibrationClick: (point: CalibrationPoint) => void;
  onScaleSettingsChange: (settings: ScaleSettings) => void;
  onViewModeChange?: (mode: ViewMode) => void;
}

export default function HeatmapPanel({
  title,
  viewMode,
  heatmapData,
  floorPlan,
  zones,
  zoneStats,
  selectedZone,
  isDrawingZone,
  storeId,
  floor,
  scaleSettings,
  floorPlanAdjustment,
  calibration,
  isLoading,
  onZoneCreated,
  onSelectZone,
  onDataRangeChange,
  onCalibrationClick,
  onScaleSettingsChange,
  onViewModeChange,
}: HeatmapPanelProps) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('full');
  const [zoom, setZoom] = useState(1);
  const [visibleStats, setVisibleStats] = useState<VisibleStats | null>(null);

  const handleZoomIn = useCallback(() => {
    setZoom(prev => Math.min(10, prev * 1.25));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom(prev => Math.max(0.5, prev / 1.25));
  }, []);

  const handleZoomReset = useCallback(() => {
    setZoom(1);
  }, []);

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
        <div className="flex items-center gap-4">
          {/* View Mode Toggle */}
          {onViewModeChange ? (
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => onViewModeChange('tracks')}
                className={`px-4 py-2 rounded-md text-lg font-medium transition-colors ${
                  viewMode === 'tracks'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Tracks
              </button>
              <button
                onClick={() => onViewModeChange('dwell')}
                className={`px-4 py-2 rounded-md text-lg font-medium transition-colors ${
                  viewMode === 'dwell'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Dwell Time
              </button>
            </div>
          ) : (
            <h3 className="text-3xl font-semibold text-gray-900">{title}</h3>
          )}
        </div>
        <div className="flex items-center gap-4">
          {/* Zoom Controls */}
          <div
            className="flex items-center gap-1 bg-gray-100 rounded-lg p-1"
            title="Ctrl+Scroll to zoom on map, drag to pan"
          >
            <button
              onClick={handleZoomOut}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 text-gray-600"
              title="Zoom out"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
              </svg>
            </button>
            <span
              className="px-2 text-sm font-medium text-gray-700 min-w-[50px] text-center cursor-help"
              title="Ctrl+Scroll to zoom on map"
            >
              {Math.round(zoom * 100)}%
            </span>
            <button
              onClick={handleZoomIn}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 text-gray-600"
              title="Zoom in"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </button>
            {zoom !== 1 && (
              <button
                onClick={handleZoomReset}
                className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-200 text-gray-600"
                title="Reset zoom and position"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            )}
          </div>

          {/* Display Mode Toggle */}
          <div className="flex items-center gap-1 text-sm">
            <button
              onClick={() => setDisplayMode('full')}
              className={`px-3 py-1.5 rounded ${
                displayMode === 'full' ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              Full
            </button>
            <button
              onClick={() => setDisplayMode('dataOnly')}
              className={`px-3 py-1.5 rounded ${
                displayMode === 'dataOnly' ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              Data Only
            </button>
          </div>
        </div>
      </div>

      {/* Heatmap Canvas */}
      <div className="relative" style={{ height: 'calc(100vh - 280px)', minHeight: '400px' }}>
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : !storeId ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 text-gray-500">
            Select a store to view data
          </div>
        ) : (
          <>
            <HeatmapCanvas
              heatmapData={heatmapData}
              floorPlan={floorPlan}
              zones={zones}
              zoneStats={zoneStats}
              selectedZone={selectedZone}
              viewMode={viewMode}
              isDrawingZone={isDrawingZone}
              storeId={storeId}
              floor={floor}
              scaleSettings={scaleSettings}
              floorPlanAdjustment={floorPlanAdjustment}
              calibration={calibration}
              onZoneCreated={onZoneCreated}
              onSelectZone={onSelectZone}
              onDataRangeChange={onDataRangeChange}
              onCalibrationClick={onCalibrationClick}
              onScaleSettingsChange={onScaleSettingsChange}
              showFloorPlan={displayMode !== 'dataOnly'}
              showHeatmap={displayMode === 'full' || displayMode === 'dataOnly'}
              externalZoom={zoom}
              onZoomChange={setZoom}
              onVisibleStatsChange={setVisibleStats}
            />
            {/* Visible Region Stats Overlay */}
            {visibleStats && (
              <div className="absolute bottom-4 left-4 bg-white/95 rounded-lg shadow-lg border border-gray-200 px-4 py-3">
                <div className="text-sm font-medium text-gray-500 mb-1">Visible Region</div>
                <div className="text-xl font-bold text-gray-900">
                  {visibleStats.pointsInView.toLocaleString()} {viewMode === 'tracks' ? 'points' : 'cells'}
                </div>
                <div className="text-sm text-gray-600">
                  {visibleStats.percentage}% of total
                </div>
              </div>
            )}
          </>
        )}
      </div>

    </div>
  );
}
