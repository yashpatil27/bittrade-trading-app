# WebSocket Event Optimization Guide

## Problem Analysis

Your current WebSocket implementation has multiple components listening to the same events, creating redundant event handlers and potential performance issues:

### Current Duplicate Event Listeners:

1. **`balance_update`** - listened to by ~8 components
2. **`price_update`** - listened to by ~6 components  
3. **`transaction_notification`** - listened to by ~4 components
4. **`settings_update`** - listened to by ~3 components

## Solution: Centralized Context Management

### 1. Enhanced Balance Context

Replace individual component event listeners with a single centralized context:

```typescript
// Use EnhancedBalanceContext instead of individual listeners
const { balances, prices, refreshBalance } = useEnhancedBalance();
```

**Benefits:**
- Single WebSocket listener for balance/price events
- Automatic propagation to all components
- Centralized loading/error states
- Consistent data across app

### 2. Notification Context

Centralize all notification events:

```typescript
// Use NotificationContext instead of individual listeners
const { notifications, hasUnreadNotifications } = useNotification();
```

**Benefits:**
- Single WebSocket listener for all notification events
- Centralized notification management
- Automatic notification history
- Reduced event handler redundancy

## Implementation Steps

### Step 1: Update App.tsx

```typescript
import { EnhancedBalanceProvider } from './contexts/EnhancedBalanceContext';
import { NotificationProvider } from './contexts/NotificationContext';

function App() {
  return (
    <WebSocketProvider>
      <EnhancedBalanceProvider>
        <NotificationProvider>
          {/* Your existing app structure */}
        </NotificationProvider>
      </EnhancedBalanceProvider>
    </WebSocketProvider>
  );
}
```

### Step 2: Update Components

#### Before (Multiple Event Listeners):
```typescript
// In each component
const { on, off } = useWebSocket();

useEffect(() => {
  const handleBalanceUpdate = (data) => setBalances(data);
  const handlePriceUpdate = (data) => setPrices(data);
  
  on('balance_update', handleBalanceUpdate);
  on('price_update', handlePriceUpdate);
  
  return () => {
    off('balance_update', handleBalanceUpdate);
    off('price_update', handlePriceUpdate);
  };
}, [on, off]);
```

#### After (Centralized Context):
```typescript
// In each component
const { balances, prices } = useEnhancedBalance();

// No WebSocket event listeners needed!
// Data automatically updates when WebSocket events fire
```

### Step 3: Component-Specific Updates

#### Layout.tsx:
```typescript
// Remove WebSocket listeners
const { balances, prices } = useEnhancedBalance();

// Use balances.btc and prices.sell_rate directly
```

#### Home.tsx:
```typescript
// Remove WebSocket listeners
const { balances, prices } = useEnhancedBalance();
const { notifications } = useNotification();

// All data automatically synced
```

#### Modal Components:
```typescript
// Remove individual WebSocket listeners
const { balances, prices } = useEnhancedBalance();

// Pass data as props or use context directly
```

## Performance Benefits

### Before:
- 15+ individual WebSocket event listeners
- Duplicate event processing
- Inconsistent data states
- Manual cleanup management

### After:
- 2 centralized WebSocket listeners
- Single event processing
- Consistent data states
- Automatic cleanup

## Migration Strategy

1. **Phase 1**: Implement new contexts
2. **Phase 2**: Update high-traffic components (Layout, Home)
3. **Phase 3**: Update modal components
4. **Phase 4**: Remove old individual listeners
5. **Phase 5**: Test and optimize

## Testing Considerations

- Verify WebSocket events still propagate correctly
- Test component re-renders (should be reduced)
- Verify data consistency across components
- Test modal data updates
- Check for memory leaks

## Additional Optimizations

### 1. Debounced Updates
```typescript
// In context, debounce rapid updates
const debouncedBalanceUpdate = useCallback(
  debounce((newBalances: Balances) => {
    setBalances(newBalances);
  }, 100),
  []
);
```

### 2. Selective Re-renders
```typescript
// Use React.memo for expensive components
const ExpensiveComponent = React.memo(({ balances }) => {
  // Only re-renders when balances actually change
});
```

### 3. Event Batching
```typescript
// Batch multiple rapid events
const batchedUpdates = useCallback(() => {
  // Process multiple updates in single render
}, []);
```

## Expected Results

- **Reduced Event Listeners**: From 15+ to 2-3
- **Improved Performance**: Less duplicate processing
- **Better Consistency**: Single source of truth
- **Easier Maintenance**: Centralized event handling
- **Reduced Memory Usage**: Fewer event handlers

This optimization will significantly improve your WebSocket implementation's efficiency and maintainability.
