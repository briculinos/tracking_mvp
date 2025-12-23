import { useState } from 'react';
import HeatmapCanvas from './HeatmapCanvas';
import { formatNumber } from '../utils/coordinates';
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
}: HeatmapPanelProps) {
  const [displayMode, setDisplayMode] = useState<DisplayMode>('full');

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
        <div className="flex items-center gap-4">
          <h3 className="text-3xl font-semibold text-gray-900">{title}</h3>
          {/* Stats display */}
          {viewMode === 'tracks' && heatmapData && 'points' in heatmapData && (
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <strong>{formatNumber(heatmapData.total_visitor_days || 0)}</strong> visits
              </span>
              <span className="text-gray-400">|</span>
              <span>{formatNumber(heatmapData.total_unique_visitors || 0)} unique</span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-400">{formatNumber(heatmapData.total_in_database)} positions</span>
            </div>
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
            {viewMode === 'tracks' ? 'Tracks Density' : 'Dwell Time'}
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
