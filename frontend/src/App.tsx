import { useState, useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { useStores, useFloorPlans } from './hooks/useStores';
import { useHeatmapData } from './hooks/useHeatmapData';
import { useZones, useZoneStats, useDeleteZone } from './hooks/useZones';
import { adjustFloorPlan } from './services/api';
import Sidebar from './components/Sidebar';
import ReportingHeader from './components/ReportingHeader';
import HeatmapPanel from './components/HeatmapPanel';
import FloorPlanUpload from './components/FloorPlanUpload';
import InsightsPanel from './components/InsightsPanel';
import toast from 'react-hot-toast';
import type { AppFilters, Zone, CalibrationState, CalibrationPoint, AffineTransform, ScaleSettings, ViewMode } from './types';

/**
 * Solve for affine transformation matrix given 3 point pairs.
 */
function solveAffineTransform(
  src: CalibrationPoint[],
  dst: CalibrationPoint[]
): AffineTransform | null {
  if (src.length !== 3 || dst.length !== 3) return null;

  const x1 = src[0].x, y1 = src[0].y;
  const x2 = src[1].x, y2 = src[1].y;
  const x3 = src[2].x, y3 = src[2].y;

  const det = x1 * (y2 - y3) - y1 * (x2 - x3) + (x2 * y3 - x3 * y2);

  if (Math.abs(det) < 1e-10) {
    return null;
  }

  const invDet = 1 / det;

  const inv = [
    [(y2 - y3) * invDet, (y3 - y1) * invDet, (y1 - y2) * invDet],
    [(x3 - x2) * invDet, (x1 - x3) * invDet, (x2 - x1) * invDet],
    [(x2 * y3 - x3 * y2) * invDet, (x3 * y1 - x1 * y3) * invDet, (x1 * y2 - x2 * y1) * invDet]
  ];

  const dstX = [dst[0].x, dst[1].x, dst[2].x];
  const dstY = [dst[0].y, dst[1].y, dst[2].y];

  const a = inv[0][0] * dstX[0] + inv[0][1] * dstX[1] + inv[0][2] * dstX[2];
  const b = inv[1][0] * dstX[0] + inv[1][1] * dstX[1] + inv[1][2] * dstX[2];
  const tx = inv[2][0] * dstX[0] + inv[2][1] * dstX[1] + inv[2][2] * dstX[2];

  const c = inv[0][0] * dstY[0] + inv[0][1] * dstY[1] + inv[0][2] * dstY[2];
  const d = inv[1][0] * dstY[0] + inv[1][1] * dstY[1] + inv[1][2] * dstY[2];
  const ty = inv[2][0] * dstY[0] + inv[2][1] * dstY[1] + inv[2][2] * dstY[2];

  return { a, b, c, d, tx, ty };
}

const defaultFilters: AppFilters = {
  storeId: null,
  floor: 1,
  startDate: '2025-11-01',
  endDate: '2025-11-30',
  startHour: 0,
  endHour: 23,
  viewMode: 'tracks',
  minDwellSeconds: 30,
  scaleSettings: {
    auto: true,
    min: 0,
    max: 1000,
  },
  floorPlanAdjustment: {
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    scale: 1.0,
    scaleX: 1.0,
    scaleY: 1.0,
    lockAspectRatio: true,
  },
};

export default function App() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<AppFilters>(defaultFilters);
  const [selectedZone, setSelectedZone] = useState<Zone | null>(null);
  const [isDrawingZone, setIsDrawingZone] = useState(false);
  const [showFloorPlanUpload, setShowFloorPlanUpload] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('tracks');

  // Separate scale settings for tracks and dwell panels
  const [tracksScaleSettings, setTracksScaleSettings] = useState<ScaleSettings>({
    auto: true,
    min: 0,
    max: 1000,
  });
  const [dwellScaleSettings, setDwellScaleSettings] = useState<ScaleSettings>({
    auto: true,
    min: 30,
    max: 3600,
  });

  // Calibration state
  const [calibration, setCalibration] = useState<CalibrationState>({
    isCalibrating: false,
    step: 'heatmap',
    heatmapPoints: [],
    floorplanPoints: [],
  });

  // Data fetching
  const { data: stores } = useStores();
  const { data: floorPlans } = useFloorPlans(filters.storeId);
  const { data: zones, refetch: refetchZones } = useZones(filters.storeId, filters.floor);
  const deleteZoneMutation = useDeleteZone();

  const currentFloorPlan = floorPlans?.find((fp) => fp.floor === filters.floor);

  // Track the last loaded floor plan ID
  const lastLoadedFloorPlanId = useRef<number | null>(null);

  // Refs for PDF export
  const tracksPanelRef = useRef<HTMLDivElement>(null);
  const dwellPanelRef = useRef<HTMLDivElement>(null);
  const insightsPanelRef = useRef<HTMLDivElement>(null);

  // Auto-load adjustments from floor plan
  useEffect(() => {
    if (currentFloorPlan && currentFloorPlan.id !== lastLoadedFloorPlanId.current) {
      lastLoadedFloorPlanId.current = currentFloorPlan.id;
      const scale = currentFloorPlan.adjust_scale ?? 1.0;
      const hasAffine = currentFloorPlan.affine_a != null;
      const scaleX = currentFloorPlan.adjust_scale_x ?? scale;
      const scaleY = currentFloorPlan.adjust_scale_y ?? scale;
      console.log('Loading floor plan calibration:', {
        id: currentFloorPlan.id,
        floor: currentFloorPlan.floor,
        offsetX: currentFloorPlan.adjust_offset_x,
        offsetY: currentFloorPlan.adjust_offset_y,
        scaleX,
        scaleY,
        rotation: currentFloorPlan.adjust_rotation,
        hasAffine
      });
      setFilters((prev) => ({
        ...prev,
        floorPlanAdjustment: {
          offsetX: currentFloorPlan.adjust_offset_x ?? 0,
          offsetY: currentFloorPlan.adjust_offset_y ?? 0,
          scale: scale,
          scaleX: scaleX,
          scaleY: scaleY,
          rotation: currentFloorPlan.adjust_rotation ?? 0,
          lockAspectRatio: scaleX === scaleY,
          useAffine: hasAffine,
          affine: hasAffine ? {
            a: currentFloorPlan.affine_a!,
            b: currentFloorPlan.affine_b!,
            c: currentFloorPlan.affine_c!,
            d: currentFloorPlan.affine_d!,
            tx: currentFloorPlan.affine_tx!,
            ty: currentFloorPlan.affine_ty!,
          } : undefined,
        },
      }));
    }
  }, [currentFloorPlan]);

  // Debounced auto-save
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSavingAdjustment, setIsSavingAdjustment] = useState(false);

  const saveAdjustments = useCallback(async () => {
    if (!currentFloorPlan || !filters.storeId) return;

    setIsSavingAdjustment(true);
    try {
      const affine = filters.floorPlanAdjustment.affine;
      await adjustFloorPlan(currentFloorPlan.id, {
        adjust_offset_x: filters.floorPlanAdjustment.offsetX,
        adjust_offset_y: filters.floorPlanAdjustment.offsetY,
        adjust_scale: filters.floorPlanAdjustment.scale,
        adjust_scale_x: filters.floorPlanAdjustment.scaleX,
        adjust_scale_y: filters.floorPlanAdjustment.scaleY,
        adjust_rotation: filters.floorPlanAdjustment.rotation,
        affine_a: affine?.a ?? null,
        affine_b: affine?.b ?? null,
        affine_c: affine?.c ?? null,
        affine_d: affine?.d ?? null,
        affine_tx: affine?.tx ?? null,
        affine_ty: affine?.ty ?? null,
      });

      queryClient.setQueryData(['floorPlans', filters.storeId], (oldData: typeof floorPlans) => {
        if (!oldData) return oldData;
        return oldData.map(fp => {
          if (fp.id === currentFloorPlan.id) {
            return {
              ...fp,
              adjust_offset_x: filters.floorPlanAdjustment.offsetX,
              adjust_offset_y: filters.floorPlanAdjustment.offsetY,
              adjust_scale: filters.floorPlanAdjustment.scale,
              adjust_scale_x: filters.floorPlanAdjustment.scaleX,
              adjust_scale_y: filters.floorPlanAdjustment.scaleY,
              adjust_rotation: filters.floorPlanAdjustment.rotation,
              affine_a: affine?.a ?? null,
              affine_b: affine?.b ?? null,
              affine_c: affine?.c ?? null,
              affine_d: affine?.d ?? null,
              affine_tx: affine?.tx ?? null,
              affine_ty: affine?.ty ?? null,
            };
          }
          return fp;
        });
      });
    } catch {
      toast.error('Failed to save adjustments');
    } finally {
      setIsSavingAdjustment(false);
    }
  }, [currentFloorPlan, filters.floorPlanAdjustment, filters.storeId, queryClient]);

  const handleLockCalibration = useCallback(async () => {
    if (!currentFloorPlan || !filters.storeId) return;
    setIsSavingAdjustment(true);
    try {
      const affine = filters.floorPlanAdjustment.affine;
      console.log('Saving calibration:', {
        offsetX: filters.floorPlanAdjustment.offsetX,
        offsetY: filters.floorPlanAdjustment.offsetY,
        scaleX: filters.floorPlanAdjustment.scaleX,
        scaleY: filters.floorPlanAdjustment.scaleY,
        rotation: filters.floorPlanAdjustment.rotation,
        affine
      });
      await adjustFloorPlan(currentFloorPlan.id, {
        adjust_offset_x: filters.floorPlanAdjustment.offsetX,
        adjust_offset_y: filters.floorPlanAdjustment.offsetY,
        adjust_scale: filters.floorPlanAdjustment.scale,
        adjust_scale_x: filters.floorPlanAdjustment.scaleX,
        adjust_scale_y: filters.floorPlanAdjustment.scaleY,
        adjust_rotation: filters.floorPlanAdjustment.rotation,
        affine_a: affine?.a ?? null,
        affine_b: affine?.b ?? null,
        affine_c: affine?.c ?? null,
        affine_d: affine?.d ?? null,
        affine_tx: affine?.tx ?? null,
        affine_ty: affine?.ty ?? null,
      });

      queryClient.setQueryData(['floorPlans', filters.storeId], (oldData: typeof floorPlans) => {
        if (!oldData) return oldData;
        return oldData.map(fp => {
          if (fp.id === currentFloorPlan.id) {
            return {
              ...fp,
              adjust_offset_x: filters.floorPlanAdjustment.offsetX,
              adjust_offset_y: filters.floorPlanAdjustment.offsetY,
              adjust_scale: filters.floorPlanAdjustment.scale,
              adjust_scale_x: filters.floorPlanAdjustment.scaleX,
              adjust_scale_y: filters.floorPlanAdjustment.scaleY,
              adjust_rotation: filters.floorPlanAdjustment.rotation,
              affine_a: affine?.a ?? null,
              affine_b: affine?.b ?? null,
              affine_c: affine?.c ?? null,
              affine_d: affine?.d ?? null,
              affine_tx: affine?.tx ?? null,
              affine_ty: affine?.ty ?? null,
            };
          }
          return fp;
        });
      });

      toast.success('Calibration locked and saved to database!');
    } catch (err) {
      console.error('Failed to save calibration:', err);
      toast.error('Failed to save calibration');
    } finally {
      setIsSavingAdjustment(false);
    }
  }, [currentFloorPlan, filters.floorPlanAdjustment, filters.storeId, queryClient]);

  // Auto-save adjustments after 1 second of no changes
  useEffect(() => {
    if (!currentFloorPlan) return;

    const affine = filters.floorPlanAdjustment.affine;
    const isDifferent =
      filters.floorPlanAdjustment.offsetX !== (currentFloorPlan.adjust_offset_x ?? 0) ||
      filters.floorPlanAdjustment.offsetY !== (currentFloorPlan.adjust_offset_y ?? 0) ||
      filters.floorPlanAdjustment.scale !== (currentFloorPlan.adjust_scale ?? 1.0) ||
      filters.floorPlanAdjustment.scaleX !== (currentFloorPlan.adjust_scale_x ?? 1.0) ||
      filters.floorPlanAdjustment.scaleY !== (currentFloorPlan.adjust_scale_y ?? 1.0) ||
      filters.floorPlanAdjustment.rotation !== (currentFloorPlan.adjust_rotation ?? 0) ||
      (affine?.a ?? null) !== (currentFloorPlan.affine_a ?? null) ||
      (affine?.b ?? null) !== (currentFloorPlan.affine_b ?? null) ||
      (affine?.c ?? null) !== (currentFloorPlan.affine_c ?? null) ||
      (affine?.d ?? null) !== (currentFloorPlan.affine_d ?? null) ||
      (affine?.tx ?? null) !== (currentFloorPlan.affine_tx ?? null) ||
      (affine?.ty ?? null) !== (currentFloorPlan.affine_ty ?? null);

    if (!isDifferent) return;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveAdjustments();
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [filters.floorPlanAdjustment, currentFloorPlan, saveAdjustments]);

  // Heatmap data for both views
  const tracksFilters = filters.storeId
    ? {
        store_id: filters.storeId,
        floor: filters.floor,
        start_date: filters.startDate,
        end_date: filters.endDate,
        start_hour: filters.startHour,
        end_hour: filters.endHour,
        min_dwell_seconds: filters.minDwellSeconds,
      }
    : null;

  const { data: tracksData, isLoading: tracksLoading } = useHeatmapData(tracksFilters, 'tracks');
  const { data: dwellData, isLoading: dwellLoading } = useHeatmapData(tracksFilters, 'dwell');

  const { data: zoneStats } = useZoneStats(
    filters.storeId,
    zones || [],
    filters.startDate,
    filters.endDate,
    filters.startHour,
    filters.endHour,
    true  // include dwell data
  );

  // Handlers
  const handleFilterChange = useCallback((key: keyof AppFilters, value: unknown) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleZoneCreated = useCallback(() => {
    refetchZones();
    setIsDrawingZone(false);
  }, [refetchZones]);

  const handleToggleDrawZone = useCallback(() => {
    setIsDrawingZone((prev) => !prev);
  }, []);

  const handleDeleteZone = useCallback(async (zoneId: number) => {
    try {
      await deleteZoneMutation.mutateAsync({ zoneId, storeId: filters.storeId! });
      toast.success('Zone deleted');
      refetchZones();
      if (selectedZone?.id === zoneId) {
        setSelectedZone(null);
      }
    } catch {
      toast.error('Failed to delete zone');
    }
  }, [deleteZoneMutation, refetchZones, selectedZone, filters.storeId]);

  const handleFloorPlanUploaded = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['floorPlans', filters.storeId] });
    setShowFloorPlanUpload(false);
  }, [queryClient, filters.storeId]);

  const handleTracksDataRangeChange = useCallback((min: number, max: number) => {
    setTracksScaleSettings((prev) => {
      if (prev.auto && (prev.min !== min || prev.max !== max)) {
        return { ...prev, min, max };
      }
      return prev;
    });
  }, []);

  const handleDwellDataRangeChange = useCallback((min: number, max: number) => {
    setDwellScaleSettings((prev) => {
      if (prev.auto && (prev.min !== min || prev.max !== max)) {
        return { ...prev, min, max };
      }
      return prev;
    });
  }, []);

  // Calibration handlers
  const handleStartCalibration = useCallback(() => {
    handleFilterChange('floorPlanAdjustment', {
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
    setCalibration({
      isCalibrating: true,
      step: 'heatmap',
      heatmapPoints: [],
      floorplanPoints: [],
    });
    setIsDrawingZone(false);
    toast.success('Starting calibration. Click 3 points on the HEATMAP (red hot spots).');
  }, [handleFilterChange]);

  const handleCancelCalibration = useCallback(() => {
    setCalibration({
      isCalibrating: false,
      step: 'heatmap',
      heatmapPoints: [],
      floorplanPoints: [],
    });
    toast('Calibration cancelled');
  }, []);

  const handleCalibrationPointClick = useCallback((point: CalibrationPoint) => {
    setCalibration((prev) => {
      if (prev.step === 'heatmap') {
        const newPoints = [...prev.heatmapPoints, point];
        if (newPoints.length >= 3) {
          toast.success('Now click the same 3 points on the floor plan.');
          return { ...prev, heatmapPoints: newPoints, step: 'floorplan' };
        }
        toast(`Heatmap point ${newPoints.length}/3 captured`);
        return { ...prev, heatmapPoints: newPoints };
      } else {
        const newPoints = [...prev.floorplanPoints, point];
        if (newPoints.length >= 3) {
          return { ...prev, floorplanPoints: newPoints };
        }
        toast(`Floor plan point ${newPoints.length}/3 captured`);
        return { ...prev, floorplanPoints: newPoints };
      }
    });
  }, []);

  // Download PDF with both heatmaps
  const handleDownloadReport = useCallback(async () => {
    if (!tracksPanelRef.current || !dwellPanelRef.current) {
      toast.error('Heatmap panels not ready');
      return;
    }

    const loadingToast = toast.loading('Generating PDF report...');

    try {
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 10;

      // Capture Tracks heatmap
      const tracksCanvas = await html2canvas(tracksPanelRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      const tracksImg = tracksCanvas.toDataURL('image/png');

      // Add Tracks page
      const imgRatio = tracksCanvas.width / tracksCanvas.height;
      const maxWidth = pageWidth - margin * 2;
      const maxHeight = pageHeight - margin * 2 - 15;
      let imgWidth = maxWidth;
      let imgHeight = imgWidth / imgRatio;
      if (imgHeight > maxHeight) {
        imgHeight = maxHeight;
        imgWidth = imgHeight * imgRatio;
      }

      pdf.setFontSize(16);
      pdf.text('Track Density Heatmap', margin, margin + 5);
      pdf.setFontSize(10);
      pdf.text(`Store ${filters.storeId} | ${filters.startDate} to ${filters.endDate}`, margin, margin + 12);
      pdf.addImage(tracksImg, 'PNG', margin, margin + 15, imgWidth, imgHeight);

      // Add new page for Dwell
      pdf.addPage();

      // Capture Dwell heatmap
      const dwellCanvas = await html2canvas(dwellPanelRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });
      const dwellImg = dwellCanvas.toDataURL('image/png');

      pdf.setFontSize(16);
      pdf.text('Dwell Time Heatmap', margin, margin + 5);
      pdf.setFontSize(10);
      pdf.text(`Store ${filters.storeId} | ${filters.startDate} to ${filters.endDate}`, margin, margin + 12);
      pdf.addImage(dwellImg, 'PNG', margin, margin + 15, imgWidth, imgHeight);

      // Add Insights page if available
      if (insightsPanelRef.current) {
        pdf.addPage();

        const insightsCanvas = await html2canvas(insightsPanelRef.current, {
          scale: 2,
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff',
        });
        const insightsImg = insightsCanvas.toDataURL('image/png');

        const insightsRatio = insightsCanvas.width / insightsCanvas.height;
        let insightsWidth = maxWidth;
        let insightsHeight = insightsWidth / insightsRatio;
        if (insightsHeight > maxHeight) {
          insightsHeight = maxHeight;
          insightsWidth = insightsHeight * insightsRatio;
        }

        pdf.setFontSize(16);
        pdf.text('AI Insights & Analysis', margin, margin + 5);
        pdf.setFontSize(10);
        pdf.text(`Store ${filters.storeId} | ${filters.startDate} to ${filters.endDate}`, margin, margin + 12);
        pdf.addImage(insightsImg, 'PNG', margin, margin + 15, insightsWidth, insightsHeight);
      }

      // Save PDF
      const filename = `heatmap_report_store${filters.storeId}_${filters.startDate}_${filters.endDate}.pdf`;
      pdf.save(filename);

      toast.dismiss(loadingToast);
      toast.success('PDF report downloaded!');
    } catch (err) {
      console.error('Failed to generate PDF:', err);
      toast.dismiss(loadingToast);
      toast.error('Failed to generate PDF report');
    }
  }, [filters.storeId, filters.startDate, filters.endDate]);

  // Compute calibration when complete
  useEffect(() => {
    if (
      calibration.isCalibrating &&
      calibration.heatmapPoints.length === 3 &&
      calibration.floorplanPoints.length === 3
    ) {
      const affine = solveAffineTransform(
        calibration.heatmapPoints,
        calibration.floorplanPoints
      );

      if (!affine) {
        toast.error('Calibration failed: points may be collinear. Try different points.');
        setCalibration({
          isCalibrating: false,
          step: 'heatmap',
          heatmapPoints: [],
          floorplanPoints: [],
        });
        return;
      }

      handleFilterChange('floorPlanAdjustment', {
        ...filters.floorPlanAdjustment,
        useAffine: true,
        affine: affine,
        offsetX: 0,
        offsetY: 0,
        rotation: 0,
        scale: 1.0,
        scaleX: 1.0,
        scaleY: 1.0,
        lockAspectRatio: true,
      });

      toast.success('Affine calibration applied! The heatmap should now align precisely.');
      setCalibration({
        isCalibrating: false,
        step: 'heatmap',
        heatmapPoints: [],
        floorplanPoints: [],
      });
    }
  }, [calibration, filters.floorPlanAdjustment, handleFilterChange]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar
        currentFloorPlan={currentFloorPlan}
        floorPlanAdjustment={filters.floorPlanAdjustment}
        calibration={calibration}
        isSavingAdjustment={isSavingAdjustment}
        zones={zones || []}
        zoneStats={zoneStats || []}
        selectedZone={selectedZone}
        isDrawingZone={isDrawingZone}
        onFloorPlanAdjustmentChange={(adj) => handleFilterChange('floorPlanAdjustment', adj)}
        onStartCalibration={handleStartCalibration}
        onCancelCalibration={handleCancelCalibration}
        onLockCalibration={handleLockCalibration}
        onShowFloorPlanUpload={() => setShowFloorPlanUpload(true)}
        onSelectZone={setSelectedZone}
        onToggleDrawZone={handleToggleDrawZone}
        onDeleteZone={handleDeleteZone}
      />

      {/* Main Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* Header with filters */}
        <ReportingHeader
          stores={stores || []}
          selectedStoreId={filters.storeId}
          selectedFloor={filters.floor}
          availableFloors={floorPlans?.map(fp => fp.floor).sort((a, b) => a - b) || []}
          startDate={filters.startDate}
          endDate={filters.endDate}
          startHour={filters.startHour}
          endHour={filters.endHour}
          onStoreChange={(id) => handleFilterChange('storeId', id)}
          onFloorChange={(f) => handleFilterChange('floor', f)}
          onStartDateChange={(d) => handleFilterChange('startDate', d)}
          onEndDateChange={(d) => handleFilterChange('endDate', d)}
          onStartHourChange={(h) => handleFilterChange('startHour', h)}
          onEndHourChange={(h) => handleFilterChange('endHour', h)}
          onDownloadReport={handleDownloadReport}
        />

        {/* Heatmap + AI Insights Side by Side */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Heatmap Panel with Toggle */}
          <div ref={viewMode === 'tracks' ? tracksPanelRef : dwellPanelRef}>
            <HeatmapPanel
              title={viewMode === 'tracks' ? 'Tracks' : 'Dwell Time'}
              viewMode={viewMode}
              heatmapData={viewMode === 'tracks' ? tracksData : dwellData}
              floorPlan={currentFloorPlan}
              zones={zones || []}
              zoneStats={zoneStats || []}
              selectedZone={selectedZone}
              isDrawingZone={isDrawingZone}
              storeId={filters.storeId || 0}
              floor={filters.floor}
              scaleSettings={viewMode === 'tracks' ? tracksScaleSettings : dwellScaleSettings}
              floorPlanAdjustment={filters.floorPlanAdjustment}
              calibration={calibration}
              isLoading={viewMode === 'tracks' ? tracksLoading : dwellLoading}
              onZoneCreated={handleZoneCreated}
              onSelectZone={setSelectedZone}
              onDataRangeChange={viewMode === 'tracks' ? handleTracksDataRangeChange : handleDwellDataRangeChange}
              onCalibrationClick={handleCalibrationPointClick}
              onScaleSettingsChange={viewMode === 'tracks' ? setTracksScaleSettings : setDwellScaleSettings}
              onViewModeChange={setViewMode}
            />
          </div>

          {/* AI Insights Panel */}
          {filters.storeId && (
            <div ref={insightsPanelRef}>
              <InsightsPanel
                viewMode={viewMode}
                storeId={filters.storeId}
                floor={filters.floor}
                startDate={filters.startDate}
                endDate={filters.endDate}
                startHour={filters.startHour}
                endHour={filters.endHour}
                heatmapData={viewMode === 'tracks' ? tracksData : dwellData}
                zonesCount={zones?.length || 0}
              />
            </div>
          )}
        </div>
      </div>

      {/* Floor Plan Upload Modal */}
      {showFloorPlanUpload && filters.storeId && (
        <FloorPlanUpload
          storeId={filters.storeId}
          floor={filters.floor}
          dataBounds={tracksData?.bounds}
          onClose={() => setShowFloorPlanUpload(false)}
          onUploaded={handleFloorPlanUploaded}
        />
      )}
    </div>
  );
}
