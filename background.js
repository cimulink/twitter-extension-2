// Background service worker for Twitter Auto-Engagement Extension

// Intelligent Commenting System - Inline for service worker compatibility
class IntelligentCommentGenerator {
  constructor() {
    // Persona is now defined in persona.md and used directly in buildIntelligentPrompt
  }

  analyzeContent(content) {
    const lowerContent = content.toLowerCase();

    // AGGRESSIVE POLITICAL CONTENT DETECTION
    const politicalKeywords = [
      'trump', 'biden', 'democrat', 'republican', 'conservative', 'liberal',
      'election', 'vote', 'voting', 'ballot', 'campaign', 'politician',
      'politics', 'political', 'congress', 'senate', 'house', 'government',
      'gop', 'dnc', 'maga', 'blm', 'antifa', 'immigration', 'border',
      'abortion', 'gun control', 'climate change', 'healthcare reform',
      'taxes', 'welfare', 'socialism', 'capitalism', 'fascism', 'communism',
      'president', 'governor', 'mayor', 'covid policy', 'mandate',
      'protest', 'rally', 'march', 'activism', 'justice', 'rights',
      'constitution', 'amendment', 'supreme court', 'federal', 'state policy'
    ];

    // Check for political content
    for (const keyword of politicalKeywords) {
      if (lowerContent.includes(keyword)) {
        console.log(`❌ POLITICAL CONTENT DETECTED: "${keyword}" - SKIPPING`);
        return {
          topics: ['political'],
          responseType: 'skip',
          shouldRespond: false,
          reasoning: `Contains political keyword: ${keyword}`
        };
      }
    }

    const analysis = {
      topics: ['general'], // Always assume general relevance
      responseType: 'engagement',
      shouldRespond: true, // ALWAYS TRUE - let AI decide after political check
      reasoning: 'Passed political filter, sending to AI for evaluation'
    };

    console.log('🔍 Sending content to AI for evaluation:', lowerContent);

    // Determine response type based on content patterns
    if (lowerContent.includes('?') || lowerContent.includes('how') || lowerContent.includes('what') || lowerContent.includes('why')) {
      analysis.responseType = 'helpful-answer';
    } else if (lowerContent.includes('struggling') || lowerContent.includes('help') || lowerContent.includes('stuck')) {
      analysis.responseType = 'supportive-advice';
    } else if (lowerContent.includes('built') || lowerContent.includes('shipped') || lowerContent.includes('launched')) {
      analysis.responseType = 'constructive-feedback';
    } else {
      analysis.responseType = 'thoughtful-engagement';
    }

    console.log('✅ Content passed to AI - no pre-filtering');
    return analysis;
  }

  buildIntelligentPrompt(content, analysis) {
    if (!analysis.shouldRespond) return null;

    const responseGuidance = this.getResponseGuidance(analysis.responseType);

    // Check if content includes image context
    const hasImageContext = content.includes('[Image context:');
    const imageInstructions = hasImageContext ?
      '\n- Consider the visual context when responding\n- Reference the image/media if relevant to your expertise' : '';

    const simplePrompt = `You must generate a casual reply to this specific tweet. Reply within 20 words, no emojis, ENGLISH ONLY. AVOID ALL POLITICAL CONTENT. The tweet you are replying to is: "${content}"`;

    return simplePrompt;
  }


  getResponseGuidance(responseType) {
    const guidance = {
      "helpful-answer": "Provide a concise, practical answer based on your experience. Share a specific insight or approach.",
      "supportive-advice": "Offer constructive guidance. Share a quick win or perspective that might help.",
      "constructive-feedback": "Acknowledge the achievement and add a thoughtful observation or question that could be valuable.",
      "expert-insight": "Share a specific technical insight or trade-off from your experience. Be concrete.",
      "thoughtful-engagement": "Ask a probing question or share a brief related insight that advances the conversation."
    };

    return guidance[responseType] || "Engage thoughtfully with a perspective that adds value to the discussion.";
  }

