/**
 * Leaderboard Filters Component
 * Filters for grid size, order mode, and date
 */

'use client';

import { cn } from '@/lib/utils';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface LeaderboardFiltersProps {
  gridSize: number;
  orderMode: 'ASC' | 'DESC';
  selectedDate?: Date;
  onGridSizeChange: (size: number) => void;
  onOrderModeChange: (mode: 'ASC' | 'DESC') => void;
  onDateChange?: (date: Date) => void;
  showDatePicker?: boolean;
  language: 'en' | 'vi';
}

const GRID_SIZES = [4, 5, 6, 7, 8, 9, 10];

export function LeaderboardFilters({
  gridSize,
  orderMode,
  selectedDate,
  onGridSizeChange,
  onOrderModeChange,
  onDateChange,
  showDatePicker = false,
  language,
}: LeaderboardFiltersProps) {
  const currentGridIndex = GRID_SIZES.indexOf(gridSize);
  const canGoSmaller = currentGridIndex > 0;
  const canGoLarger = currentGridIndex < GRID_SIZES.length - 1;

  const handlePrevDay = () => {
    if (selectedDate && onDateChange) {
      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() - 1);
      onDateChange(newDate);
    }
  };

  const handleNextDay = () => {
    if (selectedDate && onDateChange) {
      const newDate = new Date(selectedDate);
      newDate.setDate(newDate.getDate() + 1);
      // Don't allow future dates
      if (newDate <= new Date()) {
        onDateChange(newDate);
      }
    }
  };

  const isToday = selectedDate && selectedDate.toDateString() === new Date().toDateString();

  return (
    <div className="space-y-4">
      {/* Date picker (for daily leaderboard) */}
      {showDatePicker && selectedDate && onDateChange && (
        <div className="flex items-center justify-center gap-4 bg-gray-100 dark:bg-gray-800 rounded-lg p-4">
          <button
            onClick={handlePrevDay}
            className="p-2 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-center min-w-[140px]">
            <div className="font-medium">
              {isToday
                ? language === 'vi'
                  ? 'Hôm nay'
                  : 'Today'
                : selectedDate.toLocaleDateString(language === 'vi' ? 'vi-VN' : 'en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
            </div>
          </div>
          <button
            onClick={handleNextDay}
            disabled={isToday}
            className={cn(
              'p-2 rounded-lg transition-colors',
              isToday
                ? 'opacity-30 cursor-not-allowed'
                : 'hover:bg-gray-200 dark:hover:bg-gray-700'
            )}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Grid size selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {language === 'vi' ? 'Kích thước' : 'Grid Size'}
        </label>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => onGridSizeChange(GRID_SIZES[currentGridIndex - 1])}
            disabled={!canGoSmaller}
            className={cn(
              'p-2 rounded-lg transition-all',
              canGoSmaller
                ? 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                : 'opacity-30 cursor-not-allowed'
            )}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <div className="text-center min-w-[100px]">
            <div className="text-2xl font-bold">
              {gridSize}×{gridSize}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {gridSize * gridSize} {language === 'vi' ? 'ô' : 'cells'}
            </div>
          </div>
          <button
            onClick={() => onGridSizeChange(GRID_SIZES[currentGridIndex + 1])}
            disabled={!canGoLarger}
            className={cn(
              'p-2 rounded-lg transition-all',
              canGoLarger
                ? 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                : 'opacity-30 cursor-not-allowed'
            )}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Order mode selector */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {language === 'vi' ? 'Thứ tự' : 'Order'}
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => onOrderModeChange('ASC')}
            className={cn(
              'flex-1 py-3 rounded-lg font-medium transition-all',
              orderMode === 'ASC'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
          >
            1 → {gridSize * gridSize}
          </button>
          <button
            onClick={() => onOrderModeChange('DESC')}
            className={cn(
              'flex-1 py-3 rounded-lg font-medium transition-all',
              orderMode === 'DESC'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            )}
          >
            {gridSize * gridSize} → 1
          </button>
        </div>
      </div>
    </div>
  );
}
