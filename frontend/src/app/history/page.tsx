'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Trash2, Clock, Target, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getRecentSessions, deleteSession } from '@/lib/db';
import { formatTime, formatTimeShort } from '@/lib/game-logic';
import { cn } from '@/lib/utils';
import type { TrainingSession } from '@/types';

export default function HistoryPage() {
  const router = useRouter();
  const [selectedSession, setSelectedSession] = useState<TrainingSession | null>(null);

  const sessions = useLiveQuery(() => getRecentSessions(100), []);

  const handleDelete = async (id: number) => {
    if (confirm('Delete this session?')) {
      await deleteSession(id);
      setSelectedSession(null);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (days === 1) {
      return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (days < 7) {
      return `${days} days ago`;
    } else {
      return date.toLocaleDateString();
    }
  };

  return (
    <main className="min-h-screen flex flex-col p-4 safe-top safe-bottom">
      {/* Header */}
      <header className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.push('/')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-xl font-bold">History</h1>
      </header>

      {/* Sessions list */}
      {!sessions || sessions.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-gray-500 dark:text-gray-400">
          <Clock className="w-12 h-12 mb-4 opacity-50" />
          <p>No training sessions yet</p>
          <Button variant="link" onClick={() => router.push('/')}>
            Start your first session
          </Button>
        </div>
      ) : (
        <div className="space-y-2 max-w-md mx-auto w-full">
          {sessions.map((session) => (
            <button
              key={session.id}
              onClick={() => setSelectedSession(session)}
              className={cn(
                'w-full p-4 rounded-lg text-left transition-all',
                'bg-white dark:bg-gray-800 shadow-sm hover:shadow-md',
                session.status === 'completed'
                  ? 'border-l-4 border-green-500'
                  : session.status === 'timeout'
                  ? 'border-l-4 border-red-500'
                  : 'border-l-4 border-gray-300'
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{session.gridSize}×{session.gridSize}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {session.orderMode === 'ASC' ? '↑' : '↓'}
                  </span>
                </div>
                <span
                  className={cn(
                    'text-xs px-2 py-1 rounded-full',
                    session.status === 'completed'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                      : session.status === 'timeout'
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                  )}
                >
                  {session.status}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-500 dark:text-gray-400">
                <span>{formatTimeShort(session.completionTimeMs)}</span>
                <span>{formatDate(session.startedAt)}</span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Session detail modal */}
      {selectedSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Session Details</h2>
              <Button variant="ghost" size="sm" onClick={() => setSelectedSession(null)}>
                Close
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                <Zap className="w-5 h-5 mx-auto mb-1 text-yellow-500" />
                <div className="text-xs text-gray-500 dark:text-gray-400">Grid</div>
                <div className="font-bold">
                  {selectedSession.gridSize}×{selectedSession.gridSize}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                <Clock className="w-5 h-5 mx-auto mb-1 text-blue-500" />
                <div className="text-xs text-gray-500 dark:text-gray-400">Time</div>
                <div className="font-bold">{formatTime(selectedSession.completionTimeMs)}</div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                <Target className="w-5 h-5 mx-auto mb-1 text-green-500" />
                <div className="text-xs text-gray-500 dark:text-gray-400">Accuracy</div>
                <div className="font-bold">{selectedSession.accuracy}%</div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-center">
                <Target className="w-5 h-5 mx-auto mb-1 text-red-500" />
                <div className="text-xs text-gray-500 dark:text-gray-400">Mistakes</div>
                <div className="font-bold">{selectedSession.mistakes}</div>
              </div>
            </div>

            <div className="text-sm text-gray-500 dark:text-gray-400">
              <div>Order: {selectedSession.orderMode === 'ASC' ? 'Ascending' : 'Descending'}</div>
              <div>Date: {new Date(selectedSession.startedAt).toLocaleString()}</div>
            </div>

            <Button
              variant="destructive"
              className="w-full"
              onClick={() => selectedSession.id && handleDelete(selectedSession.id)}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Session
            </Button>
          </div>
        </div>
      )}
    </main>
  );
}
