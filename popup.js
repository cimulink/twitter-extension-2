// Popup script for Twitter Auto-Engagement Extension

class PopupController {
  constructor() {
    this.settings = {};
    this.status = {
      enabled: false,
      processing: false,
      actionCount: { likes: 0, comments: 0 },
      sessionTime: 0
    };

    this.init();
  }

  async init() {
    await this.loadSettings();
    await this.loadStatus();
    this.setupEventListeners();
    this.updateUI();
    this.startStatusUpdates();
  }

  async loadSettings() {
    try {
      // Try to get settings directly from storage first
      const settings = await chrome.storage.sync.get();
      if (settings && Object.keys(settings).length > 0) {
        this.settings = settings;
        console.log('Loaded settings from storage:', this.settings);
        return;
      }

      // Fallback to background script
      const response = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (response && response.success) {
        this.settings = response.settings;
        console.log('Loaded settings from background:', this.settings);
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Try one more time with direct storage access
      try {
        const fallbackSettings = await chrome.storage.sync.get();
        this.settings = fallbackSettings;
        console.log('Loaded fallback settings:', this.settings);
      } catch (fallbackError) {
        console.error('All settings loading methods failed:', fallbackError);
      }
    }
  }

  async loadStatus() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0] && (tabs[0].url.includes('twitter.com') || tabs[0].url.includes('x.com'))) {
        const response = await chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_STATUS' });
        if (response && response.success) {
          this.status = response.status;
        }
      }
    } catch (error) {
      console.log('Content script not ready or not on Twitter');
    }
  }

  setupEventListeners() {
    // Main toggle
    document.getElementById('mainToggle').addEventListener('click', () => {
      this.toggleExtension();
    });

    // Action toggles
    document.getElementById('likingToggle').addEventListener('click', () => {
      this.toggleLiking();
    });

    document.getElementById('commentingToggle').addEventListener('click', () => {
      this.toggleCommenting();
    });

    document.getElementById('includeImagesToggle').addEventListener('click', () => {
      this.toggleIncludeImages();
    });

    // API key visibility toggle
    document.getElementById('apiKeyToggle').addEventListener('click', () => {
      this.toggleApiKeyVisibility();
    });

    // Save settings button
    document.getElementById('saveSettings').addEventListener('click', () => {
      this.saveSettings();
    });

    // Test API button
    document.getElementById('testAPI').addEventListener('click', () => {
      this.testAPI();
    });

    // Reset counters button
    document.getElementById('resetCounters').addEventListener('click', () => {
      this.resetRateLimits();
    });

    // Auto-save on input changes (excluding API key for security)
    const inputs = ['commentTone', 'actionFrequency', 'aiModel'];
    inputs.forEach(id => {
      const element = document.getElementById(id);
      element.addEventListener('change', () => {
        this.autoSaveSettings();
      });
    });
  }

  updateUI() {
    // Update status indicator
    const statusIndicator = document.getElementById('statusIndicator');
    const mainToggle = document.getElementById('mainToggle');
    const currentStatus = document.getElementById('currentStatus');

    if (this.status.enabled) {
      statusIndicator.className = 'status-indicator active';
      mainToggle.className = 'toggle-switch active';
      if (this.status.processing) {
        currentStatus.textContent = 'Status: Processing posts...';
      } else {
        currentStatus.textContent = 'Status: Active - Monitoring for posts';
      }
    } else {
      statusIndicator.className = 'status-indicator inactive';
      mainToggle.className = 'toggle-switch';
      currentStatus.textContent = 'Status: Inactive';
    }

    // Update stats
    document.getElementById('likesCount').textContent = this.status.actionCount.likes || 0;
    document.getElementById('commentsCount').textContent = this.status.actionCount.comments || 0;

    const sessionMinutes = Math.floor((this.status.sessionTime || 0) / 60000);
    document.getElementById('sessionTime').textContent = `${sessionMinutes}m`;

    const postsProcessed = (this.status.actionCount.likes || 0) + (this.status.actionCount.comments || 0);
    document.getElementById('postsProcessed').textContent = postsProcessed;

    // Update settings inputs
    document.getElementById('apiKey').value = this.settings.openRouterApiKey || '';
    document.getElementById('commentTone').value = this.settings.commentTone || 'casual';
    document.getElementById('actionFrequency').value = this.settings.likeFrequency || 30;
    document.getElementById('aiModel').value = this.settings.aiModel || 'anthropic/claude-3-haiku';

    // Update action toggles
    const likingToggle = document.getElementById('likingToggle');
    const commentingToggle = document.getElementById('commentingToggle');
    const includeImagesToggle = document.getElementById('includeImagesToggle');

    if (this.settings.enableLiking !== false) {
      likingToggle.className = 'toggle-switch small active';
    } else {
      likingToggle.className = 'toggle-switch small';
    }

    if (this.settings.enableCommenting !== false) {
      commentingToggle.className = 'toggle-switch small active';
    } else {
      commentingToggle.className = 'toggle-switch small';
    }

    if (this.settings.includeImages === true) {
      includeImagesToggle.className = 'toggle-switch small active';
    } else {
      includeImagesToggle.className = 'toggle-switch small';
    }
  }

  async toggleExtension() {
    try {
      // Validate settings first
      if (!this.settings.openRouterApiKey) {
        this.showError('Please enter your OpenRouter API key first');
        return;
      }

      const newEnabled = !this.status.enabled;

      // Send toggle message to content script
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0] && (tabs[0].url.includes('twitter.com') || tabs[0].url.includes('x.com'))) {
        await chrome.tabs.sendMessage(tabs[0].id, {
          type: 'TOGGLE_EXTENSION',
          enabled: newEnabled
        });

        // Update settings
        this.settings.enabled = newEnabled;
        await chrome.runtime.sendMessage({
          type: 'UPDATE_SETTINGS',
          settings: { enabled: newEnabled }
        });

        this.status.enabled = newEnabled;
        this.updateUI();

        if (newEnabled) {
          this.showSuccess('Auto-engagement activated!');
        } else {
          this.showSuccess('Auto-engagement deactivated');
        }
      } else {
        this.showError('Please navigate to Twitter/X first');
      }
    } catch (error) {
      console.error('Toggle error:', error);
      this.showError('Failed to toggle extension. Make sure you\'re on Twitter/X.');
    }
  }

  toggleApiKeyVisibility() {
    const apiKeyInput = document.getElementById('apiKey');
    const toggleButton = document.getElementById('apiKeyToggle');

    if (apiKeyInput.type === 'password') {
      apiKeyInput.type = 'text';
      toggleButton.textContent = 'Hide';
    } else {
      apiKeyInput.type = 'password';
      toggleButton.textContent = 'Show';
    }
  }

  async saveSettings() {
    const newSettings = {
      openRouterApiKey: document.getElementById('apiKey').value.trim(),
      commentTone: document.getElementById('commentTone').value,
      likeFrequency: parseInt(document.getElementById('actionFrequency').value),
      aiModel: document.getElementById('aiModel').value
    };

    try {
      // Save directly to storage first (most reliable)
      await chrome.storage.sync.set(newSettings);
      console.log('Settings saved directly to storage:', newSettings);

      // Also notify background script
      try {
        await chrome.runtime.sendMessage({
          type: 'UPDATE_SETTINGS',
          settings: newSettings
        });
      } catch (bgError) {
        console.log('Background script notification failed (but settings still saved):', bgError);
      }

      // Update local settings
      this.settings = { ...this.settings, ...newSettings };
      this.showSuccess('Settings saved successfully!');

      // Verify save by reading back
      const verification = await chrome.storage.sync.get();
      console.log('Settings verification:', verification);

    } catch (error) {
      console.error('Save settings error:', error);
      this.showError('Failed to save settings');
    }
  }

  async autoSaveSettings() {
    // Auto-save with a small delay to avoid excessive saves (excluding API key)
    clearTimeout(this.autoSaveTimeout);
    this.autoSaveTimeout = setTimeout(async () => {
      const newSettings = {
        commentTone: document.getElementById('commentTone').value,
        likeFrequency: parseInt(document.getElementById('actionFrequency').value),
        aiModel: document.getElementById('aiModel').value
      };

      try {
        // Save directly to storage (most reliable)
        await chrome.storage.sync.set(newSettings);
        this.settings = { ...this.settings, ...newSettings };
        console.log('Auto-saved settings:', newSettings);

        // Also notify background script (optional)
        try {
          await chrome.runtime.sendMessage({
            type: 'UPDATE_SETTINGS',
            settings: newSettings
          });
        } catch (bgError) {
          console.log('Background notification failed during auto-save (but settings saved)');
        }
      } catch (error) {
        console.error('Auto-save error:', error);
      }
    }, 1000);
  }

  async testAPI() {
    const apiKey = document.getElementById('apiKey').value.trim();
    const aiModel = document.getElementById('aiModel').value;

    if (!apiKey) {
      this.showError('Please enter an API key first');
      return;
    }

    const testButton = document.getElementById('testAPI');
    testButton.textContent = 'Testing...';
    testButton.disabled = true;

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': chrome.runtime.getURL(''),
          'X-Title': 'Twitter Auto-Engagement Extension'
        },
        body: JSON.stringify({
          model: aiModel,
          messages: [
            {
              role: 'user',
              content: 'Generate a short, friendly comment for a Twitter post about web development. Keep it under 15 words.'
            }
          ],
          max_tokens: 50,
          temperature: 0.7
        })
      });

      if (response.ok) {
        const data = await response.json();
        const testComment = data.choices[0].message.content.trim();
        this.showSuccess(`API test successful! Sample comment: "${testComment}"`);
      } else {
        const errorData = await response.json();
        this.showError(`API test failed: ${errorData.error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('API test error:', error);
      this.showError('API test failed: Network error');
    } finally {
      testButton.textContent = 'Test API';
      testButton.disabled = false;
    }
  }

  startStatusUpdates() {
    // Update status every 5 seconds (reduced frequency to prevent reloading)
    this.statusInterval = setInterval(async () => {
      try {
        await this.loadStatus();
        this.updateUI();
      } catch (error) {
        console.log('Status update failed (this is normal if tab changed):', error);
      }
    }, 5000);

    // Stop updates when popup closes
    window.addEventListener('beforeunload', () => {
      if (this.statusInterval) {
        clearInterval(this.statusInterval);
      }
    });
  }

  showError(message) {
    const errorEl = document.getElementById('errorMessage');
    const successEl = document.getElementById('successMessage');

    successEl.style.display = 'none';
    errorEl.textContent = message;
    errorEl.style.display = 'block';

    setTimeout(() => {
      errorEl.style.display = 'none';
    }, 5000);
  }

  async toggleLiking() {
    try {
      const newLikingState = this.settings.enableLiking === false ? true : false;

      await chrome.storage.sync.set({ enableLiking: newLikingState });
      this.settings.enableLiking = newLikingState;

      // Notify content script
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0] && (tabs[0].url.includes('twitter.com') || tabs[0].url.includes('x.com'))) {
        await chrome.tabs.sendMessage(tabs[0].id, {
          type: 'UPDATE_SETTINGS',
          settings: { enableLiking: newLikingState }
        });
      }

      this.updateUI();
      this.showSuccess(`Auto-liking ${newLikingState ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Toggle liking error:', error);
      this.showError('Failed to toggle liking');
    }
  }

  async toggleCommenting() {
    try {
      const newCommentingState = this.settings.enableCommenting === false ? true : false;

      await chrome.storage.sync.set({ enableCommenting: newCommentingState });
      this.settings.enableCommenting = newCommentingState;

      // Notify content script
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0] && (tabs[0].url.includes('twitter.com') || tabs[0].url.includes('x.com'))) {
        await chrome.tabs.sendMessage(tabs[0].id, {
          type: 'UPDATE_SETTINGS',
          settings: { enableCommenting: newCommentingState }
        });
      }

      this.updateUI();
      this.showSuccess(`Auto-commenting ${newCommentingState ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Toggle commenting error:', error);
      this.showError('Failed to toggle commenting');
    }
  }

  async toggleIncludeImages() {
    try {
      const newIncludeImagesState = this.settings.includeImages !== true ? true : false;

      await chrome.storage.sync.set({ includeImages: newIncludeImagesState });
      this.settings.includeImages = newIncludeImagesState;

      // Notify content script
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0] && (tabs[0].url.includes('twitter.com') || tabs[0].url.includes('x.com'))) {
        await chrome.tabs.sendMessage(tabs[0].id, {
          type: 'UPDATE_SETTINGS',
          settings: { includeImages: newIncludeImagesState }
        });
      }

      this.updateUI();
      this.showSuccess(`Include image posts ${newIncludeImagesState ? 'enabled' : 'disabled'}`);
    } catch (error) {
      console.error('Toggle include images error:', error);
      this.showError('Failed to toggle include images');
    }
  }

  async resetRateLimits() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tabs[0] && (tabs[0].url.includes('twitter.com') || tabs[0].url.includes('x.com'))) {
        await chrome.tabs.sendMessage(tabs[0].id, {
          type: 'RESET_RATE_LIMITS'
        });

        this.showSuccess('Rate limits reset successfully!');

        // Refresh status
        await this.loadStatus();
        this.updateUI();
      } else {
        this.showError('Please navigate to Twitter/X first');
      }
    } catch (error) {
      console.error('Reset rate limits error:', error);
      this.showError('Failed to reset rate limits');
    }
  }

  showSuccess(message) {
    const errorEl = document.getElementById('errorMessage');
    const successEl = document.getElementById('successMessage');

    errorEl.style.display = 'none';
    successEl.textContent = message;
    successEl.style.display = 'block';

    setTimeout(() => {
      successEl.style.display = 'none';
    }, 3000);
  }
}

// Initialize popup when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});