  generateFallbackComment(analysis) {
    if (analysis.topics.length > 0) {
      const topic = analysis.topics[0].topic;
      const fallbacks = {
        "distributed-systems": "What's your approach to handling the consistency/availability trade-offs here?",
        "backend-engineering": "Performance considerations are often overlooked early on. How are you thinking about this?",
        "ai-infrastructure": "The infrastructure challenges here are interesting. What's your scaling strategy?",
        "fintech": "Regulatory compliance adds complexity. How are you handling that aspect?",
        "startup": "Trade-offs are everything in early stage. What's driving this decision?",
        "engineering-culture": "Team dynamics matter more than tech choices. How's the team thinking about this?",
        "tech-trends": "Business value should drive tech decisions. What problem does this solve?"
      };

      return fallbacks[topic] || "Interesting perspective. What led you to this approach?";
    }

    return "What's the thinking behind this?";
  }

  // Check if comment is in English only
  isEnglishOnly(comment) {
    if (!comment || typeof comment !== 'string') {
      console.log('❌ Language check failed: Invalid comment');
      return false;
    }

    // Basic English character check - allow only Latin characters, numbers, and common punctuation
    const englishRegex = /^[a-zA-Z0-9\s\.,!?;:'"()\-_&@#$%\+\=\[\]\{\}\/\\`~\*]*$/;

    if (!englishRegex.test(comment)) {
      console.log('❌ Language check failed: Contains non-English characters');
      console.log(`🔍 Problematic comment: "${comment}"`);
      return false;
    }

    // Check for common non-English words/patterns
    const nonEnglishPatterns = [
      // Common non-English greetings/words
      /\b(hola|bonjour|guten|ciao|नमस्ते|こんにちは|你好|مرحبا|привет|hej|здравствуйте)\b/i,
      // Arabic/Hebrew patterns
      /[\u0600-\u06FF\u0590-\u05FF]/,
      // Chinese/Japanese/Korean characters
      /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/,
      // Cyrillic
      /[\u0400-\u04FF]/,
      // Other common scripts
      /[\u0100-\u017F\u1E00-\u1EFF]/
    ];

    for (const pattern of nonEnglishPatterns) {
      if (pattern.test(comment)) {
        console.log('❌ Language check failed: Detected non-English pattern');
        console.log(`🔍 Pattern detected in: "${comment}"`);
        return false;
      }
    }

    console.log('✅ Language check passed: English only');
    return true;
  }

  // Validate comment to ensure quality and compliance
  validateComment(comment) {
    if (!comment || typeof comment !== 'string') {
      console.log('❌ Comment validation failed: Invalid comment');
      return false;
    }

    // Check for hashtags
    if (comment.includes('#')) {
      console.log('❌ Comment validation failed: Contains hashtags');
      return false;
    }

    // Check for @mentions (unless it's a direct reply context)
    if (comment.includes('@')) {
      console.log('❌ Comment validation failed: Contains @mentions');
      return false;
    }

    // Check for generic/spam phrases
    const spamPhrases = [
      'great post', 'thanks for sharing', 'love this', 'awesome',
      'totally agree', 'this is amazing', 'so true', 'exactly',
      'follow me', 'check out', 'link in bio', 'dm me'
    ];

    const lowerComment = comment.toLowerCase();
    for (const phrase of spamPhrases) {
      if (lowerComment.includes(phrase)) {
        console.log(`❌ Comment validation failed: Contains spam phrase "${phrase}"`);
        return false;
      }
    }

    // Check length
    if (comment.length < 10) {
      console.log('❌ Comment validation failed: Too short');
      return false;
    }

    if (comment.length > 280) {
      console.log('❌ Comment validation failed: Too long');
      return false;
    }

    console.log('✅ Comment passed validation');
    return true;
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
        enableLiking: true,
        enableCommenting: true,
        includeImages: false, // Default to text-only for safety
        fullAutoMode: false, // Default to manual approval mode
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
          const result = await this.generateCommentWithIntelligence(message.postContent, message.settings);
          if (result && result.comment) {
            sendResponse({ success: true, comment: result.comment });
          } else if (result && result.error) {
            sendResponse({ success: false, error: result.error });
          } else {
            sendResponse({ success: false, error: 'Unknown error in comment generation' });
          }
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
    // No template fallback - intelligent generation only
    console.log('❌ Template fallback disabled - intelligent generation only');
    return null;
  }

  // Enhanced comment generation with intelligent analysis
  async generateCommentWithIntelligence(postContent, settings) {
    if (!this.intelligentGenerator) {
      this.intelligentGenerator = new IntelligentCommentGenerator();
    }


    try {
      console.log('🧠 Analyzing content for intelligent response...');
      console.log('📝 Post content:', postContent);

      // Analyze content first
      const analysis = this.intelligentGenerator.analyzeContent(postContent);

      console.log('🔍 Analysis result:', {
        shouldRespond: analysis.shouldRespond,
        reasoning: analysis.reasoning,
        responseType: analysis.responseType
      });

      if (!analysis.shouldRespond) {
        const errorMsg = `❌ Skipping comment: ${analysis.reasoning}`;
        console.log(errorMsg);
        return { error: errorMsg };
      }

      console.log(`✅ Content analysis: AI will decide relevance (${analysis.responseType})`);

      // Build intelligent prompt
      const intelligentPrompt = this.intelligentGenerator.buildIntelligentPrompt(postContent, analysis);
      let aiComment = null; // Declare aiComment in the broader scope

      if (intelligentPrompt) {
        // Try AI with intelligent prompt
        aiComment = await this.generateCommentWithPrompt(intelligentPrompt, settings);

        if (aiComment && aiComment.startsWith('SKIP_NOT_RELEVANT')) {
          let reason = 'No specific reason provided';
          if (aiComment.includes(':')) {
            reason = aiComment.split(':')[1].trim();
          }
          const errorMsg = `🤖 AI determined content not relevant for engagement: ${reason}`;
          console.log(errorMsg);
          return { error: errorMsg };
        } else if (aiComment && aiComment.length > 1 && aiComment.length < 280 && this.intelligentGenerator.validateComment(aiComment) && this.intelligentGenerator.isEnglishOnly(aiComment)) {
          console.log('✅ Generated intelligent AI comment');
          return { comment: aiComment };
        } else {
          const validationResult = this.intelligentGenerator.validateComment(aiComment);
          let errorMsg = `⚠️ AI comment failed validation: Length=${aiComment?.length || 0}`;

          // Log the actual AI response for debugging
          console.log(`🔍 RAW AI RESPONSE: "${aiComment}"`);
          console.log(`🔍 AI RESPONSE TYPE: ${typeof aiComment}`);

          if (!aiComment) {
            errorMsg += ' (AI returned null/empty response)';
          } else if (aiComment.length <= 1) {
            errorMsg += ' (Too short)';
          } else if (aiComment.length >= 280) {
            errorMsg += ' (Too long)';
          } else if (!this.intelligentGenerator.isEnglishOnly(aiComment)) {
            errorMsg += ' (Failed language check - not English only)';
          } else if (!validationResult) {
            errorMsg += ' (Failed content validation - check console for details)';
          }

          console.log(errorMsg);
          // Continue to fallback instead of returning error
        }
      }

      // No fallback - if AI can't generate a good comment, skip it
      const errorMsg = `⚡ AI generation failed - no suitable comment generated. AI returned: "${aiComment || 'null/undefined'}"`;
      console.log(errorMsg);
      return { error: errorMsg };

    } catch (error) {
      const errorMsg = `❌ Exception in comment generation: ${error.message}`;
      console.error('Intelligent comment generation failed:', error);
      return { error: errorMsg };
    }
  }

  async generateCommentWithPrompt(prompt, settings) {
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
          max_tokens: 150,
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error(`Invalid API response format: ${JSON.stringify(data)}`);
      }

      const comment = data.choices[0].message.content.trim();
      console.log('🤖 AI Response:', comment);
      return comment;
    } catch (error) {
      console.error('OpenRouter API call failed:', error);
      throw error;
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