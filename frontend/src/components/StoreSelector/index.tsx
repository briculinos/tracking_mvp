import type { Store } from '../../types';

interface Props {
  stores: Store[];
  selectedStoreId: number | null;
  selectedFloor: number;
  floors: number[];
  onStoreChange: (storeId: number | null) => void;
  onFloorChange: (floor: number) => void;
  isLoading: boolean;
}

export default function StoreSelector({
  stores,
  selectedStoreId,
  selectedFloor,
  floors,
  onStoreChange,
  onFloorChange,
  isLoading,
}: Props) {
  // Group stores by country
  const storesByCountry = stores.reduce((acc, store) => {
    if (!acc[store.country]) {
      acc[store.country] = [];
    }
    acc[store.country].push(store);
    return acc;
  }, {} as Record<string, Store[]>);

  return (
    <div className="space-y-3">
      {/* Store Select */}
      <div>
        <label className="block text-sm text-gray-600 mb-1">Store</label>
        <select
          value={selectedStoreId ?? ''}
          onChange={(e) => onStoreChange(e.target.value ? parseInt(e.target.value) : null)}
          disabled={isLoading}
          className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <option value="">Select a store...</option>
          {Object.entries(storesByCountry).map(([country, countryStores]) => (
            <optgroup key={country} label={country}>
              {countryStores.map((store) => (
                <option key={store.store_id} value={store.store_id}>
                  {store.name} (ID: {store.store_id})
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Floor Select */}
      {selectedStoreId && floors.length > 0 && (
        <div>
          <label className="block text-sm text-gray-600 mb-1">Floor</label>
          <select
            value={selectedFloor}
            onChange={(e) => onFloorChange(parseInt(e.target.value))}
            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {floors.map((floor) => (
              <option key={floor} value={floor}>
                Floor {floor}
              </option>
            ))}
          </select>
        </div>
      )}

      {isLoading && (
        <div className="text-sm text-gray-500 flex items-center">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
          Loading stores...
        </div>
      )}
    </div>
  );
}
