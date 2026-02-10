'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '@/stores/game-store';

export function useTimer() {
  const workerRef = useRef<Worker | null>(null);
  const { status, startTime, updateElapsedTime } = useGameStore();

  // Initialize Web Worker
  useEffect(() => {
    // Create worker from inline code to avoid separate file issues with Next.js
    const workerCode = `
      let intervalId = null;
      let startTime = null;
      let pausedTime = 0;

      self.onmessage = function(e) {
        const { type, payload } = e.data;

        switch (type) {
          case 'START':
            startTime = payload.startTime;
            pausedTime = 0;
            if (intervalId) clearInterval(intervalId);
            intervalId = setInterval(() => {
              const elapsed = Date.now() - startTime;
              self.postMessage({ type: 'TICK', elapsed });
            }, 10);
            break;

          case 'PAUSE':
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
            break;

          case 'RESUME':
            if (!intervalId && startTime) {
              intervalId = setInterval(() => {
                const elapsed = Date.now() - startTime;
                self.postMessage({ type: 'TICK', elapsed });
              }, 10);
            }
            break;

          case 'STOP':
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
            startTime = null;
            pausedTime = 0;
            break;
        }
      };
    `;

    const blob = new Blob([workerCode], { type: 'application/javascript' });
    const workerUrl = URL.createObjectURL(blob);
    workerRef.current = new Worker(workerUrl);

    workerRef.current.onmessage = (e) => {
      const { type, elapsed } = e.data;
      if (type === 'TICK') {
        updateElapsedTime(elapsed);
      }
    };

    return () => {
      if (workerRef.current) {
        workerRef.current.terminate();
        workerRef.current = null;
      }
      URL.revokeObjectURL(workerUrl);
    };
  }, [updateElapsedTime]);

  // Handle status changes
  useEffect(() => {
    if (!workerRef.current) return;

    switch (status) {
      case 'playing':
        if (startTime) {
          workerRef.current.postMessage({ type: 'START', payload: { startTime } });
        }
        break;
      case 'paused':
        workerRef.current.postMessage({ type: 'PAUSE' });
        break;
      case 'completed':
      case 'timeout':
      case 'idle':
        workerRef.current.postMessage({ type: 'STOP' });
        break;
    }
  }, [status, startTime]);

  const start = useCallback(() => {
    if (workerRef.current && startTime) {
      workerRef.current.postMessage({ type: 'START', payload: { startTime } });
    }
  }, [startTime]);

  const pause = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'PAUSE' });
    }
  }, []);

  const resume = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'RESUME' });
    }
  }, []);

  const stop = useCallback(() => {
    if (workerRef.current) {
      workerRef.current.postMessage({ type: 'STOP' });
    }
  }, []);

  return { start, pause, resume, stop };
}
