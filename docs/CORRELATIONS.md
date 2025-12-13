# Health Correlations Reference

This document lists all correlations the AI analysis engine can detect. Each requires sufficient data (typically 3-5+ days) to generate insights.

**Note:** Weight comparisons use 7-day moving averages to smooth out daily fluctuations.

---

## Sleep Correlations
**File:** `services/analysis/sleep-correlations.ts`

| Correlation | Description |
|-------------|-------------|
| Sleep duration | Flags if average sleep < 7 hours |
| Sleep vs caffeine timing | Compares sleep on days with caffeine before/after 2pm |
| Sleep vs late meals | Compares sleep on days eating after 9pm vs earlier |
| Sleep vs exercise timing | Morning vs evening workout impact on sleep |
| Sleep vs steps | High-step days vs low-step days sleep comparison |
| Sleep consistency | Measures variability in sleep duration (std deviation) |
| Sleep vs calendar stress | Compares sleep on busy (4+ events) vs calm days |
| Sleep vs calories | Over/under eating impact on sleep |
| **Sleep vs sodium** | Sleep quality on high vs low sodium intake days |

---

## Caffeine Correlations
**File:** `services/analysis/caffeine-correlations.ts`

| Correlation | Description |
|-------------|-------------|
| Caffeine vs resting HR | HR on late caffeine days vs early caffeine days |
| Caffeine vs HRV | HRV on high caffeine (200mg+) vs low caffeine days |
| Caffeine vs poop timing | % of bowel movements within 2h of caffeine |
| Late caffeine warning | Flags if >30% of caffeine is consumed after 2pm |

---

## Food/Nutrition Correlations
**File:** `services/analysis/food-correlations.ts`

| Correlation | Description |
|-------------|-------------|
| Sodium vs next-day weight | Weight change (7-day avg) after high vs low sodium days |
| Sugar vs symptoms | Symptom count on high vs low sugar days |
| Dairy vs Bristol score | Stool consistency on dairy vs non-dairy days |
| Gluten vs Bristol score | Stool consistency on gluten vs non-gluten days |
| Fiber vs Bristol score | How fiber intake affects ideal stool (type 3-4) |
| Late eating vs sleep | Sleep on days with meals after 9pm |

---

## Exercise Correlations
**File:** `services/analysis/exercise-correlations.ts`

| Correlation | Description |
|-------------|-------------|
| Exercise intensity vs resting HR | Next-day HR after intense vs light workouts |
| Exercise intensity vs HRV | Next-day HRV after intense vs light workouts |
| Exercise timing vs sleep | Morning vs evening workout impact on sleep |
| Exercise gaps vs HRV | HRV on rest days vs workout days |
| Exercise type vs symptoms | Symptom rate after specific exercise types |
| Strong workout week | Flags 4+ workout days in a week |

---

## Steps Correlations
**File:** `services/analysis/steps-correlations.ts`

| Correlation | Description |
|-------------|-------------|
| Activity level | Flags if average < 5,000 steps or celebrates > 10,000 |
| Steps vs mood symptoms | Mood-related symptoms on high vs low step days |
| Steps vs sleep quality | Sleep duration on high vs low step days |
| Steps vs HRV | HRV on active vs sedentary days |
| Steps vs calories burned | Correlation between steps and calorie expenditure |
| **Steps vs rain** | Step count on rainy vs dry days |
| **Steps vs temperature** | Activity on hot (>30°C), nice (15-25°C), cold (<5°C) days |

---

## HRV Correlations
**File:** `services/analysis/hrv-correlations.ts`

| Correlation | Description |
|-------------|-------------|
| HRV vs sleep duration | HRV after 7+ hours vs < 6 hours sleep |
| HRV vs calendar stress | HRV on busy (4+ events) vs calm days |
| HRV vs dairy | HRV on dairy vs non-dairy days |
| HRV vs exercise recovery | HRV on rest days vs workout days |
| **HRV vs caffeine** | HRV on caffeine-free days vs caffeine days |
| **HRV vs sodium** | HRV on high vs low sodium intake days |
| **HRV vs steps** | HRV on active vs sedentary days |
| **HRV vs weight** | HRV when weight (7-day avg) is above/below average |
| **HRV vs symptoms** | HRV on symptom days vs symptom-free days |
| **HRV vs weather pressure** | HRV on low vs high barometric pressure days |
| **HRV vs calories** | HRV on calorie deficit vs surplus days |

---

## Heart Rate Correlations
**File:** `services/analysis/hrv-correlations.ts`

| Correlation | Description |
|-------------|-------------|
| Resting HR vs symptoms | Symptom count on elevated vs normal HR days |
| Resting HR vs sleep debt | HR after consecutive nights of poor sleep |
| Overtraining detection | Rising HR + consecutive workout days |
| **Resting HR vs weight** | HR when weight (7-day avg) is elevated vs lower |

---

## Symptom Correlations
**File:** `services/analysis/symptom-correlations.ts`

