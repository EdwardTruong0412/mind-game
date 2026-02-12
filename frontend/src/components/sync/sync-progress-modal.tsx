/**
 * Sync Progress Modal
 * Shows sync progress and failures
 */

'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useSync } from '@/hooks/use-sync';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface SyncProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export function SyncProgressModal({ isOpen, onClose, onComplete }: SyncProgressModalProps) {
  const { isSyncing, bulkSync } = useSync();
  const [syncResult, setSyncResult] = useState<{
    syncedCount: number;
    failedCount: number;
    errors: Array<{ sessionId: string; error: string }>;
  } | null>(null);

  useEffect(() => {
    if (isOpen && !syncResult) {
      handleSync();
    }
  }, [isOpen]);

  const handleSync = async () => {
    try {
      const result = await bulkSync();
      setSyncResult(result);

      if (result.success && onComplete) {
        onComplete();
      }
    } catch (error) {
      console.error('Sync failed:', error);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 m-4">
        <h2 className="text-xl font-bold mb-4">
          {isSyncing ? 'Syncing Sessions...' : 'Sync Complete'}
        </h2>

        {isSyncing ? (
          <div className="flex flex-col items-center justify-center py-8 space-y-4">
            <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
            <p className="text-gray-600 dark:text-gray-400">
              Uploading your training sessions to the cloud...
            </p>
          </div>
        ) : syncResult ? (
          <div className="space-y-4">
            {syncResult.syncedCount > 0 && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20">
                <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                <p className="text-sm text-green-700 dark:text-green-300">
                  {syncResult.syncedCount} session{syncResult.syncedCount !== 1 ? 's' : ''} synced successfully
                </p>
              </div>
            )}

            {syncResult.failedCount > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20">
                  <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-700 dark:text-red-300">
                    {syncResult.failedCount} session{syncResult.failedCount !== 1 ? 's' : ''} failed to sync
                  </p>
                </div>
                {syncResult.errors.length > 0 && (
                  <div className="max-h-32 overflow-y-auto space-y-1">
                    {syncResult.errors.map((error, index) => (
                      <div
                        key={index}
                        className="text-xs text-red-600 dark:text-red-400 p-2 bg-red-50 dark:bg-red-900/10 rounded"
                      >
                        {error.error}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {syncResult.syncedCount === 0 && syncResult.failedCount === 0 && (
              <p className="text-gray-600 dark:text-gray-400 text-center py-4">
                All sessions are already synced
              </p>
            )}

            <Button className="w-full" onClick={onClose}>
              Close
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
