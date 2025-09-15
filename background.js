// Background service worker for Twitter Auto-Engagement Extension

// Import templates (for service worker, we'll need to implement it differently)
// Since service workers can't import ES modules directly, we'll include the class inline

class CommentTemplates {
  constructor() {
    this.templates = this.initializeTemplates();
  }

  initializeTemplates() {
    return {
      engagement: [
        "Great point! 💯",
        "Thanks for sharing this!",
        "Love this perspective! ✨",
        "Really interesting take on this.",
        "This is so helpful, thank you!",
        "Excellent insight! 🔥",
        "Appreciate you sharing this.",
        "This resonates with me! 💪",
        "Well said! ⭐",
        "Couldn't agree more!"
      ],
      supportive: [
        "You're doing amazing work! 🙌",
        "Keep up the great content! 💯",
        "This is inspiring! ✨",
        "Love seeing your progress! 🚀",
        "You've got this! 💪",
        "So proud of your journey! ❤️",
        "Keep pushing forward! 🔥",
        "Your dedication shows! ⭐",
        "Amazing achievement! 🎉",
        "You're killing it! 💫"
      ],
      question: [
        "What's your take on this?",
        "How did you learn this?",
        "Any tips for getting started?",
        "What would you recommend?",
        "How long did this take you?",
        "What's your experience with this?",
        "Any resources you'd suggest?",
        "What challenges did you face?",
        "How do you approach this?",
        "What's next for you?"
      ],
      professional: [
        "Excellent insight.",
        "Thank you for sharing your expertise.",
        "This is very valuable information.",
        "Well articulated perspective.",
        "Appreciate this thoughtful analysis.",
        "Great breakdown here.",
        "Insightful observations.",
        "This adds significant value.",
        "Professional insight as always.",
        "Comprehensive overview, thank you."
      ]
    };
  }

  generateComment(postContent, tone = 'casual') {
    let templates = [];

    switch (tone) {
      case 'supportive':
        templates = this.templates.supportive;
        break;
      case 'professional':
        templates = this.templates.professional;
        break;
      case 'casual':
      default:
        templates = this.templates.engagement;
        // Add question templates occasionally
        if (Math.random() < 0.3) {
          templates = [...templates, ...this.templates.question];
        }
        break;
    }

    return templates[Math.floor(Math.random() * templates.length)];
  }

  getFallbackComment(tone) {
    const templates = {
      casual: this.templates.engagement,
      supportive: this.templates.supportive,
      professional: this.templates.professional
    };

    const selectedTemplates = templates[tone] || templates.casual;
    return selectedTemplates[Math.floor(Math.random() * selectedTemplates.length)];
  }

  validateComment(comment) {
    const issues = [];

    if (comment.length < 3) {
      issues.push('Too short');
    }

    if (comment.length > 280) {
      issues.push('Too long for Twitter');
    }

    const spamKeywords = ['follow', 'subscribe', 'check out', 'link in bio', 'dm me', 'buy now'];
    if (spamKeywords.some(keyword => comment.toLowerCase().includes(keyword))) {
      issues.push('Looks like spam');
    }

    return {
      valid: issues.length === 0,
      issues: issues
    };
  }
}

class BackgroundService {
  constructor() {
    this.init();
  }

