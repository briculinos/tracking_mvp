import { useState } from 'react';
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
        <div className="flex items-center gap-2 text-lg">
          <button
            onClick={() => setDisplayMode('full')}
            className={`px-4 py-2 rounded ${
              displayMode === 'full' ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            Full
          </button>
          <button
            onClick={() => setDisplayMode('dataOnly')}
            className={`px-4 py-2 rounded ${
              displayMode === 'dataOnly' ? 'bg-gray-200 text-gray-900' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            Data Only
          </button>
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
          />
        )}
      </div>

    </div>
  );
}
