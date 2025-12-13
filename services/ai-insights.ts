import { supabase } from '@/integrations/supabase/client';
import { localAnalysis } from './local-analysis';
import { analyzeCycleCorrelations } from './analysis/cycle-correlations';

export interface GeneratedInsight {
  type: 'correlation' | 'prediction' | 'recommendation';
  title: string;
  description: string;
  confidence: number;
  relatedMetrics: string[];
}

/**
 * AI Insights Service
 * 
 * Uses local rule-based analysis to generate health insights
 * entirely on-device without any external API calls.
 */

class AIInsightsService {
  /**
   * Analyze user's health data using local analysis engine
   */
  async generateInsights(userId: string): Promise<GeneratedInsight[]> {
    try {
      console.log('Generating insights locally for user:', userId);
      const insights = await localAnalysis.analyzeHealthData(userId);
      console.log(`Generated ${insights.length} insights locally`);
      return insights;
    } catch (error) {
      console.error('Failed to generate insights:', error);
      return [];
    }
  }

  /**
   * Save generated insights to database
   */
  async saveInsights(userId: string, insights: GeneratedInsight[]): Promise<boolean> {
    try {
      const insightRecords = insights.map(insight => ({
        user_id: userId,
        insight_type: insight.type,
        title: insight.title,
        description: insight.description,
        confidence: insight.confidence,
        related_metrics: insight.relatedMetrics,
        metadata: {},
      }));

      const { error } = await supabase
        .from('ai_insights')
        .insert(insightRecords as any);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Failed to save insights:', error);
      return false;
    }
  }

  /**
   * Get stored insights for user
   */
  async getInsights(userId: string, limit = 10): Promise<any[]> {
    try {
      const { data, error } = await supabase
        .from('ai_insights')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Failed to fetch insights:', error);
      return [];
    }
  }

  /**
   * Generate and save new insights
   */
  async refreshInsights(userId: string): Promise<GeneratedInsight[]> {
    const insights = await this.generateInsights(userId);

    if (insights.length > 0) {
      await this.saveInsights(userId, insights);
    }

    return insights;
  }
}

export const aiInsightsService = new AIInsightsService();


// Add cyclePhase to metrics aggregation
export async function generateHealthInsights(
  userId: string,
  timeframe: 'daily' | 'weekly' | 'monthly' = 'daily'
): Promise<GeneratedInsight[]> {
  try {
    // ... existing metric gathering code ...

    // Get current cycle phase
    const cycleTracking = new CycleTracker();
    const currentEntry = await cycleTracking.getCurrentEntry();
    const metrics = {
      // ... existing metrics ...
      cyclePhase: currentEntry?.phase,
    };

    // ... existing correlation gathering ...
    const cycleAnalysis = analyzeCycleCorrelations(metrics, metrics.cyclePhase);

    // Merge cycle insights with other insights
    const allInsights = [
      // ... other insights ...
      ...cycleAnalysis,
    ];

    // ... rest of function ...
    return allInsights;
  } catch (error) {
    console.error('Error generating insights:', error);
    throw error;
  }
}