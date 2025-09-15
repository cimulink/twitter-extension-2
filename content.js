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

    if (tweets.length === 0) return;

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
      console.log('All tweets are rate limited, will retry on next scan');
      // Don't mark any tweets as processed - they'll be retried
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

    console.log(`Found ${unprocessedTweets.length} unprocessed tweets`);
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

      // Decide what actions to take based on both probability and rate limits
      const shouldLike = canLike && this.shouldPerformAction('like');
      const shouldComment = canComment && this.shouldPerformAction('comment');

      let actionPerformed = false;

      if (shouldLike) {
        const likeSuccess = await this.likeTweet(tweetElement);
        if (likeSuccess) actionPerformed = true;
      }

      if (shouldComment) {
        const commentSuccess = await this.commentOnTweet(tweetElement);
        if (commentSuccess) actionPerformed = true;
      }

      // Only mark as processed if we actually performed an action
      // This prevents tweets from being marked as processed when no action was taken
      if (actionPerformed || (!shouldLike && !shouldComment)) {
        this.markTweetProcessed(tweetId);
        console.log('Tweet marked as processed');
      } else {
        console.log('No action taken on tweet - will retry later');
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
      console.log('Starting comment generation for tweet...');

      // Extract tweet content for AI generation
      const tweetContent = this.extractTweetContent(tweetElement);

      if (!tweetContent) {
        console.log('Could not extract tweet content');
        return false;
      }

      console.log(`Extracted tweet content: "${tweetContent.substring(0, 100)}..."`);

      // Generate comment
      console.log('Generating AI comment...');
      const response = await chrome.runtime.sendMessage({
        type: 'GENERATE_COMMENT',
        postContent: tweetContent,
        settings: this.settings
      });

      if (!response.success) {
        console.error('Failed to generate comment:', response.error);
        return false;
      }

      console.log(`Generated comment: "${response.comment}"`);

      // Show comment review popup
      const reviewResult = await this.showCommentReview(response.comment, tweetElement);

      if (!reviewResult.approved) {
        console.log('Comment not approved');
        return false;
      }

      const finalComment = reviewResult.editedComment || response.comment;
      console.log(`Final comment to post: "${finalComment}"`);

      // Post the comment
      const success = await this.postComment(tweetElement, finalComment);

      if (success) {
        this.actionCount.comments++;
        this.lastCommentTime = Date.now(); // Update comment timestamp
        console.log('Comment posted successfully');

        // Log action
        chrome.runtime.sendMessage({
          type: 'LOG_ACTION',
          action: 'comment',
          data: {
            timestamp: Date.now(),
            comment: finalComment
          }
        });
      } else {
        console.log('Failed to post comment');
      }

      return success;
    } catch (error) {
      console.error('Error commenting on tweet:', error);
      return false;
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

  async showCommentReview(comment, tweetElement) {
    return new Promise((resolve) => {
      // Create review popup
      const popup = this.createCommentReviewPopup(comment, tweetElement, resolve);
      document.body.appendChild(popup);

      // Auto-approve after 10 seconds if no interaction
      setTimeout(() => {
        if (document.body.contains(popup)) {
          document.body.removeChild(popup);
          resolve({ approved: true, editedComment: null });
        }
      }, 10000);
    });
  }

  createCommentReviewPopup(comment, tweetElement, callback) {
    const popup = document.createElement('div');
    popup.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      width: 300px;
      background: white;
      border: 2px solid #1da1f2;
      border-radius: 12px;
      padding: 16px;
      box-shadow: 0 8px 24px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    popup.innerHTML = `
      <div style="margin-bottom: 12px; font-weight: bold; color: #1da1f2;">
        🤖 Review Comment
      </div>
      <div style="margin-bottom: 12px; padding: 8px; background: #f7f9fa; border-radius: 8px; font-size: 14px;">
        "${comment}"
      </div>
      <div style="display: flex; gap: 8px;">
        <button id="approve-btn" style="flex: 1; padding: 8px; background: #1da1f2; color: white; border: none; border-radius: 6px; cursor: pointer;">
          ✓ Approve
        </button>
        <button id="edit-btn" style="flex: 1; padding: 8px; background: #657786; color: white; border: none; border-radius: 6px; cursor: pointer;">
          ✏ Edit
        </button>
        <button id="skip-btn" style="flex: 1; padding: 8px; background: #f91880; color: white; border: none; border-radius: 6px; cursor: pointer;">
          ✕ Skip
        </button>
      </div>
      <div style="margin-top: 8px; font-size: 12px; color: #657786; text-align: center;">
        Auto-approves in <span id="countdown">10</span>s
      </div>
    `;

    // Countdown timer
    let countdown = 10;
    const countdownEl = popup.querySelector('#countdown');
    const countdownInterval = setInterval(() => {
      countdown--;
      countdownEl.textContent = countdown;
      if (countdown <= 0) {
        clearInterval(countdownInterval);
      }
    }, 1000);

    // Button handlers
    popup.querySelector('#approve-btn').onclick = () => {
      clearInterval(countdownInterval);
      document.body.removeChild(popup);
      callback({ approved: true, editedComment: null });
    };

    popup.querySelector('#skip-btn').onclick = () => {
      clearInterval(countdownInterval);
      document.body.removeChild(popup);
      callback({ approved: false, editedComment: null });
    };

    popup.querySelector('#edit-btn').onclick = () => {
      clearInterval(countdownInterval);
      this.showCommentEditor(comment, popup, callback);
    };

    return popup;
  }

  showCommentEditor(originalComment, popup, callback) {
    popup.innerHTML = `
      <div style="margin-bottom: 12px; font-weight: bold; color: #1da1f2;">
        ✏ Edit Comment
      </div>
      <textarea id="comment-editor" style="width: 100%; height: 60px; padding: 8px; border: 1px solid #ccc; border-radius: 6px; resize: none; font-size: 14px;">${originalComment}</textarea>
      <div style="display: flex; gap: 8px; margin-top: 12px;">
        <button id="save-btn" style="flex: 1; padding: 8px; background: #1da1f2; color: white; border: none; border-radius: 6px; cursor: pointer;">
          ✓ Save
        </button>
        <button id="cancel-btn" style="flex: 1; padding: 8px; background: #657786; color: white; border: none; border-radius: 6px; cursor: pointer;">
          ✕ Cancel
        </button>
      </div>
    `;

    const textarea = popup.querySelector('#comment-editor');
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);

    popup.querySelector('#save-btn').onclick = () => {
      const editedComment = textarea.value.trim();
      if (editedComment) {
        document.body.removeChild(popup);
        callback({ approved: true, editedComment: editedComment });
      }
    };

    popup.querySelector('#cancel-btn').onclick = () => {
      document.body.removeChild(popup);
      callback({ approved: false, editedComment: null });
    };
  }

  async postComment(tweetElement, comment) {
    try {
      console.log('🚀 STARTING COMMENT POSTING - SIMPLIFIED APPROACH');

      // Step 1: Find and click reply button
      const replyButton = this.findReplyButton(tweetElement);
      if (!replyButton) {
        console.log('❌ Reply button not found');
        return false;
      }

      console.log('✅ Found reply button, clicking...');
      await this.humanClick(replyButton);
      await this.humanDelay(2000, 3000); // Wait longer for UI to load

      // Step 2: Wait for ANY contenteditable element to appear
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
      console.log('✅ COMMENT POSTED SUCCESSFULLY!');
      return true;

    } catch (error) {
      console.error('❌ Comment posting failed:', error);
      return false;
    }
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