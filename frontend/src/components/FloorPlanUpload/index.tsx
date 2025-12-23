import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import { uploadFloorPlan } from '../../services/api';
import type { FloorPlanCalibration } from '../../types';

interface DataBounds {
  min_x: number;
  max_x: number;
  min_y: number;
  max_y: number;
}

interface Props {
  storeId: number;
  floor: number;
  dataBounds?: DataBounds;
  onClose: () => void;
  onUploaded: () => void;
}

export default function FloorPlanUpload({ storeId, floor, dataBounds, onClose, onUploaded }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [useAutoBounds, setUseAutoBounds] = useState(true);

  // Check if we have valid data bounds
  const hasValidBounds = dataBounds &&
    dataBounds.min_x !== Infinity && dataBounds.max_x !== -Infinity &&
    dataBounds.min_y !== Infinity && dataBounds.max_y !== -Infinity &&
    dataBounds.min_x !== dataBounds.max_x && dataBounds.min_y !== dataBounds.max_y;

  const [calibration, setCalibration] = useState<FloorPlanCalibration>(() => {
    if (hasValidBounds) {
      // Add 5% margin to data bounds for better coverage
      const marginX = (dataBounds.max_x - dataBounds.min_x) * 0.05;
      const marginY = (dataBounds.max_y - dataBounds.min_y) * 0.05;
      return {
        data_min_x: dataBounds.min_x - marginX,
        data_max_x: dataBounds.max_x + marginX,
        data_min_y: dataBounds.min_y - marginY,
        data_max_y: dataBounds.max_y + marginY,
      };
    }
    return {
      data_min_x: 0,
      data_max_x: 100,
      data_min_y: 0,
      data_max_y: 100,
    };
  });

  // Update calibration when dataBounds changes and useAutoBounds is enabled
  useEffect(() => {
    if (useAutoBounds && hasValidBounds) {
      const marginX = (dataBounds.max_x - dataBounds.min_x) * 0.05;
      const marginY = (dataBounds.max_y - dataBounds.min_y) * 0.05;
      setCalibration({
        data_min_x: dataBounds.min_x - marginX,
        data_max_x: dataBounds.max_x + marginX,
        data_min_y: dataBounds.min_y - marginY,
        data_max_y: dataBounds.max_y + marginY,
      });
    }
  }, [dataBounds, useAutoBounds, hasValidBounds]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setFile(selectedFile);

    // Create preview
    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(selectedFile);
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    try {
      await uploadFloorPlan(storeId, floor, file, calibration);
      toast.success('Floor plan uploaded');
      onUploaded();
    } catch {
      toast.error('Failed to upload floor plan');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Upload Floor Plan</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700 text-2xl"
            >
              &times;
            </button>
          </div>

          {/* File Selection */}
          <div className="mb-6">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-blue-500 transition-colors"
            >
              {preview ? (
                <img
                  src={preview}
                  alt="Preview"
                  className="max-h-64 mx-auto rounded"
                />
              ) : (
                <div className="text-gray-500">
                  <div className="text-4xl mb-2">+</div>
                  <div>Click to select floor plan image</div>
                  <div className="text-sm text-gray-400 mt-1">
                    Supports PNG, JPG, GIF
                  </div>
                </div>
              )}
            </button>
            {file && (
              <p className="mt-2 text-sm text-gray-600 text-center">
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </p>
            )}
          </div>

          {/* Calibration */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium">
                Coordinate Calibration
              </h3>
              {hasValidBounds && (
                <label className="flex items-center text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useAutoBounds}
                    onChange={(e) => setUseAutoBounds(e.target.checked)}
                    className="mr-2"
                  />
                  <span className="text-green-600 font-medium">Auto-detect from data</span>
                </label>
              )}
            </div>

            {hasValidBounds && useAutoBounds ? (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                <p className="text-sm text-green-800">
                  Bounds auto-detected from track data with 5% margin.
                  Uncheck "Auto-detect" to customize.
                </p>
              </div>
            ) : !hasValidBounds ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3">
                <p className="text-sm text-yellow-800">
                  No track data available. Load heatmap data first for auto-detection,
                  or enter coordinates manually.
                </p>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Min X (Latitude)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={calibration.data_min_x}
                  disabled={useAutoBounds && hasValidBounds}
                  onChange={(e) => {
                    setUseAutoBounds(false);
                    setCalibration((c) => ({
                      ...c,
                      data_min_x: parseFloat(e.target.value) || 0,
                    }));
                  }}
                  className={`w-full px-3 py-2 border rounded ${
                    useAutoBounds && hasValidBounds ? 'bg-gray-100 text-gray-500' : ''
                  }`}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Max X (Latitude)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={calibration.data_max_x}
                  disabled={useAutoBounds && hasValidBounds}
                  onChange={(e) => {
                    setUseAutoBounds(false);
                    setCalibration((c) => ({
                      ...c,
                      data_max_x: parseFloat(e.target.value) || 100,
                    }));
                  }}
                  className={`w-full px-3 py-2 border rounded ${
                    useAutoBounds && hasValidBounds ? 'bg-gray-100 text-gray-500' : ''
                  }`}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Min Y (Longitude)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={calibration.data_min_y}
                  disabled={useAutoBounds && hasValidBounds}
                  onChange={(e) => {
                    setUseAutoBounds(false);
                    setCalibration((c) => ({
                      ...c,
                      data_min_y: parseFloat(e.target.value) || 0,
                    }));
                  }}
                  className={`w-full px-3 py-2 border rounded ${
                    useAutoBounds && hasValidBounds ? 'bg-gray-100 text-gray-500' : ''
                  }`}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">
                  Max Y (Longitude)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  value={calibration.data_max_y}
                  disabled={useAutoBounds && hasValidBounds}
                  onChange={(e) => {
                    setUseAutoBounds(false);
                    setCalibration((c) => ({
                      ...c,
                      data_max_y: parseFloat(e.target.value) || 100,
                    }));
                  }}
                  className={`w-full px-3 py-2 border rounded ${
                    useAutoBounds && hasValidBounds ? 'bg-gray-100 text-gray-500' : ''
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {uploading ? 'Uploading...' : 'Upload'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
