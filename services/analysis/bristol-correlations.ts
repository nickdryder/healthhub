import { AnalyzedInsight, AnalysisContext, getDateStr } from './types';
import { getHourInTimezone } from '../timezone-utils';

export function analyzeBristolCorrelations(ctx: AnalysisContext): AnalyzedInsight[] {
  const insights: AnalyzedInsight[] = [];
  const bristolLogs = ctx.logs.filter(l => l.log_type === 'bristol_stool');
  if (bristolLogs.length < 5) return insights;

  const bristolByDate: Record<string, { types: number[]; times: number[] }> = {};
  bristolLogs.forEach(b => {
    const date = getDateStr(b.logged_at);
    const type = parseInt(b.value.replace('Type ', '')) || 4;
    const hour = getHourInTimezone(b.logged_at, ctx.userTimezone);
    if (!bristolByDate[date]) bristolByDate[date] = { types: [], times: [] };
    bristolByDate[date].types.push(type);
    bristolByDate[date].times.push(hour);
  });

  // Poop timing vs caffeine timing
  const caffeineLogs = ctx.logs.filter(l => l.log_type === 'caffeine');
  if (caffeineLogs.length >= 5) {
    const caffeineByDate: Record<string, number> = {};
    caffeineLogs.forEach(c => {
      const date = getDateStr(c.logged_at);
      const hour = getHourInTimezone(c.logged_at, ctx.userTimezone);
      if (!caffeineByDate[date] || hour < caffeineByDate[date]) {
        caffeineByDate[date] = hour;
      }
    });

    let poopAfterCaffeine = 0;
    let totalPoops = 0;

    Object.entries(bristolByDate).forEach(([date, data]) => {
      const caffeineHour = caffeineByDate[date];
      if (caffeineHour === undefined) return;
      data.times.forEach(poopHour => {
        totalPoops++;
        if (poopHour > caffeineHour && poopHour - caffeineHour <= 2) {
          poopAfterCaffeine++;
        }
      });
    });

    if (totalPoops >= 5 && poopAfterCaffeine / totalPoops > 0.4) {
      insights.push({
        type: 'correlation',
        title: 'Caffeine triggers BMs',
        description: `${Math.round((poopAfterCaffeine / totalPoops) * 100)}% of bowel movements occur within 2h of caffeine.`,
        confidence: 0.82,
        relatedMetrics: ['bristol', 'caffeine'],
      });
    }
  }

  // Bristol vs supplements timing
  const supplements = ctx.logs.filter(l => l.log_type === 'supplement');
  if (supplements.length >= 5) {
    const supplementDates = new Set(supplements.map(s => getDateStr(s.logged_at)));
    let suppBristol: number[] = [];
    let noSuppBristol: number[] = [];

    Object.entries(bristolByDate).forEach(([date, data]) => {
      const avgType = data.types.reduce((a, b) => a + b, 0) / data.types.length;
      if (supplementDates.has(date)) {
        suppBristol.push(avgType);
      } else {
        noSuppBristol.push(avgType);
      }
    });

    if (suppBristol.length >= 2 && noSuppBristol.length >= 2) {
      const suppAvg = suppBristol.reduce((a, b) => a + b, 0) / suppBristol.length;
      const noSuppAvg = noSuppBristol.reduce((a, b) => a + b, 0) / noSuppBristol.length;
      // Ideal is 3-4
      const suppFromIdeal = Math.abs(suppAvg - 3.5);
      const noSuppFromIdeal = Math.abs(noSuppAvg - 3.5);
      if (noSuppFromIdeal - suppFromIdeal > 0.5) {
        insights.push({
          type: 'correlation',
          title: 'Supplements improve digestion',
          description: `Bristol scores are closer to ideal (3-4) on days you take supplements.`,
          confidence: 0.74,
          relatedMetrics: ['bristol', 'supplement'],
        });
      }
    }
  }

  // Bristol vs hydration inference (high sodium + low steps = dehydrated)
  const steps = ctx.metrics.filter(m => m.metric_type === 'steps');
  if (ctx.foods.length >= 5 && steps.length >= 5) {
    const stepsByDate: Record<string, number> = {};
    steps.forEach(s => { stepsByDate[getDateStr(s.recorded_at)] = s.value; });
    const avgSteps = steps.reduce((s, m) => s + m.value, 0) / steps.length;

    const sodiumByDate: Record<string, number> = {};
    ctx.foods.forEach(f => {
      if (!f.sodium) return;
      const date = getDateStr(f.logged_at);
      sodiumByDate[date] = (sodiumByDate[date] || 0) + f.sodium;
    });
    const sodiumDays = Object.values(sodiumByDate);
    if (sodiumDays.length < 3) return insights;
    const avgSodium = sodiumDays.reduce((a, b) => a + b, 0) / sodiumDays.length;

    let dehydratedBristol: number[] = [];
    let hydratedBristol: number[] = [];

    Object.entries(bristolByDate).forEach(([date, data]) => {
      const sodium = sodiumByDate[date];
      const daySteps = stepsByDate[date];
      if (!sodium || !daySteps) return;

      const avgType = data.types.reduce((a, b) => a + b, 0) / data.types.length;
      // Dehydrated = high sodium + low activity
      if (sodium > avgSodium * 1.2 && daySteps < avgSteps * 0.8) {
        dehydratedBristol.push(avgType);
      } else if (sodium < avgSodium * 0.8 && daySteps > avgSteps * 1.2) {
        hydratedBristol.push(avgType);
      }
    });

    if (dehydratedBristol.length >= 2 && hydratedBristol.length >= 2) {
      const dehydratedAvg = dehydratedBristol.reduce((a, b) => a + b, 0) / dehydratedBristol.length;
      const hydratedAvg = hydratedBristol.reduce((a, b) => a + b, 0) / hydratedBristol.length;
      // Lower bristol = harder/constipated
      if (hydratedAvg - dehydratedAvg > 0.8) {
        insights.push({
          type: 'correlation',
          title: 'Hydration affects digestion',
          description: `High sodium + low activity days correlate with harder stools. Stay hydrated!`,
          confidence: 0.73,
          relatedMetrics: ['bristol', 'food', 'steps'],
        });
      }
    }
  }

  // Overall bristol pattern
  const allTypes = bristolLogs.map(b => parseInt(b.value.replace('Type ', '')) || 4);
  const avgType = allTypes.reduce((a, b) => a + b, 0) / allTypes.length;
  if (avgType < 3) {
    insights.push({
      type: 'recommendation',
      title: 'Consider more fiber & water',
      description: `Your average Bristol is ${avgType.toFixed(1)} (hard). Increase fiber and hydration.`,
      confidence: 0.80,
      relatedMetrics: ['bristol'],
    });
  } else if (avgType > 5) {
    insights.push({
      type: 'recommendation',
      title: 'Monitor loose stools',
      description: `Your average Bristol is ${avgType.toFixed(1)} (loose). Track food triggers.`,
      confidence: 0.80,
      relatedMetrics: ['bristol'],
    });
  }

  return insights;
}