| Correlation | Description |
|-------------|-------------|
| Recurring symptoms | Identifies most frequently logged symptom |
| Day-of-week patterns | Which day has most symptoms |
| Symptoms vs supplements | Symptom rate on supplement vs non-supplement days |
| Symptoms vs sleep | Symptoms after < 6h vs > 7.5h sleep |
| Symptoms vs dairy | Symptom rate on dairy days |
| Symptoms vs gluten | Symptom rate on gluten days |
| Symptoms vs Bristol | Symptoms when digestion is abnormal (Bristol <3 or >5) |
| Symptoms vs calendar | Symptoms on busy (4+ events) vs calm days |
| Symptoms vs calorie deficit | Symptoms on low-calorie vs normal days |
| **Very low sleep vs symptoms** | Symptom spike on days with <5h sleep |
| **Symptom clusters** | Identifies symptoms that tend to occur on the same day |
| **Steps vs symptoms** | Symptoms on sedentary vs active days |
| **Undereating vs symptoms** | Symptoms on very low calorie days (<50% avg) |
| **Overeating vs symptoms** | Symptoms on very high calorie days (>150% avg) |
| **Supplement timing vs symptoms** | Morning vs evening supplement impact on symptoms |
| **Symptoms vs barometric pressure** | Symptoms on low vs high pressure days |
| **Symptoms vs humidity** | Symptoms on humid vs dry days |

---

## Bristol/Digestion Correlations
**File:** `services/analysis/bristol-correlations.ts`

| Correlation | Description |
|-------------|-------------|
| Poop timing vs caffeine | % of BMs within 2h of caffeine |
| Bristol vs supplements | Stool consistency on supplement days |
| Bristol vs hydration | Inferred dehydration (high sodium + low steps) impact |
| Overall Bristol pattern | Flags consistently hard (<3) or loose (>5) stools |

---

## Weight Correlations
**File:** `services/analysis/weight-correlations.ts`

**All weight comparisons use 7-day moving average to smooth daily fluctuations.**

| Correlation | Description |
|-------------|-------------|
| Weight vs sodium | Overnight weight trend after high sodium |
| Weight vs sleep | Weight trend after poor vs good sleep |
| Weight vs food timing | Weight trend after late eating (past 9pm) |
| Weight vs calories | Weight trend after surplus vs deficit days |
| Weight trend | Overall weight direction over tracking period |

---

## Calendar Correlations
**File:** `services/analysis/calendar-correlations.ts`

| Correlation | Description |
|-------------|-------------|
| Calendar vs steps | Step count on busy (4+ events) vs calm days |
| Calendar vs sleep | Sleep on busy vs calm days |
| Calendar vs symptoms | Symptom rate on packed vs light days |
| Early shift prediction | Tomorrow's early events (before 8am) |
| Calendar vs HRV | HRV on busy vs calm days |
| Heavy week prediction | Warns if 15+ events in next 7 days |

---

## Medication Correlations
**File:** `services/analysis/medication-correlations.ts`

| Correlation | Description |
|-------------|-------------|
| Adherence rate | % of days medication was taken |
| Symptoms vs missed meds | Specific symptoms that spike when meds skipped |
| Sleep vs medication | Sleep duration on med days vs missed days |
| HRV vs medication | HRV on med days vs missed days |

---

## Weather Correlations
**File:** Multiple analysis files use weather data

| Correlation | Description |
|-------------|-------------|
| Symptoms vs pressure | Symptoms on low barometric pressure days |
| Symptoms vs humidity | Symptoms on high humidity days |
| Steps vs rain | Activity reduction on rainy days |
| Steps vs temperature | Activity on extreme heat/cold vs nice days |
| HRV vs pressure | HRV changes with barometric pressure |

---
## Data Requirements

| Analysis Type | Minimum Data Needed |
|---------------|---------------------|
| Sleep patterns | 3+ sleep records |
| Caffeine & sleep | 3+ caffeine + 3+ sleep |
| Symptom patterns | 2+ of same symptom |
| Symptom clusters | 10+ symptom logs |
| Day-of-week trends | 5+ symptom logs |
| Activity trends | 5+ step records |
| Exercise progress | 2+ same exercise |
| Weather correlations | Location set + 5+ weather days + 5+ symptoms |
| Food correlations | 5+ food entries |
| Weight trends | 7+ weight records (for 7-day avg) |
| Calendar correlations | 5+ calendar events |
| Medication tracking | 5+ medication logs |

---

## Adding New Correlations

To add a new correlation:

1. Identify the appropriate file in `services/analysis/`
2. Add a new analysis function or extend an existing one
3. Return an `AnalyzedInsight` object with:
   - `type`: 'correlation' | 'prediction' | 'recommendation'
   - `title`: Short, actionable title
   - `description`: Explanation with specific numbers
   - `confidence`: 0.0 - 1.0 (higher = more data/certainty)
   - `relatedMetrics`: Array of metric types involved

4. The insight will automatically be included in the analysis run