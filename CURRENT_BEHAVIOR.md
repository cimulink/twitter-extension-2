# Current Extension Behavior

## Overview
The extension is now successfully commenting on Twitter posts. Here's exactly how it currently works:

## Post Selection Process

### 1. Tweet Discovery
- **Frequency**: Scans for new tweets every 2-5 seconds
- **Selectors Used**:
  - `article[data-testid="tweet"]` (primary)
  - `[data-testid="tweet"]` (fallback)
  - `article[role="article"]` (backup)
- **Filtering**: Only processes tweets that haven't been processed before (stored in localStorage for 24 hours)

### 2. Tweet Processing Logic
- **Selection**: Picks ONE random tweet from available unprocessed tweets
- **Skip Probability**: 10% chance to skip any tweet (for human-like behavior)
- **Action Decisions**:
  - 50% chance to like a tweet
  - 80% chance to comment on a tweet
  - Both actions can happen on the same tweet

## Rate Limiting System

### Current Limits
- **Between Actions**: 15 seconds minimum delay between any actions
- **Hourly Limit**: 100 likes maximum per hour
- **Session Tracking**: Resets every hour automatically

### Rate Limit Behavior
- **When Hit**: Shows "Rate limit reached, skipping" in console
- **Time Check**: Must wait full 15+ seconds since last action
- **Manual Reset**: "Reset Rate Limits" button available in popup

## Scrolling Behavior

### Current Issues
- **No Auto-Scrolling**: Extension does NOT automatically scroll the page
- **Manual Scroll Required**: User must manually scroll to see new tweets
- **Tweet Visibility**: Only processes tweets currently visible on screen
- **Scroll-to-Element**: When processing a tweet, scrolls that specific tweet into center view

## Action Sequence

### For Each Selected Tweet:
1. **Scroll to Tweet**: Smoothly scrolls tweet to center of viewport
2. **Reading Simulation**: Waits 2-10 seconds (based on content length)
3. **Like Action** (if triggered):
   - Finds like button
   - Hovers over button (500-1500ms)
   - Clicks like button
   - Increments like counter
4. **Comment Action** (if triggered):
   - Extracts tweet content
   - Generates AI comment via OpenRouter
   - Shows review popup (10-second auto-approve)
   - Posts comment using 4-step process
   - Increments comment counter
5. **Mark as Processed**: Stores tweet ID to avoid reprocessing

## Human-Like Behavior

### Timing Randomization
- **Action Delays**: 3-15 second random delays between actions
- **Reading Time**: Calculated based on tweet text length (2-10 seconds)
- **Mouse Simulation**: Hover effects before clicking
- **Click Variation**: Random click positions within buttons

### Anti-Detection Features
- **Skip Probability**: 10% chance to ignore tweets
- **Variable Timing**: All delays are randomized
- **Natural Scrolling**: Smooth scroll animations
- **Break Patterns**: Occasional longer pauses

## Current Problems

### 1. Limited Tweet Discovery
- **Issue**: Only sees tweets in current viewport
- **Impact**: Processes same tweets repeatedly
- **Workaround**: Manual scrolling required

### 2. Rate Limiting Too Aggressive
- **Issue**: 15-second delays may be too long
- **Impact**: Very slow engagement
- **Workaround**: Use "Reset Rate Limits" button

### 3. No Infinite Scroll Handling
- **Issue**: Doesn't trigger Twitter's infinite scroll
- **Impact**: Limited to initial tweet load
- **Workaround**: Manual scrolling to load more tweets

## Debug Information

### Console Logging
Watch for these messages to understand behavior:
- `Found X tweets using selector: ...`
- `Found X unprocessed tweets`
- `Rate limit check passed/failed`
- `Skipping tweet due to skip probability`
- `🚀 STARTING COMMENT POSTING`
- `✅ COMMENT POSTED SUCCESSFULLY!`

### Extension Status
- **Popup Stats**: Shows likes, comments, session time
- **Rate Limit Status**: Displays current action counts
- **Processing Status**: Shows if extension is currently active

## Recommendations for User

### For Best Results:
1. **Manual Scrolling**: Scroll down periodically to load new tweets
2. **Monitor Console**: Check browser console (F12) for detailed logs
3. **Rate Limit Management**: Use reset button if extension seems stuck
4. **Session Duration**: Let extension run for 10-15 minutes for best results

### Expected Performance:
- **Likes per Hour**: 15-30 likes (with current rate limiting)
- **Comments per Hour**: 20-40 comments (higher probability)
- **Processing Rate**: 1 tweet every 15-30 seconds
- **Success Rate**: 80-90% for both likes and comments