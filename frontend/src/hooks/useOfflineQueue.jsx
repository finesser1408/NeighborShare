import { useState, useEffect, useCallback } from 'react';

/**
 * useOfflineQueue – queues async operations when the device is offline
 * and automatically flushes them when connectivity is restored.
 *
 * Usage:
 *   const { enqueue, queueLength } = useOfflineQueue(async (item) => {
 *     await api.doSomething(item);
 *   });
 */
export default function useOfflineQueue(processor) {
  const [queue, setQueue] = useState([]);
  const [flushing, setFlushing] = useState(false);

  const enqueue = useCallback((item) => {
    setQueue((prev) => [...prev, item]);
  }, []);

  const flush = useCallback(async () => {
    if (flushing || queue.length === 0 || !navigator.onLine) return;
    setFlushing(true);
    const toProcess = [...queue];
    setQueue([]);
    try {
      for (const item of toProcess) {
        await processor(item);
      }
    } catch (err) {
      // Re-enqueue items that failed
      setQueue((prev) => [...toProcess, ...prev]);
      console.error('[useOfflineQueue] flush error', err);
    } finally {
      setFlushing(false);
    }
  }, [flushing, queue, processor]);

  useEffect(() => {
    const handleOnline = () => flush();
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [flush]);

  // Also try to flush when queue changes and we're online
  useEffect(() => {
    if (navigator.onLine && queue.length > 0) {
      flush();
    }
  }, [queue, flush]);

  return { enqueue, queueLength: queue.length, flushing };
}
