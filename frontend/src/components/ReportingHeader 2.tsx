import type { Store } from '../types';

interface ReportingHeaderProps {
  stores: Store[];
  selectedStoreId: number | null;
  startDate: string;
  endDate: string;
  onStoreChange: (storeId: number | null) => void;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
}

export default function ReportingHeader({
  stores,
  selectedStoreId,
  startDate,
  endDate,
  onStoreChange,
  onStartDateChange,
  onEndDateChange,
}: ReportingHeaderProps) {
  const selectedStore = stores.find((s) => s.store_id === selectedStoreId);

  return (
    <div className="mb-6">
      {/* Title Row */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-base text-gray-500 mb-1">Reporting</h1>
          <h2 className="text-3xl font-bold text-gray-900">Customer Flow Tracking</h2>
        </div>
        <button className="px-5 py-2.5 bg-gray-900 text-white text-base rounded-lg hover:bg-gray-800 flex items-center gap-2">
          <span>Download Reports</span>
        </button>
      </div>

      {/* Filters Row */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Country */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 rounded-lg">
          <span className="text-base font-medium">SE</span>
          <button className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Store Selector */}
        <select
          value={selectedStoreId || ''}
          onChange={(e) => onStoreChange(e.target.value ? parseInt(e.target.value) : null)}
          className="px-4 py-2.5 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Choose a store</option>
          {stores.map((store) => (
            <option key={store.store_id} value={store.store_id}>
              Store {store.store_id} - {store.name}
            </option>
          ))}
        </select>

        {/* Group By */}
        <select className="px-4 py-2.5 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <option value="">Group by</option>
          <option value="hour">Hour</option>
          <option value="day">Day</option>
          <option value="week">Week</option>
        </select>

        {/* Time Period */}
        <select className="px-4 py-2.5 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
          <option value="day">day</option>
          <option value="week">week</option>
          <option value="month">month</option>
        </select>

        {/* Date Range */}
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <span className="text-gray-400 text-lg">→</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="px-4 py-2.5 border border-gray-300 rounded-lg text-base focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
