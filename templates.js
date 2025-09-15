// Comment templates and generation system

class CommentTemplates {
  constructor() {
    this.templates = this.initializeTemplates();
  }

  initializeTemplates() {
    return {
      engagement: [
        "Great point! {emoji}",
        "Thanks for sharing this!",
        "Love this perspective! {emoji}",
        "Really interesting take on this.",
        "This is so helpful, thank you!",
        "Excellent insight! {emoji}",
        "Appreciate you sharing this.",
        "This resonates with me! {emoji}",
        "Well said! {emoji}",
        "Couldn't agree more!"
      ],

      supportive: [
        "You're doing amazing work! {emoji}",
        "Keep up the great content! {emoji}",
        "This is inspiring! {emoji}",
        "Love seeing your progress! {emoji}",
        "You've got this! {emoji}",
        "So proud of your journey! {emoji}",
        "Keep pushing forward! {emoji}",
        "Your dedication shows! {emoji}",
        "Amazing achievement! {emoji}",
        "You're killing it! {emoji}"
      ],

      question: [
        "What's your take on {topic}?",
        "How did you learn this?",
        "Any tips for getting started?",
        "What would you recommend?",
        "How long did this take you?",
        "What's your experience with {topic}?",
        "Any resources you'd suggest?",
        "What challenges did you face?",
        "How do you approach {topic}?",
        "What's next for you?"
      ],

      professional: [
        "Excellent insight on {topic}.",
        "Thank you for sharing your expertise.",
        "This is very valuable information.",
        "Well articulated perspective.",
        "Appreciate this thoughtful analysis.",
        "Great breakdown of {topic}.",
        "Insightful observations here.",
        "This adds significant value.",
        "Professional insight as always.",
        "Comprehensive overview, thank you."
      ],

      industry: {
        tech: [
          "Love seeing innovation in this space!",
          "The future of tech is exciting!",
          "Great technical insight!",
          "This could be a game changer.",
          "Fascinating development!",
          "The possibilities are endless!",
          "Engineering at its finest!",
          "This is the way forward.",
          "Brilliant technical solution!",
          "Innovation never stops!"
        ],

        business: [
          "Smart business strategy!",
          "Great market insight!",
          "This could disrupt the industry.",
          "Excellent ROI thinking.",
          "Strategic brilliance!",
          "Market timing is everything.",
          "Love the business model!",
          "This scales beautifully.",
          "Customer-first approach!",
          "Revenue potential is huge!"
        ],

        lifestyle: [
          "Living your best life! {emoji}",
          "This brings me joy! {emoji}",
          "Such positive vibes! {emoji}",
          "Absolutely beautiful! {emoji}",
          "Goals right here! {emoji}",
          "This made my day! {emoji}",
          "Pure happiness! {emoji}",
          "Life is beautiful! {emoji}",
          "Spreading good energy! {emoji}",
          "This is everything! {emoji}"
        ],

        health: [
          "Health is wealth! {emoji}",
          "Your wellness journey inspires me!",
          "Taking care of yourself first! {emoji}",
          "Mental health matters! {emoji}",
          "Small steps, big changes! {emoji}",
          "Consistency is key! {emoji}",
          "Your body will thank you! {emoji}",
          "Healthy habits for life! {emoji}",
          "Mind, body, soul! {emoji}",
          "Wellness warrior! {emoji}"
        ]
      },

      emojis: {
        positive: ["💯", "🔥", "✨", "💪", "🚀", "⭐", "👏", "🎯", "💡", "🌟"],
        supportive: ["❤️", "🙌", "💙", "🤗", "💖", "🥰", "😊", "🤝", "💕", "🌈"],
        thinking: ["🤔", "💭", "🧠", "💡", "🎯", "📚", "🔍", "⚡", "🎪", "🎨"],
        celebration: ["🎉", "🥳", "🎊", "🏆", "🎈", "🍾", "🎁", "🌟", "💫", "✨"]
      }
    };
  }

