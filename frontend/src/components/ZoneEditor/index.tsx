import { useState } from 'react';
import toast from 'react-hot-toast';
import { useDeleteZone, useUpdateZone } from '../../hooks/useZones';
import { formatNumber, formatDuration } from '../../utils/coordinates';
import type { Zone, ZoneStats } from '../../types';

interface Props {
  zones: Zone[];
  zoneStats: ZoneStats[];
  selectedZone: Zone | null;
  onSelectZone: (zone: Zone | null) => void;
  storeId: number;
  floor: number;
  onZoneDeleted: () => void;
}

export default function ZoneEditor({
  zones,
  zoneStats,
  selectedZone,
  onSelectZone,
  storeId,
  onZoneDeleted,
}: Props) {
  const [editingZone, setEditingZone] = useState<number | null>(null);
  const [editName, setEditName] = useState('');

  const deleteZone = useDeleteZone();
  const updateZone = useUpdateZone();

  const getZoneStats = (zoneId: number) => {
    return zoneStats.find((s) => s.zone_id === zoneId);
  };

  const handleDelete = async (zone: Zone) => {
    if (!confirm(`Delete zone "${zone.name}"?`)) return;

    try {
      await deleteZone.mutateAsync({ zoneId: zone.id, storeId });
      toast.success('Zone deleted');
      onZoneDeleted();
      if (selectedZone?.id === zone.id) {
        onSelectZone(null);
      }
    } catch {
      toast.error('Failed to delete zone');
    }
  };

  const handleRename = async (zone: Zone) => {
    if (!editName.trim()) return;

    try {
      await updateZone.mutateAsync({
        zoneId: zone.id,
        updates: { name: editName.trim() },
      });
      toast.success('Zone renamed');
      setEditingZone(null);
    } catch {
      toast.error('Failed to rename zone');
    }
  };

  if (zones.length === 0) {
    return (
      <div className="text-sm text-gray-500 text-center py-4">
        No zones defined. Click "Add Zone" and draw on the map.
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto">
      {zones.map((zone) => {
        const stats = getZoneStats(zone.id);
        const isSelected = selectedZone?.id === zone.id;
        const isEditing = editingZone === zone.id;

        return (
          <div
            key={zone.id}
            className={`p-2 rounded border cursor-pointer transition-colors ${
              isSelected
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
            onClick={() => onSelectZone(isSelected ? null : zone)}
          >
            <div className="flex items-center justify-between">
              {isEditing ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRename(zone);
                    if (e.key === 'Escape') setEditingZone(null);
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex-1 px-2 py-1 text-sm border rounded mr-2"
                  autoFocus
                />
              ) : (
                <span className="font-medium text-sm truncate">{zone.name}</span>
              )}

              <div className="flex items-center gap-1 ml-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRename(zone);
                      }}
                      className="text-green-600 hover:text-green-800 text-xs px-1"
                    >
                      Save
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingZone(null);
                      }}
                      className="text-gray-600 hover:text-gray-800 text-xs px-1"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingZone(zone.id);
                        setEditName(zone.name);
                      }}
                      className="text-gray-400 hover:text-blue-600 text-xs"
                      title="Rename"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(zone);
                      }}
                      className="text-gray-400 hover:text-red-600 text-xs"
                      title="Delete"
                    >
                      Del
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Stats */}
            {stats && (
              <div className="mt-1 grid grid-cols-2 gap-2 text-xs text-gray-600">
                <div>
                  <span className="font-medium text-blue-600">
                    {formatNumber(stats.track_count)}
                  </span>{' '}
                  tracks
                </div>
                <div>
                  <span className="font-medium text-green-600">
                    {formatNumber(stats.unique_visitors)}
                  </span>{' '}
                  visitors
                </div>
                {stats.avg_dwell_seconds !== undefined && stats.avg_dwell_seconds > 0 && (
                  <div className="col-span-2">
                    Avg dwell:{' '}
                    <span className="font-medium text-purple-600">
                      {formatDuration(stats.avg_dwell_seconds)}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
