// Content script for Twitter Auto-Engagement Extension

class TwitterAutoEngagement {
  constructor() {
    this.isEnabled = false;
    this.settings = {};
    this.isProcessing = false;
    this.lastLikeTime = 0;
    this.lastCommentTime = 0;
    this.actionCount = { likes: 0, comments: 0 };
    this.sessionStartTime = Date.now();
    this.lastScrollTime = 0;
    this.scrollCooldown = 10000; // 10 seconds between scrolls

    this.init();
  }

  async init() {
    console.log('Twitter Auto-Engagement initialized');

    // Load settings
    await this.loadSettings();

    // Start monitoring if enabled
    if (this.settings.enabled) {
      this.startMonitoring();
    }

    // Listen for settings updates
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true;
    });
  }

  async loadSettings() {
    try {
      // Load directly from storage first (most reliable)
      const settings = await chrome.storage.sync.get();
      if (settings && Object.keys(settings).length > 0) {
        this.settings = settings;
        this.isEnabled = this.settings.enabled || false;
        console.log('Content script loaded settings from storage:', this.settings);
        return;
      }

      // Fallback to background script
      const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (response && response.success) {
        this.settings = response.settings;
        this.isEnabled = this.settings.enabled || false;
        console.log('Content script loaded settings from background:', this.settings);
      }
    } catch (error) {
      console.error('Failed to load settings in content script:', error);
      // Set minimal default settings
      this.settings = {
        enabled: false,
        commentTone: 'casual',
        likeFrequency: 30,
        maxLikesPerHour: 50
      };
      this.isEnabled = false;
    }
  }

  handleMessage(message, sender, sendResponse) {
    switch (message.type) {
      case 'TOGGLE_EXTENSION':
        this.toggleExtension(message.enabled);
        sendResponse({ success: true });
        break;

      case 'UPDATE_SETTINGS':
        this.settings = { ...this.settings, ...message.settings };
        sendResponse({ success: true });
        break;

      case 'GET_STATUS':
        sendResponse({
          success: true,
          status: {
            enabled: this.isEnabled,
            processing: this.isProcessing,
            actionCount: this.actionCount,
            sessionTime: Date.now() - this.sessionStartTime
          }
        });
        break;

      case 'RESET_RATE_LIMITS':
        this.resetRateLimits();
        sendResponse({ success: true });
        break;
    }
  }

  resetRateLimits() {
    console.log('Resetting rate limits manually');
    this.actionCount = { likes: 0, comments: 0 };
    this.lastLikeTime = 0;
    this.lastCommentTime = 0;
    this.hourlyResetTime = Date.now() + (60 * 60 * 1000);
    console.log('Rate limits reset - can perform actions immediately');
  }

  toggleExtension(enabled) {
    this.isEnabled = enabled;
    if (enabled) {
      this.startMonitoring();
      console.log('Twitter Auto-Engagement started');
    } else {
      this.stopMonitoring();
      console.log('Twitter Auto-Engagement stopped');
    }
  }

  startMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    // Check for new posts more frequently when rate limited (to retry tweets)
    this.monitoringInterval = setInterval(() => {
      if (this.isEnabled && !this.isProcessing) {
        this.scanForPosts();
      }
    }, 3000); // Fixed 3-second interval for consistent retries
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  async scanForPosts() {
    if (this.isProcessing || !this.isEnabled) return;

    // Find all tweet containers
    const tweets = this.findTweets();

    console.log(`📊 Found ${tweets.length} tweets on page`);

    // If no tweets found, auto-scroll to load more
    if (tweets.length === 0) {
      console.log('🔄 No tweets found on page - auto-scrolling to load more content');
      await this.autoScrollToLoadMore();
      return;
    }

    // Try to find a tweet we can actually process (not rate limited)
    let tweetToProcess = null;
    const shuffledTweets = tweets.sort(() => Math.random() - 0.5); // Randomize order

    for (const tweet of shuffledTweets) {
      // Check if we can perform any actions on this tweet
      const canLike = this.checkRateLimits('like');
      const canComment = this.checkRateLimits('comment');

      if (canLike || canComment) {
        tweetToProcess = tweet;
        console.log('Found processable tweet - can like:', canLike, 'can comment:', canComment);
        break;
      }
    }

    if (tweetToProcess) {
      await this.processTweet(tweetToProcess);
    } else {
      console.log('No processable tweets found - checking if we should scroll');

      // Check if all visible tweets are processed or rate limited
      const allTweetsProcessed = this.areAllTweetsProcessed(tweets);

      if (allTweetsProcessed) {
        console.log('🔄 All visible tweets processed - auto-scrolling to load more content');
        await this.autoScrollToLoadMore();
      } else {
        console.log('All tweets are rate limited, will retry on next scan');
        // Don't mark any tweets as processed - they'll be retried
      }
    }
  }

  areAllTweetsProcessed(tweets) {
    // If no tweets provided, consider all processed
    if (!tweets || tweets.length === 0) {
      console.log(`📊 Processed status: No tweets to check - considering all processed`);
      return true;
    }

    // Check if all visible tweets have been processed
    let processedCount = 0;
    let unprocessedCount = 0;

    for (const tweet of tweets) {
      const tweetId = this.getTweetId(tweet);
      if (tweetId && !this.hasProcessedTweet(tweetId)) {
        unprocessedCount++;
      } else if (tweetId) {
        processedCount++;
      }
    }

    const allProcessed = unprocessedCount === 0;
    console.log(`📊 Processed status: ${processedCount} processed, ${unprocessedCount} unprocessed - ${allProcessed ? 'All tweets processed' : 'Some tweets unprocessed'}`);
    return allProcessed;
  }

  async autoScrollToLoadMore() {
    try {
      // Check cooldown to prevent excessive scrolling
      const now = Date.now();
      if (now - this.lastScrollTime < this.scrollCooldown) {
        const remainingCooldown = Math.ceil((this.scrollCooldown - (now - this.lastScrollTime)) / 1000);
        console.log(`📜 Auto-scroll on cooldown for ${remainingCooldown}s more`);
        return;
      }

      console.log('📜 Starting auto-scroll to load more tweets...');

      // Get current scroll position
      const currentScrollY = window.scrollY;
      const documentHeight = document.documentElement.scrollHeight;
      const windowHeight = window.innerHeight;

      // Check if we're already at the bottom
      if (currentScrollY + windowHeight >= documentHeight - 100) {
        console.log('📜 Already at bottom of page');
        return;
      }

      // Smooth scroll down by a reasonable amount
      const scrollAmount = windowHeight * 0.8; // Scroll down 80% of viewport height
      const targetScrollY = currentScrollY + scrollAmount;

      window.scrollTo({
        top: targetScrollY,
        behavior: 'smooth'
      });

      console.log(`📜 Scrolled from ${currentScrollY} to ${targetScrollY}`);

      // Wait for scroll to complete and new content to load
      await this.humanDelay(2000, 3000);

      // Check if new tweets were loaded
      const newTweets = this.findTweets();
      console.log(`📜 After scroll: Found ${newTweets.length} tweets`);

      // If no new tweets after scrolling, try a longer wait
      if (newTweets.length === 0) {
        console.log('📜 No new tweets loaded, waiting longer...');
        await this.humanDelay(3000, 5000);
      }

      // Update last scroll time
      this.lastScrollTime = Date.now();

    } catch (error) {
      console.error('❌ Auto-scroll error:', error);
    }
  }

  findTweets() {
    // Updated Twitter selectors for current Twitter/X interface
    const selectors = [
      'article[data-testid="tweet"]',
      '[data-testid="tweet"]',
      'article[role="article"]'
    ];

    let tweets = [];
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        tweets = Array.from(elements);
        console.log(`Found ${tweets.length} tweets using selector: ${selector}`);
        break;
      }
    }

    if (tweets.length === 0) {
      console.log('No tweets found with any selector');
      return [];
    }

    // Filter out tweets we've already processed
    const unprocessedTweets = tweets.filter(tweet => {
      const tweetId = this.getTweetId(tweet);
      const isUnprocessed = tweetId && !this.hasProcessedTweet(tweetId);
      if (!isUnprocessed && tweetId) {
        console.log(`Skipping already processed tweet: ${tweetId}`);
      }
      return isUnprocessed;
    });

    console.log(`📊 Tweet analysis: Found ${tweets.length} total tweets, ${unprocessedTweets.length} unprocessed tweets`);
    return unprocessedTweets;
  }

  getTweetId(tweetElement) {
    // Try to extract tweet ID from various attributes
    const link = tweetElement.querySelector('a[href*="/status/"]');
    if (link) {
      const match = link.href.match(/\/status\/(\d+)/);
      return match ? match[1] : null;
    }

    // Fallback: use element position as pseudo-ID
    const rect = tweetElement.getBoundingClientRect();
    return `${rect.top}-${rect.left}`;
  }

  hasProcessedTweet(tweetId) {
    const processed = localStorage.getItem('twitter_auto_processed') || '{}';
    const processedTweets = JSON.parse(processed);

    // Clean old entries (older than 24 hours)
    const now = Date.now();
    const dayAgo = now - (24 * 60 * 60 * 1000);

    Object.keys(processedTweets).forEach(id => {
      if (processedTweets[id] < dayAgo) {
        delete processedTweets[id];
      }
    });

    localStorage.setItem('twitter_auto_processed', JSON.stringify(processedTweets));

    return processedTweets[tweetId] !== undefined;
  }

  markTweetProcessed(tweetId) {
    const processed = localStorage.getItem('twitter_auto_processed') || '{}';
    const processedTweets = JSON.parse(processed);
    processedTweets[tweetId] = Date.now();
    localStorage.setItem('twitter_auto_processed', JSON.stringify(processedTweets));
  }

  async processTweet(tweetElement) {
    if (this.isProcessing) return;

    this.isProcessing = true;

    try {
      const tweetId = this.getTweetId(tweetElement);

      // Check if we should skip this tweet
      if (Math.random() < this.settings.skipProbability) {
        console.log('Skipping tweet due to skip probability');
        this.markTweetProcessed(tweetId);
        return;
      }

      // Re-check rate limits at processing time (they may have changed)
      const canLike = this.checkRateLimits('like');
      const canComment = this.checkRateLimits('comment');

      if (!canLike && !canComment) {
        console.log('Rate limits hit during processing - will retry this tweet later');
        return; // Don't mark as processed - will be retried
      }

      // Scroll tweet into view with human-like behavior
      await this.scrollToElement(tweetElement);

      // Random delay to simulate reading
      const readingDelay = this.calculateReadingTime(tweetElement);
      await this.humanDelay(readingDelay);

      // Decide what actions to take based on settings, probability and rate limits
      const likingEnabled = this.settings.enableLiking !== false;
      const commentingEnabled = this.settings.enableCommenting !== false;

      const shouldLike = likingEnabled && canLike && this.shouldPerformAction('like');
      const shouldComment = commentingEnabled && canComment && this.shouldPerformAction('comment');

      console.log(`Action decisions: like=${shouldLike} (enabled=${likingEnabled}, canLike=${canLike}), comment=${shouldComment} (enabled=${commentingEnabled}, canComment=${canComment})`);

      let actionPerformed = false;

      if (shouldLike) {
        const likeSuccess = await this.likeTweet(tweetElement);
        if (likeSuccess) actionPerformed = true;
      }

      if (shouldComment) {
        const commentSuccess = await this.commentOnTweet(tweetElement);
        if (commentSuccess) actionPerformed = true;
      }

      // Only mark as processed if we actually performed an action OR if we deliberately chose not to act
      // Don't mark as processed if we failed due to technical issues or content filtering
      if (actionPerformed) {
        this.markTweetProcessed(tweetId);
        console.log('✅ Tweet marked as processed - action taken');
      } else if (!shouldLike && !shouldComment) {
        // We deliberately chose not to act (probability-based decision)
        this.markTweetProcessed(tweetId);
        console.log('✅ Tweet marked as processed - no action chosen by probability');
      } else {
        // We wanted to act but failed (rate limits, content filtering, technical issues)
        console.log('⏳ Tweet not marked as processed - will retry later');
      }

    } catch (error) {
      console.error('Error processing tweet:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  checkRateLimits(actionType = 'like') {
    const now = Date.now();

    // Reset hourly counters if needed
    if (!this.hourlyResetTime || now > this.hourlyResetTime) {
      console.log('Resetting hourly counters');
      this.actionCount = { likes: 0, comments: 0 };
      this.hourlyResetTime = now + (60 * 60 * 1000);
    }

    // Check hourly limits
    const maxLikesPerHour = this.settings.maxLikesPerHour || 100;
    if (actionType === 'like' && this.actionCount.likes >= maxLikesPerHour) {
      console.log(`Like rate limit reached: ${this.actionCount.likes}/${maxLikesPerHour} likes this hour`);
      return false;
    }

    // Separate time checks for likes vs comments
    if (actionType === 'like') {
      const likeDelay = (this.settings.likeFrequency || 15) * 1000;
      const timeSinceLastLike = now - this.lastLikeTime;

      if (timeSinceLastLike < likeDelay) {
        console.log(`Like rate limit: Need to wait ${Math.ceil((likeDelay - timeSinceLastLike) / 1000)}s more for next like`);
        return false;
      }

      console.log(`Like rate limit check passed: ${this.actionCount.likes}/${maxLikesPerHour} likes, ${Math.floor(timeSinceLastLike / 1000)}s since last like`);
    } else if (actionType === 'comment') {
      // Comments have much shorter delays since they have natural delays (AI generation, review popup)
      const commentDelay = 5000; // Only 5 seconds between comments
      const timeSinceLastComment = now - this.lastCommentTime;

      if (timeSinceLastComment < commentDelay) {
        console.log(`Comment rate limit: Need to wait ${Math.ceil((commentDelay - timeSinceLastComment) / 1000)}s more for next comment`);
        return false;
      }

      console.log(`Comment rate limit check passed: ${this.actionCount.comments} comments, ${Math.floor(timeSinceLastComment / 1000)}s since last comment`);
    }

    return true;
  }

  shouldPerformAction(actionType) {
    // FIXED - RE-ENABLE COMMENTING
    const probabilities = {
      like: 0.5, // 50% chance to like
      comment: 0.8 // 80% chance to comment (MAIN FOCUS)
    };

    return Math.random() < probabilities[actionType];
  }

  async scrollToElement(element) {
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    // Only scroll if element is not fully visible
    if (rect.top < 0 || rect.bottom > viewportHeight) {
      const scrollY = window.scrollY + rect.top - (viewportHeight / 2);

      // Smooth scroll with human-like behavior
      window.scrollTo({
        top: scrollY,
        behavior: 'smooth'
      });

      // Wait for scroll to complete
      await this.humanDelay(1000, 2000);
    }
  }

  calculateReadingTime(tweetElement) {
    const textContent = tweetElement.textContent || '';
    const wordCount = textContent.split(' ').length;

    // Average reading speed: 200-300 words per minute
    const readingSpeed = 250; // words per minute
    const baseTime = (wordCount / readingSpeed) * 60 * 1000; // convert to milliseconds

    // Add randomness and ensure minimum time
    return Math.max(baseTime * (0.5 + Math.random()), 2000);
  }

  async likeTweet(tweetElement) {
    try {
      // Find like button
      const likeButton = this.findLikeButton(tweetElement);

      if (!likeButton) {
        console.log('Like button not found');
        return false;
      }

      // Check if already liked
      if (this.isAlreadyLiked(likeButton)) {
        console.log('Tweet already liked');
        return false;
      }

      // Simulate mouse hover
      await this.simulateHover(likeButton);
      await this.humanDelay(500, 1500);

      // Click like button
      await this.humanClick(likeButton);

      this.actionCount.likes++;
      this.lastLikeTime = Date.now(); // Update like timestamp
      console.log('Tweet liked successfully');

      // Log action
      chrome.runtime.sendMessage({
        type: 'LOG_ACTION',
        action: 'like',
        data: { timestamp: Date.now() }
      });

      return true;
    } catch (error) {
      console.error('Error liking tweet:', error);
      return false;
    }
  }

  findLikeButton(tweetElement) {
    const selectors = [
      '[data-testid="like"]',
      '[aria-label*="like" i]',
      '[role="button"][aria-label*="like" i]',
      'button[aria-label*="Like" i]'
    ];

    for (const selector of selectors) {
      const button = tweetElement.querySelector(selector);
      if (button) return button;
    }

    return null;
  }

  isAlreadyLiked(likeButton) {
    // Check various indicators that the tweet is already liked
    const ariaLabel = likeButton.getAttribute('aria-label') || '';
    const classList = likeButton.classList.toString();

    return ariaLabel.toLowerCase().includes('unlike') ||
           classList.includes('liked') ||
           classList.includes('favorited');
  }

  async commentOnTweet(tweetElement) {
    try {
      console.log('🎯 Starting intelligent comment generation...');

      // Check if we should comment on this post (text-only or images allowed)
      if (!this.shouldCommentOnPost(tweetElement)) {
        console.log('❌ Post not suitable for commenting - skipping');
        return false;
      }

      // Extract full post content including image context if enabled
      const fullPostContent = this.extractFullPostContent(tweetElement);

      if (!fullPostContent) {
        console.log('Could not extract post content');
        return false;
      }

      console.log(`📝 Extracted post content: "${fullPostContent.substring(0, 150)}..."`);

      // Generate intelligent comment
      console.log('🧠 Generating intelligent AI comment...');
      const response = await chrome.runtime.sendMessage({
        type: 'GENERATE_COMMENT',
        postContent: fullPostContent,
        settings: this.settings
      });

      if (!response.success) {
        console.log(`❌ Comment generation failed: ${response.error}`);
        return false;
      }

      console.log(`✅ Generated comment: "${response.comment}"`);

      // Check if full auto mode is enabled
      if (this.settings.fullAutoMode === true) {
        console.log('🤖 Full auto mode - posting comment automatically');
        const success = await this.postCommentDirectly(tweetElement, response.comment);

        if (success) {
          this.actionCount.comments++;
          this.lastCommentTime = Date.now();
          console.log('✅ Comment posted automatically');

          // Log action
          chrome.runtime.sendMessage({
            type: 'LOG_ACTION',
            action: 'comment',
            data: {
              timestamp: Date.now(),
              comment: response.comment
            }
          });
        }
        return success;
      } else {
        // Manual approval mode - open reply window and paste comment
        const success = await this.openReplyAndPasteComment(tweetElement, response.comment);
        return success;
      }
    } catch (error) {
      console.error('Error in intelligent commenting:', error);
      return false;
    }
  }

  // Check if this tweet is from the user themselves
  isOwnTweet(tweetElement) {
    try {
      // Look for the author name/username in the tweet
      const authorSelectors = [
        '[data-testid="User-Name"]',
        '[data-testid="User-Names"]',
        'a[href*="/"] span',
        '[dir="ltr"] span'
      ];

      for (const selector of authorSelectors) {
        const authorElements = tweetElement.querySelectorAll(selector);
        for (const element of authorElements) {
          const text = element.textContent?.toLowerCase() || '';
          // Check for your name or username variations
          if (text.includes('ajay kaaran gupta') ||
              text.includes('ajay') && text.includes('gupta') ||
              text.includes('@ajay')) {
            console.log(`🔍 Detected own tweet by author: "${text}"`);
            return true;
          }
        }
      }

      return false;
    } catch (error) {
      console.log('Error checking if own tweet:', error);
      return false; // If error, assume it's not own tweet
    }
  }

  // Check if we should comment on this post based on settings and content
  shouldCommentOnPost(tweetElement) {
    try {
      // First check if this is our own tweet
      if (this.isOwnTweet(tweetElement)) {
        console.log('❌ Skipping own tweet');
        return false;
      }

      const includeImages = this.settings.includeImages === true;

      // Check for media indicators
      const mediaSelectors = [
        'img',
        'video',
        '[data-testid="tweetPhoto"]',
        '[data-testid="videoComponent"]',
        '[data-testid="card.wrapper"]', // Link cards
        '[data-testid="poll"]',
        '.twitter-video'
      ];

      let hasMedia = false;
      let mediaType = null;

      for (const selector of mediaSelectors) {
        if (tweetElement.querySelector(selector)) {
          hasMedia = true;
          mediaType = selector;
          break;
        }
      }

      // If post has media but we don't include images, skip
      if (hasMedia && !includeImages) {
        console.log(`❌ Post contains media (${mediaType}) but images disabled - skipping`);
        return false;
      }

      // Get text content
      const textContent = this.extractTweetContent(tweetElement);

      // Must have meaningful text (at least 10 characters for image posts, 20 for text-only)
      const meaningfulText = textContent.replace(/@\w+/g, '').replace(/https?:\/\/\S+/g, '').trim();
      const minLength = hasMedia ? 10 : 20; // Lower requirement for image posts

      if (meaningfulText.length < minLength) {
        console.log(`❌ Post lacks meaningful text content (${meaningfulText.length} chars, need ${minLength})`);
        return false;
      }

      if (hasMedia && includeImages) {
        console.log('✅ Image post suitable for commenting (images enabled)');
      } else {
        console.log('✅ Text-only post suitable for commenting');
      }

      return true;
    } catch (error) {
      console.log('❌ Error analyzing post type:', error);
      return false;
    }
  }

  // Extract comprehensive content including image context
  extractFullPostContent(tweetElement) {
    const textContent = this.extractTweetContent(tweetElement);
    const includeImages = this.settings.includeImages === true;

    if (!includeImages) {
      return textContent;
    }

    // If images are included, also extract image context
    const imageContext = this.extractImageContext(tweetElement);

    if (imageContext) {
      return `${textContent}\n\n[Image context: ${imageContext}]`;
    }

    return textContent;
  }

  // Extract context about images in the post
  extractImageContext(tweetElement) {
    try {
      const imageContexts = [];

      // Look for images with alt text
      const images = tweetElement.querySelectorAll('img[alt]');
      images.forEach((img, index) => {
        const altText = img.getAttribute('alt');
        if (altText && altText.trim() && !altText.toLowerCase().includes('avatar')) {
          imageContexts.push(`Image ${index + 1}: ${altText}`);
        }
      });

      // Look for video indicators
      if (tweetElement.querySelector('[data-testid="videoComponent"]')) {
        imageContexts.push('Contains video content');
      }

      // Look for link card previews
      const linkCard = tweetElement.querySelector('[data-testid="card.wrapper"]');
      if (linkCard) {
        const cardTitle = linkCard.querySelector('[data-testid="card.title"]');
        const cardDescription = linkCard.querySelector('[data-testid="card.description"]');

        if (cardTitle) {
          imageContexts.push(`Link preview: ${cardTitle.textContent}`);
        }
        if (cardDescription) {
          imageContexts.push(`Description: ${cardDescription.textContent}`);
        }
      }

      // Look for polls
      if (tweetElement.querySelector('[data-testid="poll"]')) {
        imageContexts.push('Contains poll/survey');
      }

      return imageContexts.length > 0 ? imageContexts.join(', ') : null;
    } catch (error) {
      console.log('Error extracting image context:', error);
      return null;
    }
  }

  extractTweetContent(tweetElement) {
    // Try multiple selectors for tweet text
    const selectors = [
      '[data-testid="tweetText"]',
      '.tweet-text',
      '.TweetTextSize',
      '[lang]'
    ];

    for (const selector of selectors) {
      const textElement = tweetElement.querySelector(selector);
      if (textElement && textElement.textContent.trim()) {
        return textElement.textContent.trim();
      }
    }

    // Fallback: get all text content and filter
    const allText = tweetElement.textContent || '';
    return allText.length > 20 ? allText.substring(0, 200) : allText;
  }


  async postCommentDirectly(tweetElement, comment) {
    try {
      console.log('🚀 POSTING COMMENT DIRECTLY - FULL AUTO MODE');

      // Step 1: Find and click reply button
      const replyButton = this.findReplyButton(tweetElement);
      if (!replyButton) {
        console.log('❌ Reply button not found');
        return false;
      }

      console.log('✅ Found reply button, clicking...');
      await this.humanClick(replyButton);
      await this.humanDelay(2000, 3000); // Wait for UI to load

      // Step 2: Wait for compose box to appear
      console.log('🔍 Looking for compose box...');
      let composeBox = null;

      // Wait up to 8 seconds for compose box
      for (let i = 0; i < 8; i++) {
        const editableElements = document.querySelectorAll('div[contenteditable="true"]');

        for (const element of editableElements) {
          // Check if element is visible and ready
          if (element.offsetParent !== null &&
              element.clientHeight > 0 &&
              element.clientWidth > 0) {
            composeBox = element;
            console.log(`✅ Found compose box (attempt ${i + 1})`);
            break;
          }
        }

        if (composeBox) break;
        await this.humanDelay(1000, 1000); // Wait 1 second between attempts
      }

      if (!composeBox) {
        console.log('❌ No compose box found after 8 seconds');
        return false;
      }

      // Step 3: Simple text insertion using execCommand
      console.log(`💬 Inserting comment: "${comment}"`);

      // Focus and clear
      composeBox.focus();
      await this.humanDelay(500, 500);

      // Use the most reliable method
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, comment);

      await this.humanDelay(1000, 1500);

      // Step 4: Find and click post button
      console.log('🔍 Looking for post button...');

      // Look for post/reply button that appears after typing
      let postButton = null;
      const postSelectors = [
        '[data-testid="tweetButton"]',
        '[data-testid="tweetButtonInline"]'
      ];

      for (const selector of postSelectors) {
        const buttons = document.querySelectorAll(selector);
        for (const button of buttons) {
          if (button.offsetParent !== null && !button.disabled) {
            postButton = button;
            console.log(`✅ Found post button: ${button.textContent}`);
            break;
          }
        }
        if (postButton) break;
      }

      if (!postButton) {
        console.log('❌ Post button not found');
        return false;
      }

      console.log('📤 Clicking post button...');
      await this.humanClick(postButton);

      await this.humanDelay(2000, 3000);
      console.log('✅ COMMENT POSTED AUTOMATICALLY!');
      return true;

    } catch (error) {
      console.error('❌ Auto comment posting failed:', error);
      return false;
    }
  }

  async openReplyAndPasteComment(tweetElement, comment) {
    try {
      console.log('🚀 Opening reply window and pasting comment...');

      // Step 1: Find and click reply button
      const replyButton = this.findReplyButton(tweetElement);
      if (!replyButton) {
        console.log('❌ Reply button not found');
        return false;
      }

      console.log('✅ Found reply button, clicking...');
      await this.humanClick(replyButton);
      await this.humanDelay(2000, 3000); // Wait for UI to load

      // Step 2: Wait for compose box to appear
      console.log('🔍 Looking for compose box...');
      let composeBox = null;

      // Wait up to 8 seconds for compose box
      for (let i = 0; i < 8; i++) {
        const editableElements = document.querySelectorAll('div[contenteditable="true"]');

        for (const element of editableElements) {
          // Check if element is visible and ready
          if (element.offsetParent !== null &&
              element.clientHeight > 0 &&
              element.clientWidth > 0) {
            composeBox = element;
            console.log(`✅ Found compose box (attempt ${i + 1})`);
            break;
          }
        }

        if (composeBox) break;
        await this.humanDelay(1000, 1000); // Wait 1 second between attempts
      }

      if (!composeBox) {
        console.log('❌ No compose box found after 8 seconds');
        return false;
      }

      // Step 3: Paste the comment text
      console.log(`💬 Pasting comment: "${comment}"`);

      // Focus and clear
      composeBox.focus();
      await this.humanDelay(500, 500);

      // Use the most reliable method to paste text
      document.execCommand('selectAll', false, null);
      document.execCommand('insertText', false, comment);

      console.log('✅ Comment pasted in reply window. User can now manually review and post.');

      // Show a manual confirmation dialog to pause extension
      console.log('🔒 PAUSING EXTENSION - Showing confirmation dialog...');
      const startTime = Date.now();
      await this.showManualConfirmationDialog();
      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`🔓 RESUMING EXTENSION - User confirmed after ${duration}s`);

      return true;

    } catch (error) {
      console.error('❌ Failed to open reply window:', error);
      return false;
    }
  }

  async showManualConfirmationDialog() {
    return new Promise((resolve) => {
      // Create a NON-BLOCKING notification dialog positioned at top-right
      const dialog = document.createElement('div');
      dialog.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        width: 320px;
        background: white;
        border-radius: 16px;
        padding: 20px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
        z-index: 99999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        border: 2px solid #1da1f2;
        animation: slideIn 0.3s ease-out;
      `;

      // Add slide-in animation
      const style = document.createElement('style');
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
      `;
      document.head.appendChild(style);

      dialog.innerHTML = `
        <div style="margin-bottom: 12px; font-size: 18px; font-weight: bold; color: #1da1f2;">
          🤖 Extension Paused
        </div>
        <div style="margin-bottom: 16px; color: #333; line-height: 1.4; font-size: 14px;">
          AI comment has been pasted in the reply window.
          <br><br>
          <strong>Review and manually post (or close) the reply, then click Continue.</strong>
        </div>
        <button id="continue-btn" style="
          background: #1da1f2;
          color: white;
          border: none;
          border-radius: 8px;
          padding: 10px 20px;
          font-size: 14px;
          font-weight: bold;
          cursor: pointer;
          width: 100%;
          transition: all 0.2s;
        " onmouseover="this.style.background='#1a91da'; this.style.transform='scale(1.02)'"
           onmouseout="this.style.background='#1da1f2'; this.style.transform='scale(1)'">
          ✅ Continue Extension
        </button>
      `;

      // Add click handler
      const continueBtn = dialog.querySelector('#continue-btn');
      continueBtn.onclick = () => {
        dialog.style.animation = 'slideIn 0.3s ease-out reverse';
        setTimeout(() => {
          if (document.body.contains(dialog)) {
            document.body.removeChild(dialog);
          }
          if (document.head.contains(style)) {
            document.head.removeChild(style);
          }
        }, 300);
        resolve();
      };

      // Make it pulsing every 5 seconds to remind user
      const pulseInterval = setInterval(() => {
        if (document.body.contains(dialog)) {
          dialog.style.animation = 'pulse 0.5s ease-in-out';
          setTimeout(() => {
            dialog.style.animation = '';
          }, 500);
        } else {
          clearInterval(pulseInterval);
        }
      }, 5000);

      // Add to page
      document.body.appendChild(dialog);

      console.log('✅ Non-blocking confirmation dialog shown - user can interact with reply window');
    });
  }

  async waitForUserAction(composeBox) {
    console.log('🔍 DEBUGGING: waitForUserAction called');
    console.log('🔍 DEBUGGING: composeBox exists?', !!composeBox);
    console.log('🔍 DEBUGGING: composeBox visible?', composeBox?.offsetParent !== null);

    return new Promise((resolve) => {
      console.log('🔍 DEBUGGING: Promise created, setting up watchers');

      let checkInterval;
      let resolved = false;
      let keyListener, clickListener;
      let startTime = Date.now();

      const cleanup = () => {
        if (checkInterval) clearInterval(checkInterval);
        if (keyListener) document.removeEventListener('keydown', keyListener);
        if (clickListener) document.removeEventListener('click', clickListener);
      };

      const resolveOnce = (reason) => {
        if (!resolved) {
          resolved = true;
          const duration = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`🔍 DEBUGGING: Resolving after ${duration}s due to: ${reason}`);
          cleanup();
          resolve();
        }
      };

      // Initial state check
      console.log('🔍 DEBUGGING: Initial checks...');
      console.log('🔍 DEBUGGING: composeBox in DOM?', document.body.contains(composeBox));
      console.log('🔍 DEBUGGING: composeBox offsetParent?', composeBox.offsetParent);

      const initialDialog = composeBox.closest('[role="dialog"]');
      console.log('🔍 DEBUGGING: Found parent dialog?', !!initialDialog);
      console.log('🔍 DEBUGGING: Dialog visible?', initialDialog?.offsetParent !== null);

      // If the compose box is already gone, resolve immediately
      if (!document.body.contains(composeBox) || !composeBox.offsetParent) {
        console.log('🔍 DEBUGGING: Compose box already gone, resolving immediately');
        resolveOnce('compose box already gone');
        return;
      }

      // If no parent dialog found, resolve immediately
      if (!initialDialog || !initialDialog.offsetParent) {
        console.log('🔍 DEBUGGING: No dialog found, resolving immediately');
        resolveOnce('no dialog found');
        return;
      }

      console.log('⏳ DEBUGGING: Starting to wait for user action...');

      // Check every 1 second for more responsive detection
      checkInterval = setInterval(() => {
        try {
          console.log('🔍 DEBUGGING: Interval check...');

          // Primary check: Is the compose box still in the DOM and visible?
          if (!document.body.contains(composeBox)) {
            console.log('🔍 DEBUGGING: Compose box removed from DOM');
            resolveOnce('compose box removed from DOM');
            return;
          }

          if (!composeBox.offsetParent) {
            console.log('🔍 DEBUGGING: Compose box hidden (offsetParent null)');
            resolveOnce('compose box hidden');
            return;
          }

          // Secondary check: Is there still an active dialog containing our compose box?
          const parentDialog = composeBox.closest('[role="dialog"]');
          if (!parentDialog) {
            console.log('🔍 DEBUGGING: Parent dialog no longer found');
            resolveOnce('parent dialog not found');
            return;
          }

          if (!parentDialog.offsetParent) {
            console.log('🔍 DEBUGGING: Parent dialog hidden');
            resolveOnce('parent dialog closed');
            return;
          }

          // Log that we're still waiting
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`⏳ DEBUGGING: Still waiting (${elapsed}s)...`);

        } catch (error) {
          console.error('🔍 DEBUGGING: Error in interval check:', error);
          resolveOnce('error during check');
        }
      }, 1000); // Check every second

      // Listen for ESC key
      keyListener = (event) => {
        if (event.key === 'Escape') {
          console.log('🔍 DEBUGGING: ESC key detected');
          resolveOnce('ESC key pressed');
        }
      };
      document.addEventListener('keydown', keyListener);

      // Listen for clicks outside modal
      clickListener = (event) => {
        const parentDialog = composeBox.closest('[role="dialog"]');
        if (parentDialog && !parentDialog.contains(event.target)) {
          console.log('🔍 DEBUGGING: Click outside detected');
          resolveOnce('clicked outside modal');
        }
      };

      // Add click listener after small delay
      setTimeout(() => {
        document.addEventListener('click', clickListener);
        console.log('🔍 DEBUGGING: Click listener added');
      }, 500);

      // Shorter safety timeout for testing
      setTimeout(() => {
        console.log('🔍 DEBUGGING: Safety timeout reached');
        resolveOnce('safety timeout');
      }, 30000); // 30 seconds instead of 5 minutes for testing
    });
  }

  async insertTextSafely(element, text) {
    try {
      console.log('Attempting safe text insertion...');

      // Method 1: Clipboard paste approach (most reliable for React)
      if (await this.tryClipboardMethod(element, text)) {
        return true;
      }

      // Method 2: execCommand (second most reliable)
      if (await this.tryExecCommandMethod(element, text)) {
        return true;
      }

      // Method 3: Event simulation
      if (await this.tryEventSimulationMethod(element, text)) {
        return true;
      }

      console.log('All text insertion methods failed');
      return false;
    } catch (error) {
      console.error('Error in insertTextSafely:', error);
      return false;
    }
  }

  async tryClipboardMethod(element, text) {
    try {
      console.log('Trying clipboard paste method...');

      // Store original clipboard content
      let originalClipboard = '';
      try {
        originalClipboard = await navigator.clipboard.readText();
      } catch (e) {
        console.log('Could not read original clipboard');
      }

      // Write our text to clipboard
      await navigator.clipboard.writeText(text);

      // Focus element and clear it
      element.focus();
      await this.humanDelay(100, 200);

      // Select all and delete
      document.execCommand('selectAll');
      document.execCommand('delete');

      // Paste our text
      document.execCommand('paste');

      // Restore original clipboard after a delay
      setTimeout(async () => {
        try {
          await navigator.clipboard.writeText(originalClipboard);
        } catch (e) {
          console.log('Could not restore original clipboard');
        }
      }, 1000);

      // Check if text was inserted
      await this.humanDelay(200, 300);
      if (element.textContent.includes(text) || element.innerText.includes(text)) {
        console.log('Clipboard method succeeded');
        return true;
      }

      console.log('Clipboard method failed - text not found in element');
      return false;
    } catch (error) {
      console.log('Clipboard method failed:', error);
      return false;
    }
  }

  async tryExecCommandMethod(element, text) {
    try {
      console.log('Trying execCommand method...');

      element.focus();
      await this.humanDelay(100, 200);

      // Clear and insert text
      document.execCommand('selectAll', false, null);
      document.execCommand('delete', false, null);
      const result = document.execCommand('insertText', false, text);

      if (result) {
        await this.humanDelay(200, 300);
        if (element.textContent.includes(text) || element.innerText.includes(text)) {
          console.log('execCommand method succeeded');
          return true;
        }
      }

      console.log('execCommand method failed');
      return false;
    } catch (error) {
      console.log('execCommand method failed:', error);
      return false;
    }
  }

  async tryEventSimulationMethod(element, text) {
    try {
      console.log('Trying event simulation method...');

      element.focus();
      await this.humanDelay(100, 200);

      // Clear existing content
      element.textContent = '';
      element.innerText = '';

      // Set the text directly
      element.textContent = text;

      // Dispatch comprehensive events
      const events = [
        new Event('input', { bubbles: true }),
        new Event('change', { bubbles: true }),
        new KeyboardEvent('keyup', { bubbles: true }),
        new InputEvent('input', {
          inputType: 'insertText',
          data: text,
          bubbles: true
        })
      ];

      events.forEach(event => element.dispatchEvent(event));

      await this.humanDelay(200, 300);
      if (element.textContent.includes(text) || element.innerText.includes(text)) {
        console.log('Event simulation method succeeded');
        return true;
      }

      console.log('Event simulation method failed');
      return false;
    } catch (error) {
      console.log('Event simulation method failed:', error);
      return false;
    }
  }

  async typeTextInContentEditable(element, text) {
    try {
      console.log('Starting text input process...');

      // Focus the element first
      element.focus();
      await this.humanDelay(300, 500);

      // Method 1: Use execCommand for better React compatibility
      try {
        // Clear existing content
        document.execCommand('selectAll', false, null);
        document.execCommand('delete', false, null);

        // Insert the text
        document.execCommand('insertText', false, text);
        console.log('Used execCommand method successfully');
        return;
      } catch (error) {
        console.log('execCommand failed, trying alternative methods:', error);
      }

      // Method 2: Simulate real typing with key events
      try {
        await this.simulateRealTyping(element, text);
        console.log('Used real typing simulation successfully');
        return;
      } catch (error) {
        console.log('Real typing simulation failed:', error);
      }

      // Method 3: Direct manipulation with React-safe events
      try {
        await this.directTextInsertion(element, text);
        console.log('Used direct text insertion successfully');
      } catch (error) {
        console.log('Direct text insertion failed:', error);
      }

    } catch (error) {
      console.error('All text input methods failed:', error);
    }
  }

  async simulateRealTyping(element, text) {
    element.focus();

    // Clear existing content with backspace
    const existingLength = element.textContent.length;
    for (let i = 0; i < existingLength; i++) {
      this.dispatchKeyEvent(element, 'keydown', 8); // Backspace
      this.dispatchKeyEvent(element, 'keyup', 8);
      await this.humanDelay(20, 50);
    }

    // Type each character
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const charCode = char.charCodeAt(0);

      // Dispatch key events
      this.dispatchKeyEvent(element, 'keydown', charCode, char);

      // Insert the character using composition events (more React-friendly)
      const compositionStart = new CompositionEvent('compositionstart', { data: '' });
      element.dispatchEvent(compositionStart);

      const compositionUpdate = new CompositionEvent('compositionupdate', { data: char });
      element.dispatchEvent(compositionUpdate);

      const compositionEnd = new CompositionEvent('compositionend', { data: char });
      element.dispatchEvent(compositionEnd);

      // Input event with proper data
      const inputEvent = new InputEvent('input', {
        inputType: 'insertCompositionText',
        data: char,
        bubbles: true,
        cancelable: false
      });
      element.dispatchEvent(inputEvent);

      this.dispatchKeyEvent(element, 'keyup', charCode, char);

      await this.humanDelay(50, 150);
    }
  }

  async directTextInsertion(element, text) {
    element.focus();

    // Create a text node and insert it
    const textNode = document.createTextNode(text);

    // Clear existing content
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }

    // Add the text node
    element.appendChild(textNode);

    // Dispatch input event to notify React
    const inputEvent = new InputEvent('input', {
      inputType: 'insertText',
      data: text,
      bubbles: true,
      cancelable: false
    });
    element.dispatchEvent(inputEvent);

    // Additional events for React components
    const changeEvent = new Event('change', { bubbles: true });
    element.dispatchEvent(changeEvent);
  }

  dispatchKeyEvent(element, type, keyCode, key = '') {
    const event = new KeyboardEvent(type, {
      keyCode: keyCode,
      which: keyCode,
      key: key,
      code: key,
      bubbles: true,
      cancelable: true
    });
    element.dispatchEvent(event);
  }

  findReplyButton(tweetElement) {
    // Look for the actual reply button within the tweet's action bar
    const selectors = [
      '[data-testid="reply"]',
      'button[data-testid="reply"]',
      '[aria-label*="Reply"]',
      '[aria-label*="reply"]'
    ];

    for (const selector of selectors) {
      const buttons = tweetElement.querySelectorAll(selector);
      for (const button of buttons) {
        // Make sure it's actually a reply button and visible
        if (button.offsetParent !== null &&
            (button.getAttribute('aria-label')?.toLowerCase().includes('reply') ||
             button.getAttribute('data-testid') === 'reply')) {
          console.log(`Found reply button with selector: ${selector}`);
          console.log('Reply button element:', button);
          return button;
        }
      }
    }

    console.log('Reply button not found in tweet');
    console.log('Tweet element:', tweetElement);
    return null;
  }

  async typeText(element, text) {
    element.focus();

    for (let i = 0; i < text.length; i++) {
      const char = text[i];

      // Simulate typing with random delays
      await this.humanDelay(50, 150);

      // Insert character
      element.value += char;

      // Trigger input events
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  async waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  }

  async simulateHover(element) {
    element.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
    await this.humanDelay(100, 300);
    element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
  }

  async humanClick(element) {
    // Simulate human-like clicking with slight randomness
    await this.simulateHover(element);
    await this.humanDelay(100, 500);

    const rect = element.getBoundingClientRect();
    const x = rect.left + rect.width * (0.3 + Math.random() * 0.4);
    const y = rect.top + rect.height * (0.3 + Math.random() * 0.4);

    element.dispatchEvent(new MouseEvent('mousedown', {
      bubbles: true,
      clientX: x,
      clientY: y
    }));

    await this.humanDelay(50, 150);

    element.dispatchEvent(new MouseEvent('mouseup', {
      bubbles: true,
      clientX: x,
      clientY: y
    }));

    element.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      clientX: x,
      clientY: y
    }));
  }

  humanDelay(min, max) {
    const delay = max ? min + Math.random() * (max - min) : min;
    return new Promise(resolve => setTimeout(resolve, delay));
  }

  randomDelay(min, max) {
    return min + Math.random() * (max - min);
  }
}

// Initialize the extension when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new TwitterAutoEngagement();
  });
} else {
  new TwitterAutoEngagement();
}