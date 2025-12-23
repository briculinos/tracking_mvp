import { format, subDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';

interface Props {
  startDate: string;
  endDate: string;
  startHour: number;
  endHour: number;
  onStartDateChange: (date: string) => void;
  onEndDateChange: (date: string) => void;
  onStartHourChange: (hour: number) => void;
  onEndHourChange: (hour: number) => void;
}

export default function TimeFilters({
  startDate,
  endDate,
  startHour,
  endHour,
  onStartDateChange,
  onEndDateChange,
  onStartHourChange,
  onEndHourChange,
}: Props) {
  const today = new Date();

  const presets = [
    {
      label: 'Today',
      start: format(today, 'yyyy-MM-dd'),
      end: format(today, 'yyyy-MM-dd'),
    },
    {
      label: 'Yesterday',
      start: format(subDays(today, 1), 'yyyy-MM-dd'),
      end: format(subDays(today, 1), 'yyyy-MM-dd'),
    },
    {
      label: 'Last 7 days',
      start: format(subDays(today, 7), 'yyyy-MM-dd'),
      end: format(today, 'yyyy-MM-dd'),
    },
    {
      label: 'This week',
      start: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      end: format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
    },
    {
      label: 'This month',
      start: format(startOfMonth(today), 'yyyy-MM-dd'),
      end: format(endOfMonth(today), 'yyyy-MM-dd'),
    },
    {
      label: 'Last 30 days',
      start: format(subDays(today, 30), 'yyyy-MM-dd'),
      end: format(today, 'yyyy-MM-dd'),
    },
  ];

  const applyPreset = (preset: (typeof presets)[0]) => {
    onStartDateChange(preset.start);
    onEndDateChange(preset.end);
  };

  return (
    <div className="space-y-4">
      {/* Quick Presets */}
      <div>
        <label className="block text-sm text-gray-600 mb-2">Quick Select</label>
        <div className="flex flex-wrap gap-1">
          {presets.map((preset) => (
            <button
              key={preset.label}
              onClick={() => applyPreset(preset)}
              className={`px-2 py-1 text-xs rounded ${
                startDate === preset.start && endDate === preset.end
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Date Range */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
            className="w-full px-2 py-1 border rounded text-sm"
          />
        </div>
        <div>
          <label className="block text-sm text-gray-600 mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => onEndDateChange(e.target.value)}
            className="w-full px-2 py-1 border rounded text-sm"
          />
        </div>
      </div>

      {/* Hour Range */}
      <div>
        <label className="block text-sm text-gray-600 mb-2">
          Hours: {startHour}:00 - {endHour}:00
        </label>
        <div className="flex items-center gap-2">
          <input
            type="range"
            min="0"
            max="23"
            value={startHour}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              onStartHourChange(val);
              if (val > endHour) onEndHourChange(val);
            }}
            className="flex-1"
          />
          <span className="text-xs text-gray-500 w-8">{startHour}:00</span>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <input
            type="range"
            min="0"
            max="23"
            value={endHour}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              onEndHourChange(val);
              if (val < startHour) onStartHourChange(val);
            }}
            className="flex-1"
          />
          <span className="text-xs text-gray-500 w-8">{endHour}:00</span>
        </div>
      </div>

      {/* Common Hour Presets */}
      <div>
        <label className="block text-sm text-gray-600 mb-2">Hour Presets</label>
        <div className="flex flex-wrap gap-1">
          <button
            onClick={() => {
              onStartHourChange(0);
              onEndHourChange(23);
            }}
            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
          >
            All Day
          </button>
          <button
            onClick={() => {
              onStartHourChange(9);
              onEndHourChange(17);
            }}
            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
          >
            9-17
          </button>
          <button
            onClick={() => {
              onStartHourChange(10);
              onEndHourChange(20);
            }}
            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
          >
            10-20
          </button>
          <button
            onClick={() => {
              onStartHourChange(12);
              onEndHourChange(14);
            }}
            className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
          >
            Lunch
          </button>
        </div>
      </div>
    </div>
  );
}
