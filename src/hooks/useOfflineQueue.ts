import { useEffect, useMemo, useState } from "react";

type QueuedAction = {
  id: string;
  type: "expense:add" | "income:add" | "bill:markPaid";
  payload: Record<string, unknown>;
  createdAt: number;
};

const KEY = "nesteggs_offline_queue";

const loadQueue = (): QueuedAction[] => {
  const raw = localStorage.getItem(KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as QueuedAction[];
  } catch {
    return [];
  }
};

export const useOfflineQueue = () => {
  const [queue, setQueue] = useState<QueuedAction[]>(() => loadQueue());
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(queue));
  }, [queue]);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, []);

  const enqueue = (item: Omit<QueuedAction, "id" | "createdAt">): void => {
    setQueue((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        ...item
      }
    ]);
  };

  const clear = (): void => setQueue([]);

  const pendingCount = useMemo(() => queue.length, [queue]);

  return { isOnline, queue, pendingCount, enqueue, clear };
};
