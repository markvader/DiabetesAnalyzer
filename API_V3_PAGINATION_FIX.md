# Nightscout API v3 Historical Data Fix

## Problem Solved

Fixed the "Parameter limit out of tolerance" error that users were experiencing when trying to fetch historical glucose data using Nightscout API v3. This error occurred because the API v3 has stricter parameter limits than API v1.

## What Was Changed

### 1. **Smart Pagination System**
- API v3 now uses automatic pagination for large datasets
- Safe limit of 1,000 items per request (instead of up to 30,000)
- Multiple smaller requests are combined automatically
- No user intervention required

### 2. **Intelligent Request Strategy**
- **Small datasets** (≤1,000 items): Single API request
- **Large datasets** (>1,000 items): Automatic pagination with multiple requests
- **Progress logging**: Console shows pagination progress for debugging

### 3. **Enhanced Error Handling**
- Specific error messages for "Parameter limit out of tolerance"
- Clear guidance on troubleshooting steps
- Fallback suggestions (switch to API v1 if needed)

## Technical Details

### Pagination Logic
```typescript
// For large datasets, automatically chunks requests:
// Instead of: ?limit=10000 (FAILS)
// Uses: Multiple requests with ?limit=1000 each
```

### Safety Features
- Maximum 50 pages per request type (safety limit)
- Automatic deduplication using timestamps
- Graceful error handling per page
- Abortable requests for user cancellation

### Supported Limits
- **Entries**: Up to 50,000 items (50 pages × 1,000)
- **Treatments**: Up to 50,000 items (50 pages × 1,000)
- **Safe for all Nightscout API v3 servers**

## User Benefits

✅ **No more "Parameter limit out of tolerance" errors**  
✅ **Fetch large historical datasets (weeks/months)**  
✅ **Automatic optimization - no settings needed**  
✅ **Compatible with all Nightscout API v3 servers**  
✅ **Fallback guidance if issues persist**  

## Migration Notes

- **Existing API v1 users**: No changes needed
- **API v3 users**: Automatic improvement, no action required
- **Mixed environments**: Each API version optimized separately

## Console Output Example

```
📊 API v3 limits: entries=1000, treatments=1000
🔄 Large dataset requested (5000 items). Using pagination to stay within API v3 limits.
📄 Page 1 for entries: /api/v3/entries?filter[date][$gte]=1693478100000&filter[date][$lte]=1693478200000&limit=1000&sort=-date
📄 Page 2 for entries: /api/v3/entries?filter[date][$gte]=1693478100000&filter[date][$lte]=1693478150000&limit=1000&sort=-date
✅ Completed paginated fetch for entries: 5000 items in 5 pages
```

This fix ensures that Nightscout API v3 users can now successfully fetch large amounts of historical data without hitting parameter limits.
