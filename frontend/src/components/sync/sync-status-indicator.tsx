/**
 * Sync Status Indicator
 * Shows cloud icon with sync status
 */

import { Cloud, CloudOff, CloudUpload, AlertCircle } from 'lucide-react';
import type { SyncStatus } from '@/types';
import { cn } from '@/lib/utils';

interface SyncStatusIndicatorProps {
  status: SyncStatus;
  className?: string;
  showLabel?: boolean;
}

export function SyncStatusIndicator({ status, className, showLabel = false }: SyncStatusIndicatorProps) {
  const getIcon = () => {
    switch (status) {
      case 'synced':
        return <Cloud className="w-4 h-4 text-green-500" />;
      case 'syncing':
        return <CloudUpload className="w-4 h-4 text-blue-500 animate-pulse" />;
      case 'sync-failed':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'local-only':
      default:
        return <CloudOff className="w-4 h-4 text-gray-400" />;
    }
  };

  const getLabel = () => {
    switch (status) {
      case 'synced':
        return 'Synced';
      case 'syncing':
        return 'Syncing...';
      case 'sync-failed':
        return 'Sync failed';
      case 'local-only':
      default:
        return 'Local only';
    }
  };

  const getBackgroundColor = () => {
    switch (status) {
      case 'synced':
        return 'bg-green-50 dark:bg-green-900/20';
      case 'syncing':
        return 'bg-blue-50 dark:bg-blue-900/20';
      case 'sync-failed':
        return 'bg-red-50 dark:bg-red-900/20';
      case 'local-only':
      default:
        return 'bg-gray-50 dark:bg-gray-800';
    }
  };

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-1 rounded-full',
        getBackgroundColor(),
        className
      )}
      title={getLabel()}
    >
      {getIcon()}
      {showLabel && <span className="text-xs font-medium">{getLabel()}</span>}
    </div>
  );
}