  generateComment(postContent, tone = 'casual', context = {}) {
    const category = this.detectCategory(postContent);
    let templates = [];

    // Select templates based on tone and category
    switch (tone) {
      case 'supportive':
        templates = this.templates.supportive;
        break;
      case 'professional':
        templates = this.templates.professional;
        break;
      case 'casual':
      default:
        if (this.templates.industry[category]) {
          templates = [...this.templates.engagement, ...this.templates.industry[category]];
        } else {
          templates = this.templates.engagement;
        }
        break;
    }

    // Add question templates occasionally
    if (Math.random() < 0.3) {
      templates = [...templates, ...this.templates.question];
    }

    // Select random template
    const template = templates[Math.floor(Math.random() * templates.length)];

    // Process template with variables
    return this.processTemplate(template, postContent, context);
  }

  detectCategory(postContent) {
    const content = postContent.toLowerCase();

    const categories = {
      tech: ['coding', 'programming', 'javascript', 'python', 'react', 'ai', 'machine learning', 'software', 'developer', 'tech', 'api', 'database', 'algorithm', 'framework'],
      business: ['startup', 'business', 'marketing', 'sales', 'revenue', 'growth', 'strategy', 'entrepreneur', 'funding', 'investor', 'market', 'customer', 'roi', 'profit'],
      health: ['health', 'fitness', 'workout', 'gym', 'nutrition', 'wellness', 'mental health', 'meditation', 'yoga', 'diet', 'exercise', 'mindfulness'],
      lifestyle: ['life', 'happy', 'family', 'friends', 'vacation', 'travel', 'food', 'coffee', 'weekend', 'fun', 'beautiful', 'amazing', 'love', 'blessed']
    };

    for (const [category, keywords] of Object.entries(categories)) {
      if (keywords.some(keyword => content.includes(keyword))) {
        return category;
      }
    }

    return 'general';
  }

  processTemplate(template, postContent, context) {
    let processed = template;

    // Extract topic from post content
    const topic = this.extractTopic(postContent);
    processed = processed.replace('{topic}', topic);

    // Add emoji if template includes placeholder
    if (processed.includes('{emoji}')) {
      const emojiCategory = this.getEmojiCategory(processed);
      const emojis = this.templates.emojis[emojiCategory] || this.templates.emojis.positive;
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];
      processed = processed.replace('{emoji}', emoji);
    }

    return processed;
  }

  extractTopic(postContent) {
    // Simple topic extraction - get first meaningful noun or phrase
    const words = postContent.toLowerCase().split(' ');
    const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'this', 'that'];

    const meaningfulWords = words.filter(word =>
      word.length > 3 &&
      !stopWords.includes(word) &&
      /^[a-zA-Z]+$/.test(word)
    );

    return meaningfulWords[0] || 'this';
  }

  getEmojiCategory(template) {
    const lowerTemplate = template.toLowerCase();

    if (lowerTemplate.includes('amazing') || lowerTemplate.includes('great') || lowerTemplate.includes('excellent')) {
      return 'celebration';
    }
    if (lowerTemplate.includes('think') || lowerTemplate.includes('take') || lowerTemplate.includes('approach')) {
      return 'thinking';
    }
    if (lowerTemplate.includes('support') || lowerTemplate.includes('love') || lowerTemplate.includes('proud')) {
      return 'supportive';
    }

    return 'positive';
  }

  // Get fallback comment for when AI generation fails
  getFallbackComment(tone = 'casual') {
    const fallbacks = {
      casual: this.templates.engagement,
      supportive: this.templates.supportive,
      professional: this.templates.professional
    };

    const templates = fallbacks[tone] || fallbacks.casual;
    const template = templates[Math.floor(Math.random() * templates.length)];

    return this.processTemplate(template, '', {});
  }

  // Generate multiple comment options
  generateCommentOptions(postContent, tone = 'casual', count = 3) {
    const options = [];

    for (let i = 0; i < count; i++) {
      const comment = this.generateComment(postContent, tone);
      if (!options.includes(comment)) {
        options.push(comment);
      }
    }

    // Fill with fallbacks if needed
    while (options.length < count) {
      const fallback = this.getFallbackComment(tone);
      if (!options.includes(fallback)) {
        options.push(fallback);
      }
    }

    return options;
  }

  // Validate comment quality
  validateComment(comment) {
    const issues = [];

    if (comment.length < 3) {
      issues.push('Too short');
    }

    if (comment.length > 280) {
      issues.push('Too long for Twitter');
    }

    if (comment.includes('@') || comment.includes('#')) {
      issues.push('Contains mentions or hashtags');
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

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = CommentTemplates;
}