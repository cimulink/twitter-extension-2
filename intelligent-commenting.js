// Intelligent Commenting System - Based on Ajay's Persona

class IntelligentCommentGenerator {
  constructor() {
    this.persona = {
      identity: "Software Architect & Founder with 10+ years in distributed systems",
      expertise: ["distributed-systems", "backend-engineering", "ai-infrastructure", "fintech", "scalability"],
      tone: "analytical, mentor-like, credible, grounded",
      writingStyle: {
        casual: true,
        concise: true,
        activeVoice: true,
        maxLength: 280,
        firstPrinciples: true,
        businessOriented: true
      }
    };

    this.topicDetection = {
      "distributed-systems": ["microservices", "monolith", "architecture", "scalability", "distributed", "system design", "caching", "database", "event sourcing", "cqrs", "saga"],
      "backend-engineering": ["api", "backend", "server", "database", "performance", "optimization", "spring boot", "python", "java", "kotlin", "fastapi"],
      "ai-infrastructure": ["ai", "ml", "model", "llm", "infrastructure", "data pipeline", "spark", "training", "deployment"],
      "fintech": ["fintech", "payments", "banking", "financial", "transactions", "fraud", "compliance", "security"],
      "startup": ["startup", "founder", "business", "growth", "scale", "team", "product", "mvp"],
      "engineering-culture": ["team", "engineering", "culture", "hiring", "remote", "leadership", "management"],
      "tech-trends": ["trends", "hype", "technology", "innovation", "future", "ai revolution", "web3", "blockchain"]
    };
  }

  // First check if it's a text-only post we can meaningfully respond to
  isTextOnlyPost(tweetElement) {
    try {
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

      for (const selector of mediaSelectors) {
        if (tweetElement.querySelector(selector)) {
          console.log(`❌ Post contains media (${selector}) - skipping`);
          return false;
        }
      }

      // Get text content
      const textContent = this.extractTextContent(tweetElement);

      // Must have meaningful text (at least 10 characters, not just links/mentions)
      const meaningfulText = textContent.replace(/@\w+/g, '').replace(/https?:\/\/\S+/g, '').trim();

      if (meaningfulText.length < 10) {
        console.log('❌ Post lacks meaningful text content');
        return false;
      }

      console.log('✅ Text-only post detected');
      return true;
    } catch (error) {
      console.log('❌ Error analyzing post type:', error);
      return false;
    }
  }

  extractTextContent(tweetElement) {
    const textSelectors = [
      '[data-testid="tweetText"]',
      '.tweet-text',
      '[lang]'
    ];

    for (const selector of textSelectors) {
      const textElement = tweetElement.querySelector(selector);
      if (textElement && textElement.textContent.trim()) {
        return textElement.textContent.trim();
      }
    }

    return tweetElement.textContent.trim();
  }

  // Analyze content and determine best response strategy
  analyzeContent(content) {
    const analysis = {
      topics: [],
      tone: 'neutral',
      responseType: 'engagement',
      confidence: 0,
      shouldRespond: true,
      reasoning: ''
    };

    const lowerContent = content.toLowerCase();

    // Detect topics based on expertise areas
    for (const [topic, keywords] of Object.entries(this.topicDetection)) {
      const matches = keywords.filter(keyword => lowerContent.includes(keyword)).length;
      if (matches > 0) {
        analysis.topics.push({
          topic,
          relevance: matches / keywords.length,
          matches
        });
      }
    }

    // Sort topics by relevance
    analysis.topics.sort((a, b) => b.relevance - a.relevance);

    // Determine response strategy based on content analysis
    if (analysis.topics.length === 0) {
      analysis.shouldRespond = false;
      analysis.reasoning = 'No relevant expertise topics detected';
      return analysis;
    }

    const primaryTopic = analysis.topics[0];
    analysis.confidence = primaryTopic.relevance;

    // Determine response type based on content patterns
    if (lowerContent.includes('?') || lowerContent.includes('how') || lowerContent.includes('what') || lowerContent.includes('why')) {
      analysis.responseType = 'helpful-answer';
    } else if (lowerContent.includes('struggling') || lowerContent.includes('help') || lowerContent.includes('stuck')) {
      analysis.responseType = 'supportive-advice';
    } else if (lowerContent.includes('wrong') || lowerContent.includes('bad') || lowerContent.includes('terrible')) {
      analysis.responseType = 'thoughtful-counterpoint';
    } else if (lowerContent.includes('built') || lowerContent.includes('shipped') || lowerContent.includes('launched')) {
      analysis.responseType = 'constructive-feedback';
    } else if (primaryTopic.relevance > 0.3) {
      analysis.responseType = 'expert-insight';
    } else {
      analysis.responseType = 'thoughtful-engagement';
    }

    analysis.reasoning = `Primary topic: ${primaryTopic.topic} (${Math.round(primaryTopic.relevance * 100)}% relevance)`;
    return analysis;
  }

