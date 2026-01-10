import React, { createContext, useContext, useState, useCallback } from 'react';

interface CachedInsight {
  id: string;
  type: 'correlation' | 'prediction' | 'recommendation';
  title: string;
  description: string;
  confidence: number;
  relatedMetrics: string[];
  createdAt: string;
  lastAccessed: number; // Timestamp for LRU
}

interface InsightCacheContextType {
  cacheInsight: (insight: Omit<CachedInsight, 'lastAccessed'>) => void;
  getInsight: (id: string) => CachedInsight | null;
  clearCache: () => void;
}

const InsightCacheContext = createContext<InsightCacheContextType | null>(null);

// Maximum cache size to prevent memory leaks
const MAX_CACHE_SIZE = 100;
// Auto-evict items older than 24 hours
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function InsightCacheProvider({ children }: { children: React.ReactNode }) {
  const [cache, setCache] = useState<Record<string, CachedInsight>>({});

  const cacheInsight = useCallback((insight: Omit<CachedInsight, 'lastAccessed'>) => {
    setCache(prev => {
      const now = Date.now();
      const newCache = { ...prev };

      // Add timestamp
      newCache[insight.id] = {
        ...insight,
        lastAccessed: now,
      };

      // Evict old entries if over MAX_CACHE_SIZE
      const entries = Object.entries(newCache);
      if (entries.length > MAX_CACHE_SIZE) {
        // Sort by lastAccessed (oldest first)
        entries.sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);

        // Remove oldest 20% of entries
        const toRemove = Math.floor(MAX_CACHE_SIZE * 0.2);
        const keysToRemove = entries.slice(0, toRemove).map(([key]) => key);

        keysToRemove.forEach(key => delete newCache[key]);
      }

      // Evict entries older than MAX_AGE_MS
      Object.keys(newCache).forEach(key => {
        const created = new Date(newCache[key].createdAt).getTime();
        if (now - created > MAX_AGE_MS) {
          delete newCache[key];
        }
      });

      return newCache;
    });
  }, []);

  const getInsight = useCallback((id: string) => {
    const insight = cache[id];
    if (insight) {
      // Update lastAccessed timestamp (LRU)
      setCache(prev => ({
        ...prev,
        [id]: { ...insight, lastAccessed: Date.now() },
      }));
      return insight;
    }
    return null;
  }, [cache]);

  const clearCache = useCallback(() => {
    setCache({});
  }, []);

  return (
    <InsightCacheContext.Provider value={{ cacheInsight, getInsight, clearCache }}>
      {children}
    </InsightCacheContext.Provider>
  );
}

export function useInsightCache() {
  const context = useContext(InsightCacheContext);
  if (!context) {
    throw new Error('useInsightCache must be used within InsightCacheProvider');
  }
  return context;
}