  init() {
    // Listen for extension installation
    chrome.runtime.onInstalled.addListener(() => {
      this.setDefaultSettings();
    });

    // Listen for messages from content script
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message, sender, sendResponse);
      return true; // Keep message channel open for async response
    });
  }

  async setDefaultSettings() {
    // Only set defaults if no settings exist yet
    const existingSettings = await chrome.storage.sync.get();

    if (Object.keys(existingSettings).length === 0) {
      console.log('No existing settings found, setting defaults');
      const defaultSettings = {
        enabled: false,
        openRouterApiKey: '',
        commentTone: 'casual',
        likeFrequency: 15, // seconds between likes (reduced from 30)
        commentTypes: ['engagement', 'supportive', 'question'],
        maxLikesPerHour: 100, // increased from 50
        skipProbability: 0.10 // reduced from 15% to 10%
      };

      await chrome.storage.sync.set(defaultSettings);
      console.log('Default settings saved');
    } else {
      console.log('Existing settings found, not overwriting:', existingSettings);
    }
  }

  async handleMessage(message, sender, sendResponse) {
    try {
      switch (message.type) {
        case 'GENERATE_COMMENT':
          const comment = await this.generateCommentWithTemplates(message.postContent, message.settings);
          sendResponse({ success: true, comment });
          break;

        case 'GET_SETTINGS':
          const settings = await chrome.storage.sync.get();
          sendResponse({ success: true, settings });
          break;

        case 'UPDATE_SETTINGS':
          await chrome.storage.sync.set(message.settings);
          sendResponse({ success: true });
          break;

        case 'LOG_ACTION':
          await this.logAction(message.action, message.data);
          sendResponse({ success: true });
          break;

        default:
          sendResponse({ success: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Background service error:', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  async generateComment(postContent, settings) {
    if (!settings.openRouterApiKey) {
      throw new Error('OpenRouter API key not configured');
    }

    const prompt = this.buildCommentPrompt(postContent, settings);

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${settings.openRouterApiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': chrome.runtime.getURL(''),
          'X-Title': 'Twitter Auto-Engagement Extension'
        },
        body: JSON.stringify({
          model: settings.aiModel || 'anthropic/claude-3-haiku',
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 100,
          temperature: 0.8
        })
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API error: ${response.status}`);
      }

      const data = await response.json();
      return data.choices[0].message.content.trim();
    } catch (error) {
      console.error('Comment generation error:', error);
      return this.getFallbackComment(settings.commentTone, postContent);
    }
  }

  buildCommentPrompt(postContent, settings) {
    const toneInstructions = {
      casual: 'casual and friendly',
      professional: 'professional and insightful',
      supportive: 'encouraging and supportive'
    };

    return `Generate a short, engaging Twitter comment (5-20 words) in a ${toneInstructions[settings.commentTone]} tone for this post:

"${postContent}"

Requirements:
- Be genuine and relevant to the post content
- Sound natural and human
- Avoid generic responses
- Don't use hashtags or mentions
- Keep it conversational

Comment:`;
  }

  getFallbackComment(tone, postContent = '') {
    // Load template system
    if (!this.commentTemplates) {
      this.commentTemplates = new CommentTemplates();
    }

    // Try to generate from templates first
    if (postContent) {
      const templateComment = this.commentTemplates.generateComment(postContent, tone);
      const validation = this.commentTemplates.validateComment(templateComment);

      if (validation.valid) {
        return templateComment;
      }
    }

    // Fallback to simple comments
    return this.commentTemplates.getFallbackComment(tone);
  }

  // Enhanced comment generation with templates
  async generateCommentWithTemplates(postContent, settings) {
    if (!this.commentTemplates) {
      this.commentTemplates = new CommentTemplates();
    }

    try {
      // First try AI generation
      const aiComment = await this.generateComment(postContent, settings);

      // Validate AI comment
      const validation = this.commentTemplates.validateComment(aiComment);

      if (validation.valid) {
        return aiComment;
      } else {
        console.log('AI comment failed validation:', validation.issues);
        // Fall back to template system
        return this.commentTemplates.generateComment(postContent, settings.commentTone);
      }
    } catch (error) {
      console.error('AI comment generation failed:', error);
      // Fall back to template system
      return this.commentTemplates.generateComment(postContent, settings.commentTone);
    }
  }

  async logAction(action, data) {
    const timestamp = new Date().toISOString();
    const logEntry = { timestamp, action, data };

    // Get existing logs
    const result = await chrome.storage.local.get(['actionLog']);
    const actionLog = result.actionLog || [];

    // Add new entry
    actionLog.push(logEntry);

    // Keep only last 1000 entries
    if (actionLog.length > 1000) {
      actionLog.splice(0, actionLog.length - 1000);
    }

    // Save back to storage
    await chrome.storage.local.set({ actionLog });
  }
}

// Initialize the background service
new BackgroundService();