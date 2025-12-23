import { useState } from 'react';
import { HeatmapResponse, DwellTimeResponse, ViewMode } from '../types';

interface InsightsRequest {
  mode: ViewMode;
  store_id: number;
  floor: number;
  start_date: string;
  end_date: string;
  start_hour: number;
  end_hour: number;
  total_in_database?: number;
  total_rendered?: number;
  total_dwell_time?: number;
  avg_dwell_time?: number;
  active_cells?: number;
  zones_count?: number;
}

interface InsightsResponse {
  analysis: string;
  alarms: string[];
  actions: string[];
}

interface InsightsPanelProps {
  viewMode: ViewMode;
  storeId: number;
  floor: number;
  startDate: string;
  endDate: string;
  startHour: number;
  endHour: number;
  heatmapData: HeatmapResponse | DwellTimeResponse | null | undefined;
  zonesCount: number;
}

const API_BASE = 'http://localhost:8000/api';

export default function InsightsPanel({
  viewMode,
  storeId,
  floor,
  startDate,
  endDate,
  startHour,
  endHour,
  heatmapData,
  zonesCount,
}: InsightsPanelProps) {
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateInsights = async () => {
    if (!heatmapData) return;

    setLoading(true);
    setError(null);

    const request: InsightsRequest = {
      mode: viewMode,
      store_id: storeId,
      floor,
      start_date: startDate,
      end_date: endDate,
      start_hour: startHour,
      end_hour: endHour,
      zones_count: zonesCount,
    };

    if (viewMode === 'tracks') {
      const data = heatmapData as HeatmapResponse;
      request.total_in_database = data.total_in_database;
      request.total_rendered = data.total_returned;
    } else {
      const data = heatmapData as DwellTimeResponse;
      request.total_dwell_time = data.total_dwell_time;
      request.avg_dwell_time = data.avg_dwell_time;
      request.active_cells = data.cells?.length || 0;
    }

    try {
      const response = await fetch(`${API_BASE}/insights/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Failed to generate insights');
      }

      const data = await response.json();
      setInsights(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate insights');
    } finally {
      setLoading(false);
    }
  };

  if (!heatmapData) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mt-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-2xl font-semibold text-gray-800 flex items-center gap-3">
          <svg className="w-7 h-7 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          AI Insights
        </h3>
        <button
          onClick={generateInsights}
          disabled={loading}
          className="px-5 py-3 bg-purple-600 text-white text-lg rounded-lg hover:bg-purple-700 disabled:bg-purple-300 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
        >
          {loading ? (
            <>
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Analyzing...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              Generate Insights
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-5 py-4 rounded-lg mb-4 text-xl">
          {error}
        </div>
      )}

      {insights && (
        <div className="space-y-6">
          {/* Analysis Section */}
          <div className="bg-purple-50 rounded-lg p-6">
            <h4 className="font-semibold text-purple-800 mb-4 text-2xl flex items-center gap-3">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Analysis
            </h4>
            <p className="text-gray-700 text-2xl leading-relaxed">{insights.analysis}</p>
          </div>

          {/* Alarms Section */}
          {insights.alarms.length > 0 && (
            <div className="bg-amber-50 rounded-lg p-6 border border-amber-200">
              <h4 className="font-semibold text-amber-800 mb-4 text-2xl flex items-center gap-3">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Alarms & Risks
              </h4>
              <ul className="space-y-4">
                {insights.alarms.map((alarm, index) => (
                  <li key={index} className="flex items-start gap-4 text-gray-700 text-2xl">
                    <span className="flex-shrink-0 w-10 h-10 bg-amber-200 text-amber-800 rounded-full flex items-center justify-center text-xl font-medium">
                      !
                    </span>
                    <span className="leading-relaxed pt-1">{alarm}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions Section */}
          {insights.actions.length > 0 && (
            <div className="bg-green-50 rounded-lg p-6 border border-green-200">
              <h4 className="font-semibold text-green-800 mb-4 text-2xl flex items-center gap-3">
                <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Recommended Actions
              </h4>
              <ul className="space-y-4">
                {insights.actions.map((action, index) => (
                  <li key={index} className="flex items-start gap-4 text-gray-700 text-2xl">
                    <span className="flex-shrink-0 w-10 h-10 bg-green-200 text-green-800 rounded-full flex items-center justify-center text-xl font-medium">
                      {index + 1}
                    </span>
                    <span className="leading-relaxed pt-1">{action}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!insights && !loading && !error && (
        <p className="text-gray-500 text-lg">
          Click "Generate Insights" to get AI-powered analysis of your {viewMode === 'tracks' ? 'foot traffic' : 'dwell time'} data.
        </p>
      )}
    </div>
  );
}
