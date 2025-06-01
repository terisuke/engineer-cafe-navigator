# Debug Expression Flow Analysis

## Current Issue
The emotion parsing is working correctly (`primaryEmotion: 'happy'`), but the expression is not changing on the VRM model.

## Data Flow Analysis

### 1. Voice API Response ✅
- Returns `primaryEmotion: 'happy'` correctly
- Located in: `/api/voice` route (line 108 in route.ts)

### 2. Page.tsx Processing ✅ 
- Receives emotion data in `processVoiceInput()` function
- Lines 347-362 process the emotion with EnhancedEmotionManager
- Calls `setExpressionFunction(expressionName, weight)` correctly

### 3. CharacterAvatar Expression Control ❓
- Creates `setExpression` function in `loadCharacter()` 
- Function should directly call VRM `expressionManager.setValue()`
- Uses VRM's native expression system

## Potential Issues to Check

### Issue 1: Expression Name Mapping
The EnhancedEmotionManager returns expressions like:
- `happy: 0.9, smile: 0.8, relaxed: 0.3`

But VRM models might have different expression names like:
- `happy`, `joy`, `smile`, etc.

### Issue 2: VRM Expression Manager
Check if:
- `vrm.expressionManager` exists
- `expressionManager.expressionMap` contains the expected expressions
- `expressionManager.setValue()` actually changes the model

### Issue 3: Function Callback Chain
Verify:
- `onExpressionControl` callback is properly set
- `setSetExpressionFunction` state is updated correctly
- Function is accessible when emotions are processed

## Debug Steps

1. **Check Console Logs**: Look for the detailed logs we added
2. **Verify Available Expressions**: See what expressions the VRM model actually supports
3. **Test Direct Expression Calls**: Check if manual expression calls work
4. **Verify Function Chain**: Ensure the callback chain works

## Expected Console Output

When working correctly, you should see:
```
[Main] === Received expression control function ===
[CharacterAvatar] Testing expression function with "happy"
[CharacterAvatar] === setExpression called ===
[CharacterAvatar] Available expressions: ['happy', 'sad', 'angry', ...]
[Main] setExpressionFunction is available, applying emotion: happy
[Main] Calling setExpressionFunction(happy, 0.72)
[CharacterAvatar] Set happy: 0 -> 0.72
```