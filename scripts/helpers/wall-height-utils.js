export function isWallHeightActive() {
  return !!game.modules?.get('wall-height')?.active;
}

export function getWallElevationBounds(wallDocument) {
  if (!isWallHeightActive()) {
    return null;
  }

  try {
    const flagData = wallDocument.flags?.['wall-height'];
    if (flagData && typeof flagData.top === 'number' && typeof flagData.bottom === 'number') {
      const bottom = Number(flagData.bottom);
      const top = Number(flagData.top);
      
      if (Number.isFinite(bottom) && Number.isFinite(top)) {
        return { bottom, top };
      }
    }
    
    const bounds = window.WallHeight?.getSourceElevationBounds?.(wallDocument);
    
    if (!bounds) {
      return null;
    }

    const bottom = Number(bounds.bottom);
    const top = Number(bounds.top);

    if (!Number.isFinite(bottom) || !Number.isFinite(top)) {
      return null;
    }

    return { bottom, top };
  } catch (error) {
    return null;
  }
}

export function doesWallBlockAtElevation(wallDocument, elevationRange) {
  const wallBounds = getWallElevationBounds(wallDocument);

  if (!wallBounds) {
    return true;
  }

  const wallBottom = wallBounds.bottom;
  const wallTop = wallBounds.top;

  const rangeBottom =
    typeof elevationRange === 'object' ? elevationRange.bottom : elevationRange;
  const rangeTop = typeof elevationRange === 'object' ? elevationRange.top : elevationRange;

  if (rangeBottom >= wallTop) {
    return false;
  }

  if (rangeTop <= wallBottom) {
    return false;
  }

  return true;
}

const ATTACKER_HEIGHT_SAMPLES = 5;

function spanSampleHeights(span) {
  const height = span.top - span.bottom;
  if (!(height > 0)) return [span.bottom];
  return Array.from(
    { length: ATTACKER_HEIGHT_SAMPLES },
    (_, i) => span.bottom + (height * (i + 0.5)) / ATTACKER_HEIGHT_SAMPLES,
  );
}

function blockedTargetInterval(bounds, eyeZ, t) {
  if (!(t > 0)) {
    return eyeZ >= bounds.bottom && eyeZ < bounds.top ? [-Infinity, Infinity] : null;
  }
  return [eyeZ + (bounds.bottom - eyeZ) / t, eyeZ + (bounds.top - eyeZ) / t];
}

function clippedIntervals(intervals, span) {
  return intervals
    .filter(Boolean)
    .map(([lo, hi]) => [Math.max(lo, span.bottom), Math.min(hi, span.top)])
    .filter(([lo, hi]) => hi > lo)
    .sort((a, b) => a[0] - b[0]);
}

function mergedLength(intervals) {
  let total = 0;
  let end = -Infinity;
  for (const [lo, hi] of intervals) {
    const start = Math.max(lo, end);
    if (hi > start) total += hi - start;
    end = Math.max(end, hi);
  }
  return total;
}

function pointBlockedFraction(intervals, z) {
  return intervals.some((interval) => interval && z >= interval[0] && z < interval[1]) ? 1 : 0;
}

function targetBlockedFraction(hits, eyeZ, targetSpan) {
  const intervals = hits.map(({ bounds, t }) => blockedTargetInterval(bounds, eyeZ, t));
  const height = targetSpan.top - targetSpan.bottom;
  if (!(height > 0)) return pointBlockedFraction(intervals, targetSpan.bottom);
  return mergedLength(clippedIntervals(intervals, targetSpan)) / height;
}

export function getWallsVerticalBlockedFraction(wallHits, attackerSpan, targetSpan) {
  if (!wallHits?.length) return 0;
  const hits = wallHits.map(({ wallDocument, t }) => ({
    bounds: getWallElevationBounds(wallDocument),
    t,
  }));
  if (hits.some(({ bounds }) => !bounds)) return 1;
  const eyes = spanSampleHeights(attackerSpan);
  const sum = eyes.reduce((acc, eyeZ) => acc + targetBlockedFraction(hits, eyeZ, targetSpan), 0);
  return sum / eyes.length;
}

export function doesWallBlockLineOfSight(wallDocument, attackerSpan, targetSpan, t) {
  const wallBounds = getWallElevationBounds(wallDocument);

  if (!wallBounds) {
    return true;
  }

  const attackerMid = (attackerSpan.bottom + attackerSpan.top) / 2;
  const targetMid = (targetSpan.bottom + targetSpan.top) / 2;
  const sightZ = attackerMid + t * (targetMid - attackerMid);

  if (sightZ >= wallBounds.top) {
    return false;
  }
  if (sightZ < wallBounds.bottom) {
    return false;
  }

  return true;
}
