import { useCallback } from 'react';
import type Konva from 'konva';

const ZOOM_STEP = 1.08;
const MIN_SCALE = 0.1;
const MAX_SCALE = 5.0;

// Zoom in/out centered on the cursor, like Figma/Miro — reads/writes the
// stage's scale and position imperatively via the ref rather than React
// state, so panning/zooming doesn't need a re-render on every wheel tick.
export function useCanvasZoom(stageRef: React.RefObject<Konva.Stage | null>) {
  const handleWheel = useCallback(
    (e: Konva.KonvaEventObject<WheelEvent>) => {
      e.evt.preventDefault();
      const stage = stageRef.current;
      const pointer = stage?.getPointerPosition();
      if (!stage || !pointer) return;

      const oldScale = stage.scaleX();
      const mousePointTo = {
        x: (pointer.x - stage.x()) / oldScale,
        y: (pointer.y - stage.y()) / oldScale,
      };

      const direction = e.evt.deltaY < 0 ? 1 : -1;
      const newScale = direction > 0 ? oldScale * ZOOM_STEP : oldScale / ZOOM_STEP;
      const clampedScale = Math.min(Math.max(newScale, MIN_SCALE), MAX_SCALE);

      stage.scale({ x: clampedScale, y: clampedScale });
      stage.position({
        x: pointer.x - mousePointTo.x * clampedScale,
        y: pointer.y - mousePointTo.y * clampedScale,
      });
      stage.batchDraw();
    },
    [stageRef]
  );

  return { handleWheel };
}
