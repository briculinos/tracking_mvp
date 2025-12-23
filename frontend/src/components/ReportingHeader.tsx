import type { Store } from '../types';

interface ReportingHeaderProps {
  stores: Store[];
  selectedStoreId: number | null;
  selectedFloor: number;
  availableFloors: number[];
  startDate: string;
  endDate: string;
  startHour: number;
  endHour: number;
  onStoreChange: (storeId: number | null) => void;
  onFloorChange: (floor: number) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onStartHourChange: (hour: number) => void;
  onEndHourChange: (hour: number) => void;
  onDownloadReport: () => void;
}

export default function ReportingHeader({
  stores,
  selectedStoreId,
  selectedFloor,
  availableFloors,
  startDate,
  endDate,
  startHour,
  endHour,
  onStoreChange,
  onFloorChange,
  onStartDateChange,
  onEndDateChange,
  onStartHourChange,
  onEndHourChange,
  onDownloadReport,
}: ReportingHeaderProps) {
  const selectedStore = stores.find((s) => s.store_id === selectedStoreId);

  return (
    <div className="mb-6">
      {/* Title Row */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl text-gray-500 mb-1">Reporting</h1>
          <h2 className="text-5xl font-bold text-gray-900">Customer Flow Tracking</h2>
        </div>
        <button
          onClick={onDownloadReport}
          className="px-6 py-3 bg-gray-900 text-white text-xl rounded-lg hover:bg-gray-800 flex items-center gap-2"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          <span>Download Reports</span>
        </button>
      </div>

      {/* Filters Row */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Country */}
        <div className="flex items-center gap-2 px-5 py-3 bg-gray-100 rounded-lg">
          <span className="text-xl font-medium">SE</span>
          <button className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Store Selector */}
        <select
          value={selectedStoreId || ''}
          onChange={(e) => onStoreChange(e.target.value ? parseInt(e.target.value) : null)}
          className="px-5 py-3 border border-gray-300 rounded-lg text-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Choose a store</option>
          {stores.map((store) => (
            <option key={store.store_id} value={store.store_id}>
              Store {store.store_id} - {store.name}
            </option>
          ))}
        </select>

        {/* Floor Selector */}
        {availableFloors.length > 0 && (
          <select
            value={selectedFloor}
            onChange={(e) => onFloorChange(parseInt(e.target.value))}
            className="px-5 py-3 border border-gray-300 rounded-lg text-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {availableFloors.map((floor) => (
              <option key={floor} value={floor}>
                Floor {floor}
              </option>
            ))}
          </select>
        )}

        {/* Hour Range */}
        <div className="flex items-center gap-2">
          <select
            value={startHour}
            onChange={(e) => onStartHourChange(parseInt(e.target.value))}
            className="px-4 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {i.toString().padStart(2, '0')}:00
              </option>
            ))}
          </select>
          <span className="text-gray-400 text-lg">to</span>
          <select
            value={endHour}
            onChange={(e) => onEndHourChange(parseInt(e.target.value))}
            className="px-4 py-3 border border-gray-300 rounded-lg text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={i}>
                {i.toString().padStart(2, '0')}:00
              </option>
            ))}
          </select>
        </div>

        {/* Date Range */}
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="px-5 py-3 border border-gray-300 rounded-lg text-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <span className="text-gray-400 text-xl">→</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="px-5 py-3 border border-gray-300 rounded-lg text-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Loading indicator */}
        {selectedStore && (
          <div className="ml-auto">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin opacity-0" />
          </div>
        )}
      </div>
    </div>
  );
}
