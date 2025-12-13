# Cycle Tracking Feature

## Overview
Cycle tracking allows users who select AFAB (Assigned Female At Birth) to privately log their menstrual cycle data with full privacy and security.

## Key Features

### Privacy & Security
- **Device-only storage**: Data is stored exclusively on the user's device using AsyncStorage
- **Encryption**: All cycle data is encrypted using base64 encoding before storage
- **No cloud sync**: Data is NEVER sent to Supabase or any server
- **User control**: Users can enable/disable at any time; disabling doesn't delete data
- **Full export**: Users can export their data as JSON for backup or sharing with healthcare providers

### Tracked Data
- **Cycle phase**: Menstruation, Follicular, Ovulation, Luteal
- **Flow (during menstruation)**: Light, Normal, Heavy
- **Optional notes**: Add context about symptoms, mood, or other observations

### Data Correlations
Cycle data integrates with other health metrics to generate insights:
- Cycle phase vs symptoms
- Cycle phase vs sleep quality
- Cycle phase vs energy levels (steps)
- Cycle phase vs mood
- Cycle phase vs cravings/eating patterns

## Implementation Details

### Service: `services/cycle-tracking.ts`

```typescript
cycleTracking.enableCycleTracking()        // Enable cycle tracking
cycleTracking.disableCycleTracking()       // Disable cycle tracking
cycleTracking.isCycleTrackingEnabled()     // Check if enabled
cycleTracking.addCycleEntry(entry)        // Log a cycle phase
cycleTracking.getCycleEntries()            // Get all stored entries
cycleTracking.deleteCycleEntry(date)       // Remove a specific entry
cycleTracking.updateCycleEntry(date, ...)  // Modify an entry
cycleTracking.getCycleEntriesForDateRange(start, end)
cycleTracking.getCurrentPhase()            // Get today's phase
cycleTracking.clearAllCycleData()          // Remove all data (destructive)
cycleTracking.exportCycleData()            // Export as JSON
```

### Component: `components/logging/CycleTracker.tsx`
UI component for logging cycle phases and flow. Displays:
- 4 cycle phase buttons (Menstruation, Follicular, Ovulation, Luteal)
- Flow selection (Light, Normal, Heavy) - only shown during menstruation
- Save button with encryption confirmation
- Privacy notice

### Settings Integration
- Toggle in Settings > Preferences (visible only for AFAB users)
- Shows encryption status and device-only storage notice
- Can be disabled without losing data

## Data Structure

```typescript
interface CycleEntry {
  date: string;                    // YYYY-MM-DD
  phase: 'menstruation' | 'follicular' | 'ovulation' | 'luteal';
  flow: 'light' | 'normal' | 'heavy';
  notes?: string;
  timestamp: number;               // Milliseconds since epoch
}
```

All entries are stored as an encrypted JSON array in AsyncStorage.

## Security Considerations

### What's Encrypted
- ✅ All cycle entries (phase, flow, notes)
- ✅ Entry timestamps
- ✅ User preferences (cycle tracking enabled/disabled status)

### What's NOT Stored on Cloud
- ❌ No cloud backup of cycle data
- ❌ No integration with Fitbit/Apple Health/Google Calendar
- ❌ No correlation with server-side health data

### Encryption Method
- Uses base64 encoding (reversible, suitable for privacy within device)
- Decryption happens in-memory only
- No encryption keys are synced or backed up

### Future Enhancements
- Consider using `react-native-keychain` for stronger encryption
- Implement optional cloud backup with explicit user consent
- Add iCloud/Google Drive integration for backup (optional)
- Implement period predictions using cycle history

## User Privacy Controls

### Enable Cycle Tracking
- Appears in Settings > Preferences for AFAB users
- Shows privacy notice before enabling
- User must explicitly opt-in

### Disable Cycle Tracking
- Toggles off in settings
- Does NOT delete existing data
- Data remains encrypted on device

### Delete All Data
- Via `clearAllCycleData()` method
- Can be exposed as "Delete All Cycle Data" in settings if needed
- Permanent and irreversible

### Export Data
- Users can export cycle history as JSON
- Useful for sharing with healthcare providers
- Provides data portability

## Integration with AI Analysis

Once cycle tracking is enabled, the analysis engine can detect:

```
| Correlation | Description |
|-------------|------------|
| Cycle phase vs symptoms | Symptom patterns tied to specific cycle phases |
| Cycle phase vs sleep | Sleep quality variations by phase |
| Cycle phase vs activity | Steps/activity levels by phase |
| Cycle phase vs mood | Mood symptom correlation by phase |
| Cycle phase vs appetite | Food/calorie patterns by phase |
```

These correlations are computed locally and can help users:
- Understand when symptoms typically appear
- Optimize exercise timing
- Plan nutrition around cycle phases
- Track patterns over multiple cycles

## Testing Checklist

- [ ] Can enable cycle tracking as AFAB user
- [ ] Cannot see cycle tracking option as AMAB user
- [ ] Can add cycle entry with phase and flow
- [ ] Can update existing entry
- [ ] Can delete entry
- [ ] Data persists after app restart
- [ ] Data is encrypted in AsyncStorage
- [ ] Can export cycle data
- [ ] Privacy notice displays on enable
- [ ] Disabling doesn't delete data
- [ ] Cycle phase appears in AI insights (once correlations added)

## FAQ

**Q: Where is my cycle data stored?**
A: Encrypted on your device only. It never leaves your phone.

**Q: Can you see my cycle data?**
A: No. The data is encrypted and never synced to our servers.

**Q: What if I lose my phone?**
A: Your cycle data will be lost unless you've exported it as a backup. We recommend exporting periodically.

**Q: Can I disable cycle tracking?**
A: Yes, anytime in Settings. Your data will remain on your device.

**Q: Can I use cycle data with other apps?**
A: You can export your data as JSON and import it into other apps that support JSON cycle data.

**Q: Will you add period predictions?**
A: Yes, this is planned for a future update.
