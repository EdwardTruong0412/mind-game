/**
 * Fisher-Yates shuffle algorithm for true randomness
 */
export function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Generate a shuffled grid of numbers
 */
export function generateGrid(size: number): number[] {
  const totalCells = size * size;
  const numbers = Array.from({ length: totalCells }, (_, i) => i + 1);
  return shuffleArray(numbers);
}

/**
 * Get the starting target based on order mode
 */
export function getStartingTarget(gridSize: number, orderMode: 'ASC' | 'DESC'): number {
  return orderMode === 'ASC' ? 1 : gridSize * gridSize;
}

/**
 * Get the next target after a correct tap
 */
export function getNextTarget(current: number, orderMode: 'ASC' | 'DESC'): number {
  return orderMode === 'ASC' ? current + 1 : current - 1;
}

/**
 * Check if the game is complete
 */
export function isGameComplete(
  currentTarget: number,
  gridSize: number,
  orderMode: 'ASC' | 'DESC'
): boolean {
  const totalCells = gridSize * gridSize;
  if (orderMode === 'ASC') {
    return currentTarget > totalCells;
  }
  return currentTarget < 1;
}

/**
 * Calculate accuracy percentage
 */
export function calculateAccuracy(totalCells: number, mistakes: number): number {
  if (mistakes === 0) return 100;
  const correctTaps = totalCells;
  const totalTaps = correctTaps + mistakes;
  return Math.round((correctTaps / totalTaps) * 100);
}

/**
 * Format time in milliseconds to display string
 */
export function formatTime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const centiseconds = Math.floor((ms % 1000) / 10);

  if (minutes > 0) {
    return `${minutes}:${seconds.toString().padStart(2, '0')}.${centiseconds.toString().padStart(2, '0')}`;
  }
  return `${seconds}.${centiseconds.toString().padStart(2, '0')}`;
}

/**
 * Format time for display in history (shorter format)
 */
export function formatTimeShort(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Get grid cell size based on grid size and viewport
 */
export function getGridCellSize(gridSize: number, containerSize: number): number {
  const gap = 4; // gap between cells in pixels
  const totalGap = gap * (gridSize - 1);
  const availableSize = containerSize - totalGap;
  return Math.floor(availableSize / gridSize);
}

/**
 * Check if a value is the center cell (for fixation dot)
 */
export function isCenterCell(index: number, gridSize: number): boolean {
  // Only odd-sized grids have a true center
  if (gridSize % 2 === 0) return false;
  const center = Math.floor((gridSize * gridSize) / 2);
  return index === center;
}

/**
 * Trigger haptic feedback if available
 */
export function triggerHaptic(type: 'success' | 'error' | 'light' = 'light'): void {
  if (typeof navigator === 'undefined' || !navigator.vibrate) return;

  switch (type) {
    case 'success':
      navigator.vibrate([10, 50, 10]);
      break;
    case 'error':
      navigator.vibrate(100);
      break;
    case 'light':
    default:
      navigator.vibrate(10);
      break;
  }
}
