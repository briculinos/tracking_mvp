import { useState } from 'react';
import type { FloorPlan, FloorPlanAdjustment, CalibrationState, Zone, ZoneStats } from '../types';
import { formatDuration, formatNumber } from '../utils/coordinates';

interface SidebarProps {
  currentFloorPlan: FloorPlan | undefined;
  floorPlanAdjustment: FloorPlanAdjustment;
  calibration: CalibrationState;
  isSavingAdjustment: boolean;
  zones: Zone[];
  zoneStats: ZoneStats[];
  selectedZone: Zone | null;
  isDrawingZone: boolean;
  onFloorPlanAdjustmentChange: (adjustment: FloorPlanAdjustment) => void;
  onStartCalibration: () => void;
  onCancelCalibration: () => void;
  onLockCalibration: () => void;
  onShowFloorPlanUpload: () => void;
  onSelectZone: (zone: Zone | null) => void;
  onToggleDrawZone: () => void;
  onDeleteZone: (zoneId: number) => void;
}

export default function Sidebar({
  currentFloorPlan,
  floorPlanAdjustment,
  calibration,
  isSavingAdjustment,
  zones,
  zoneStats,
  selectedZone,
  isDrawingZone,
  onFloorPlanAdjustmentChange,
  onStartCalibration,
  onCancelCalibration,
  onLockCalibration,
  onShowFloorPlanUpload,
  onSelectZone,
  onToggleDrawZone,
  onDeleteZone,
}: SidebarProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const handleReset = () => {
    onFloorPlanAdjustmentChange({
      offsetX: 0,
      offsetY: 0,
      rotation: 0,
      scale: 1.0,
      scaleX: 1.0,
      scaleY: 1.0,
      lockAspectRatio: true,
      useAffine: false,
      affine: undefined,
    });
  };

  return (
    <div className="w-[360px] bg-white border-r border-gray-200 flex flex-col h-screen">
      {/* Logo */}
      <div className="p-5 border-b border-gray-200">
        <img src="/Ikea.png" alt="IKEA" className="h-16" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto">
        {/* Store Realtime */}
        <div className="border-b border-gray-100">
          <button className="w-full px-5 py-4 flex items-center gap-3 text-gray-700 hover:bg-gray-50 text-xl">
            <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <span className="font-medium text-xl">Store Realtime</span>
          </button>
        </div>

        {/* Calibration */}
        <div className="border-b border-gray-100">
          <button
            onClick={() => setExpandedSection(expandedSection === 'reporting' ? null : 'reporting')}
            className="w-full px-5 py-4 flex items-center justify-between text-gray-700 hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8V4m0 4a4 4 0 100 8 4 4 0 000-8zm0 8v4m-8-8H0m4 0a8 8 0 1016 0 8 8 0 00-16 0zm16 0h4" />
              </svg>
              <span className="font-medium text-xl">Calibration</span>
            </div>
            <svg
              className={`w-6 h-6 transition-transform ${expandedSection === 'reporting' ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expandedSection === 'reporting' && (
            <div className="px-5 pb-5 space-y-5">
              {/* Floor Plan */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xl font-medium text-gray-600">Floor Plan</span>
                  <button
                    onClick={onShowFloorPlanUpload}
                    className="text-xl text-blue-600 hover:text-blue-800"
                  >
                    Replace
                  </button>
                </div>
                {currentFloorPlan && (
                  <p className="text-lg text-gray-500 truncate">{currentFloorPlan.filename}</p>
                )}
              </div>

              {/* Adjust Floor Plan */}
              {currentFloorPlan && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xl font-medium text-gray-600">Adjust Floor Plan</span>
                    <button onClick={handleReset} className="text-lg text-gray-500 hover:text-gray-700">
                      Reset
                    </button>
                  </div>

                  {/* Left/Right */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-lg text-gray-500">
                        Left/Right: {floorPlanAdjustment.offsetX.toFixed(1)}%
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={floorPlanAdjustment.offsetX}
                        onChange={(e) =>
                          onFloorPlanAdjustmentChange({
                            ...floorPlanAdjustment,
                            offsetX: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-20 px-2 py-1 text-lg border rounded text-right"
                      />
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="0.5"
                      value={floorPlanAdjustment.offsetX}
                      onChange={(e) =>
                        onFloorPlanAdjustmentChange({
                          ...floorPlanAdjustment,
                          offsetX: parseFloat(e.target.value),
                        })
                      }
                      className="w-full h-1 accent-blue-500"
                    />
                  </div>

                  {/* Up/Down */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-lg text-gray-500">
                        Up/Down: {floorPlanAdjustment.offsetY.toFixed(1)}%
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={floorPlanAdjustment.offsetY}
                        onChange={(e) =>
                          onFloorPlanAdjustmentChange({
                            ...floorPlanAdjustment,
                            offsetY: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-20 px-2 py-1 text-lg border rounded text-right"
                      />
                    </div>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="0.5"
                      value={floorPlanAdjustment.offsetY}
                      onChange={(e) =>
                        onFloorPlanAdjustmentChange({
                          ...floorPlanAdjustment,
                          offsetY: parseFloat(e.target.value),
                        })
                      }
                      className="w-full h-1 accent-blue-500"
                    />
                  </div>

                  {/* Scale */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-lg text-gray-500">Scale</label>
                      <label className="flex items-center text-lg cursor-pointer">
                        <input
                          type="checkbox"
                          checked={floorPlanAdjustment.lockAspectRatio}
                          onChange={(e) =>
                            onFloorPlanAdjustmentChange({
                              ...floorPlanAdjustment,
                              lockAspectRatio: e.target.checked,
                              scaleY: e.target.checked ? floorPlanAdjustment.scaleX : floorPlanAdjustment.scaleY,
                            })
                          }
                          className="mr-2 w-4 h-4"
                        />
                        Lock ratio
                      </label>
                    </div>

                    {/* Scale X */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-lg text-gray-500">
                          Scale X: {Math.round(floorPlanAdjustment.scaleX * 100)}%
                        </label>
                        <input
                          type="number"
                          min="20"
                          max="300"
                          value={Math.round(floorPlanAdjustment.scaleX * 100)}
                          onChange={(e) => {
                            const newScale = parseInt(e.target.value) / 100;
                            onFloorPlanAdjustmentChange({
                              ...floorPlanAdjustment,
                              scaleX: newScale,
                              scaleY: floorPlanAdjustment.lockAspectRatio ? newScale : floorPlanAdjustment.scaleY,
                              scale: newScale,
                            });
                          }}
                          className="w-20 px-2 py-1 text-lg border rounded text-right"
                        />
                      </div>
                      <input
                        type="range"
                        min="20"
                        max="300"
                        step="1"
                        value={floorPlanAdjustment.scaleX * 100}
                        onChange={(e) => {
                          const newScale = parseInt(e.target.value) / 100;
                          onFloorPlanAdjustmentChange({
                            ...floorPlanAdjustment,
                            scaleX: newScale,
                            scaleY: floorPlanAdjustment.lockAspectRatio ? newScale : floorPlanAdjustment.scaleY,
                            scale: newScale,
                          });
                        }}
                        className="w-full h-1 accent-blue-500"
                      />
                    </div>

                    {/* Scale Y */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-lg text-gray-500">
                          Scale Y: {Math.round(floorPlanAdjustment.scaleY * 100)}%
                        </label>
                        <input
                          type="number"
                          min="20"
                          max="300"
                          value={Math.round(floorPlanAdjustment.scaleY * 100)}
                          onChange={(e) => {
                            const newScale = parseInt(e.target.value) / 100;
                            onFloorPlanAdjustmentChange({
                              ...floorPlanAdjustment,
                              scaleY: newScale,
                              scaleX: floorPlanAdjustment.lockAspectRatio ? newScale : floorPlanAdjustment.scaleX,
                            });
                          }}
                          className="w-20 px-2 py-1 text-lg border rounded text-right"
                        />
                      </div>
                      <input
                        type="range"
                        min="20"
                        max="300"
                        step="1"
                        value={floorPlanAdjustment.scaleY * 100}
                        onChange={(e) => {
                          const newScale = parseInt(e.target.value) / 100;
                          onFloorPlanAdjustmentChange({
                            ...floorPlanAdjustment,
                            scaleY: newScale,
                            scaleX: floorPlanAdjustment.lockAspectRatio ? newScale : floorPlanAdjustment.scaleX,
                          });
                        }}
                        className="w-full h-1 accent-blue-500"
                      />
                    </div>
                  </div>

                  {/* Rotation */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-lg text-gray-500">
                        Rotate: {floorPlanAdjustment.rotation}°
                      </label>
                      <input
                        type="number"
                        min="-180"
                        max="360"
                        value={floorPlanAdjustment.rotation}
                        onChange={(e) =>
                          onFloorPlanAdjustmentChange({
                            ...floorPlanAdjustment,
                            rotation: parseInt(e.target.value) || 0,
                          })
                        }
                        className="w-20 px-2 py-1 text-lg border rounded text-right"
                      />
                    </div>
                    <input
                      type="range"
                      min="-180"
                      max="360"
                      step="1"
                      value={floorPlanAdjustment.rotation}
                      onChange={(e) =>
                        onFloorPlanAdjustmentChange({
                          ...floorPlanAdjustment,
                          rotation: parseInt(e.target.value),
                        })
                      }
                      className="w-full h-1 accent-blue-500"
                    />
                  </div>

                  {/* Quick Rotation */}
                  <div>
                    <label className="text-lg text-gray-500 block mb-2">Quick Rotation</label>
                    <div className="flex gap-2">
                      {[0, 90, 180, 270].map((deg) => (
                        <button
                          key={deg}
                          onClick={() =>
                            onFloorPlanAdjustmentChange({
                              ...floorPlanAdjustment,
                              rotation: deg,
                            })
                          }
                          className={`flex-1 py-2 text-lg rounded ${
                            Math.abs(floorPlanAdjustment.rotation - deg) < 5
                              ? 'bg-gray-800 text-white'
                              : 'bg-gray-100 hover:bg-gray-200'
                          }`}
                        >
                          {deg}°
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Fine Nudge */}
                  <div>
                    <label className="text-lg text-gray-500 block mb-2">Fine Nudge (±0.5%)</label>
                    <div className="grid grid-cols-3 gap-2">
                      <div />
                      <button
                        onClick={() =>
                          onFloorPlanAdjustmentChange({
                            ...floorPlanAdjustment,
                            offsetY: floorPlanAdjustment.offsetY - 0.5,
                          })
                        }
                        className="py-2 text-lg bg-gray-100 hover:bg-gray-200 rounded"
                      >
                        ↑
                      </button>
                      <div />
                      <button
                        onClick={() =>
                          onFloorPlanAdjustmentChange({
                            ...floorPlanAdjustment,
                            offsetX: floorPlanAdjustment.offsetX - 0.5,
                          })
                        }
                        className="py-2 text-lg bg-gray-100 hover:bg-gray-200 rounded"
                      >
                        ←
                      </button>
                      <div className="text-center text-lg text-gray-400 py-2">●</div>
                      <button
                        onClick={() =>
                          onFloorPlanAdjustmentChange({
                            ...floorPlanAdjustment,
                            offsetX: floorPlanAdjustment.offsetX + 0.5,
                          })
                        }
                        className="py-2 text-lg bg-gray-100 hover:bg-gray-200 rounded"
                      >
                        →
                      </button>
                      <div />
                      <button
                        onClick={() =>
                          onFloorPlanAdjustmentChange({
                            ...floorPlanAdjustment,
                            offsetY: floorPlanAdjustment.offsetY + 0.5,
                          })
                        }
                        className="py-2 text-lg bg-gray-100 hover:bg-gray-200 rounded"
                      >
                        ↓
                      </button>
                      <div />
                    </div>
                  </div>

                  {/* Scale Nudge */}
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="text-lg text-gray-500 block mb-2">Scale X</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            onFloorPlanAdjustmentChange({
                              ...floorPlanAdjustment,
                              scaleX: Math.max(0.2, floorPlanAdjustment.scaleX - 0.01),
                            })
                          }
                          className="flex-1 py-2 text-lg bg-gray-100 hover:bg-gray-200 rounded"
                        >
                          -
                        </button>
                        <button
                          onClick={() =>
                            onFloorPlanAdjustmentChange({
                              ...floorPlanAdjustment,
                              scaleX: Math.min(3, floorPlanAdjustment.scaleX + 0.01),
                            })
                          }
                          className="flex-1 py-2 text-lg bg-gray-100 hover:bg-gray-200 rounded"
                        >
                          +
                        </button>
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="text-lg text-gray-500 block mb-2">Scale Y</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            onFloorPlanAdjustmentChange({
                              ...floorPlanAdjustment,
                              scaleY: Math.max(0.2, floorPlanAdjustment.scaleY - 0.01),
                            })
                          }
                          className="flex-1 py-2 text-lg bg-gray-100 hover:bg-gray-200 rounded"
                        >
                          -
                        </button>
                        <button
                          onClick={() =>
                            onFloorPlanAdjustmentChange({
                              ...floorPlanAdjustment,
                              scaleY: Math.min(3, floorPlanAdjustment.scaleY + 0.01),
                            })
                          }
                          className="flex-1 py-2 text-lg bg-gray-100 hover:bg-gray-200 rounded"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Calibration Buttons */}
                  <div className="pt-2 space-y-2">
                    {!calibration.isCalibrating ? (
                      <button
                        onClick={onStartCalibration}
                        className="w-full py-3 px-4 bg-amber-400 text-gray-900 text-lg font-medium rounded hover:bg-amber-500"
                      >
                        Auto-Calibrate (3 Points)
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div className="text-base text-center font-medium text-green-700 bg-green-50 py-3 rounded">
                          {calibration.step === 'heatmap'
                            ? `Click heatmap point ${calibration.heatmapPoints.length + 1}/3`
                            : `Click floor plan point ${calibration.floorplanPoints.length + 1}/3`}
                        </div>
                        <button
                          onClick={onCancelCalibration}
                          className="w-full py-2.5 px-4 bg-gray-100 text-gray-700 text-base rounded hover:bg-gray-200"
                        >
                          Cancel Calibration
                        </button>
                      </div>
                    )}

                    {(floorPlanAdjustment.useAffine ||
                      floorPlanAdjustment.offsetX !== 0 ||
                      floorPlanAdjustment.offsetY !== 0 ||
                      floorPlanAdjustment.rotation !== 0 ||
                      floorPlanAdjustment.scaleX !== 1.0 ||
                      floorPlanAdjustment.scaleY !== 1.0) &&
                      !calibration.isCalibrating && (
                        <button
                          onClick={() => {
                            onLockCalibration();
                            setExpandedSection(null);
                          }}
                          disabled={isSavingAdjustment}
                          className="w-full py-3 px-4 bg-blue-600 text-white text-lg font-medium rounded hover:bg-blue-700 disabled:bg-blue-300 flex items-center justify-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                            />
                          </svg>
                          {isSavingAdjustment ? 'Saving...' : 'Lock & Save Calibration'}
                        </button>
                      )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Reporting */}
        <div className="border-b border-gray-100">
          <button
            onClick={() => setExpandedSection(expandedSection === 'zones' ? null : 'zones')}
            className="w-full px-5 py-4 flex items-center justify-between text-gray-700 hover:bg-gray-50"
          >
            <div className="flex items-center gap-3">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="font-medium text-xl">Reporting</span>
            </div>
            <svg
              className={`w-6 h-6 transition-transform ${expandedSection === 'zones' ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {expandedSection === 'zones' && (
            <div className="px-5 pb-5 space-y-4">
              {/* Add Zone Button */}
              <button
                onClick={onToggleDrawZone}
                className={`w-full py-3 px-4 text-lg font-medium rounded flex items-center justify-center gap-2 ${
                  isDrawingZone
                    ? 'bg-red-100 text-red-700 hover:bg-red-200'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {isDrawingZone ? (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Cancel Drawing
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add New Zone
                  </>
                )}
              </button>

              {isDrawingZone && (
                <p className="text-sm text-gray-500 text-center">
                  Click and drag on the heatmap to draw a zone
                </p>
              )}

              {/* Zones List */}
              <div>
                <h4 className="text-lg font-medium text-gray-700 mb-2">Zones ({zones.length})</h4>
                {zones.length === 0 ? (
                  <p className="text-sm text-gray-500">No zones created yet</p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {zones.map((zone) => {
                      const stats = zoneStats.find((s) => s.zone_id === zone.id);
                      return (
                        <div
                          key={zone.id}
                          className={`p-3 rounded border cursor-pointer ${
                            selectedZone?.id === zone.id
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:bg-gray-50'
                          }`}
                          onClick={() => onSelectZone(selectedZone?.id === zone.id ? null : zone)}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-base font-medium text-gray-800">{zone.name}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Delete zone "${zone.name}"?`)) {
                                  onDeleteZone(zone.id);
                                }
                              }}
                              className="p-1 text-gray-400 hover:text-red-600"
                              title="Delete zone"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                          {stats && (
                            <div className="flex items-center gap-4 text-sm text-gray-600">
                              <span className="flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                {formatNumber(stats.visitor_days)} visits
                              </span>
                              {stats.avg_dwell_seconds !== undefined && stats.avg_dwell_seconds > 0 && (
                                <span className="flex items-center gap-1">
                                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                  {formatDuration(stats.avg_dwell_seconds)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}