  // Generate intelligent comment based on analysis
  generateComment(content, analysis) {
    if (!analysis.shouldRespond) {
      return null;
    }

    const primaryTopic = analysis.topics[0];
    const responseType = analysis.responseType;

    // Build context for AI prompt
    const prompt = this.buildPersonaPrompt(content, primaryTopic, responseType);

    return {
      prompt,
      fallback: this.generateFallbackComment(content, analysis),
      metadata: {
        topic: primaryTopic.topic,
        responseType,
        confidence: analysis.confidence
      }
    };
  }

  buildPersonaPrompt(content, primaryTopic, responseType) {
    const expertiseContext = this.getExpertiseContext(primaryTopic.topic);
    const responseGuidance = this.getResponseGuidance(responseType);

    return `You are Ajay, a software architect and founder with 10+ years in distributed systems, having worked at FinTech unicorn Slice, Arcesium, Prudential, and SAP. You founded Cimulink.

TWEET TO RESPOND TO:
"${content}"

CONTEXT:
- Topic detected: ${primaryTopic.topic}
- Response type: ${responseType}
- Your expertise: ${expertiseContext}

RESPONSE GUIDANCE:
${responseGuidance}

WRITING STYLE REQUIREMENTS:
- Write like you'd speak (casual but smart)
- Active voice, not passive
- Under 280 characters
- First-principles thinking
- Add genuine value
- Mentor-like tone
- No buzzwords or hype

WHAT NOT TO DO:
- Don't just agree or disagree
- Don't use generic responses
- Don't overshare credentials
- Don't be salesy

Generate a thoughtful response that adds real value:`;
  }

  getExpertiseContext(topic) {
    const contexts = {
      "distributed-systems": "Deep experience scaling systems at FinTech companies, optimizing database connections for millions of users, implementing SAGA patterns and event sourcing",
      "backend-engineering": "Led performance optimizations at Slice, built resilient systems with Spring Boot/Python, expertise in CI/CD with Kubernetes",
      "ai-infrastructure": "Focus on the systems that support AI models - state management for agents, scalable data pipelines, not the models themselves",
      "fintech": "Built and scaled payment systems at unicorn FinTech Slice, understand regulatory compliance and fraud detection challenges",
      "startup": "Founder experience building from 0 to scale, understand technical and business trade-offs",
      "engineering-culture": "Led engineering teams across multiple high-growth companies, hiring and culture expert",
      "tech-trends": "Pragmatic perspective on technology trends, focused on business value over hype"
    };

    return contexts[topic] || "Broad experience across backend systems, distributed architecture, and scaling challenges";
  }

  getResponseGuidance(responseType) {
    const guidance = {
      "helpful-answer": "Provide a concise, practical answer based on your experience. Share a specific insight or approach.",
      "supportive-advice": "Offer constructive guidance. Share a quick win or perspective that might help.",
      "thoughtful-counterpoint": "Present a nuanced alternative view. Use first-principles thinking to add depth.",
      "constructive-feedback": "Acknowledge the achievement and add a thoughtful observation or question that could be valuable.",
      "expert-insight": "Share a specific technical insight or trade-off from your experience. Be concrete.",
      "thoughtful-engagement": "Ask a probing question or share a brief related insight that advances the conversation."
    };

    return guidance[responseType] || "Engage thoughtfully with a perspective that adds value to the discussion.";
  }

  generateFallbackComment(content, analysis) {
    // Simple fallback based on detected topic
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

  // Validate generated comment
  validateComment(comment) {
    if (!comment || comment.length < 5) {
      return { valid: false, reason: "Too short" };
    }

    if (comment.length > 280) {
      return { valid: false, reason: "Too long for Twitter" };
    }

    // Check for generic phrases
    const genericPhrases = [
      "great post", "thanks for sharing", "love this", "awesome",
      "totally agree", "this is amazing", "so true", "exactly"
    ];

    const lowerComment = comment.toLowerCase();
    for (const phrase of genericPhrases) {
      if (lowerComment.includes(phrase)) {
        return { valid: false, reason: "Too generic" };
      }
    }

    // Check for value-adding elements
    const valueIndicators = [
      "?", "how", "what", "why", "experience", "approach", "consider",
      "trade-off", "challenge", "perspective", "think", "strategy"
    ];

    const hasValue = valueIndicators.some(indicator => lowerComment.includes(indicator));
    if (!hasValue) {
      return { valid: false, reason: "Lacks value-adding elements" };
    }

    return { valid: true };
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = IntelligentCommentGenerator;
}