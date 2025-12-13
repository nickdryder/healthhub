import React, { createContext, useContext, useState } from 'react';

interface CachedInsight {
  id: string;
  type: 'correlation' | 'prediction' | 'recommendation';
  title: string;
  description: string;
  confidence: number;
  relatedMetrics: string[];
  createdAt: string;
}

interface InsightCacheContextType {
  cacheInsight: (insight: CachedInsight) => void;
  getInsight: (id: string) => CachedInsight | null;
}

const InsightCacheContext = createContext<InsightCacheContextType | null>(null);

export function InsightCacheProvider({ children }: { children: React.ReactNode }) {
  const [cache, setCache] = useState<Record<string, CachedInsight>>({});

  const cacheInsight = (insight: CachedInsight) => {
    setCache(prev => ({ ...prev, [insight.id]: insight }));
  };

  const getInsight = (id: string) => cache[id] || null;

  return (
    <InsightCacheContext.Provider value={{ cacheInsight, getInsight }}>
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
