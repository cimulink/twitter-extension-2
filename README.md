# Twitter Auto-Engagement Chrome Extension

A Chrome extension that automates Twitter engagement with AI-powered comments and human-like behavior.

## Features

- 🤖 **AI-Powered Comments**: Generate contextual comments using OpenRouter AI models
- 👍 **Auto-Liking**: Automatically like posts with human-like timing
- 🔍 **Comment Review**: Preview and approve comments before posting
- 🕐 **Human Behavior**: Random delays and natural interaction patterns
- ⚙️ **Customizable**: Adjustable settings for tone, frequency, and AI models

## Setup Instructions

### 1. Get OpenRouter API Key

1. Visit [OpenRouter.ai](https://openrouter.ai/)
2. Sign up for an account
3. Go to the API Keys section
4. Create a new API key and copy it

### 2. Install the Extension

#### Option A: Load as Unpacked Extension (Development)

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" in the top right
3. Click "Load unpacked"
4. Select the extension folder (`twitter-extension-2`)
5. The extension should now appear in your extensions list

#### Option B: Install from Chrome Web Store (Future)

*Will be available after publishing to Chrome Web Store*

### 3. Configure the Extension

1. Click the extension icon in your Chrome toolbar
2. Enter your OpenRouter API key
3. Choose your preferred settings:
   - **Comment Tone**: Casual, Professional, or Supportive
   - **Action Frequency**: How often to perform actions (15s - 5m)
   - **AI Model**: Enter the full OpenRouter model name (e.g. anthropic/claude-3-haiku)
4. Click "Save Settings"
5. Test your API connection with the "Test API" button

### 4. Start Using

1. Navigate to [Twitter](https://twitter.com) or [X](https://x.com)
2. Click the extension icon
3. Toggle "Auto-Engagement" to ON
4. The extension will start monitoring and engaging with posts
5. Review and approve comments in the popup that appears

## How It Works

### Auto-Liking
- Scans Twitter feed for new posts
- Applies human-like delays (5-30 seconds between actions)
- Skips already-liked posts
- Rate limited to 50 likes per hour

### AI Comments
- Extracts post content and context
- Generates relevant comments using OpenRouter AI
- Shows preview popup for approval
- Posts comment with human-like typing simulation

### Human Behavior Simulation
- Random delays between actions
- Mouse hover effects before clicking
- Natural scrolling patterns
- Occasional post skipping (15% chance)
- Reading time calculation based on content length

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| API Key | Your OpenRouter API key | Required |
| Comment Tone | Style of generated comments | Casual |
| Action Frequency | Delay between actions | 30 seconds |
| AI Model | Full OpenRouter model name | anthropic/claude-3-haiku |
| Max Likes/Hour | Rate limiting for likes | 50 |

## Supported AI Models

You can use any model available on OpenRouter by entering the full model name. Popular options include:

- **anthropic/claude-3-haiku** (Fast, cost-effective)
- **anthropic/claude-3-sonnet** (Balanced quality/speed)
- **anthropic/claude-3-opus** (Highest quality)
- **openai/gpt-3.5-turbo** (Fast, reliable)
- **openai/gpt-4** (High quality)
- **openai/gpt-4-turbo** (Latest GPT-4 model)
- **meta-llama/llama-2-70b-chat** (Open source alternative)
- **google/gemini-pro** (Google's model)

Visit [OpenRouter Models](https://openrouter.ai/models) for the complete list of available models.

## Safety Features

- Rate limiting to avoid being flagged
- Human-like behavior patterns
- Comment review before posting
- Session tracking and limits
- Skip probability to avoid predictable patterns

## Troubleshooting

### Extension Not Working
1. Make sure you're on Twitter.com or X.com
2. Check that the extension is enabled
3. Verify your API key is correct
4. Open Developer Tools (F12) and check console for errors

### Comments Not Posting
1. Ensure the comment review popup is approved
2. Check that Twitter's compose box is accessible
3. Verify you're not rate limited by Twitter
4. Try refreshing the page and restarting the extension

### API Errors
1. Verify your OpenRouter API key is valid
2. Check your OpenRouter account balance
3. Try a different AI model
4. Ensure you have internet connectivity

## Development

### File Structure
```
twitter-extension-2/
├── manifest.json          # Extension configuration
├── background.js          # Service worker for API calls
├── content.js            # Main Twitter interaction script
├── popup.html            # Extension popup interface
├── popup.js             # Popup functionality
├── icons/               # Extension icons
└── README.md           # This file
```

### Building
No build process required - this is a vanilla JavaScript extension.

### Testing
1. Load the extension in developer mode
2. Enable extension on Twitter
3. Monitor browser console for logs
4. Test with different settings and AI models

## Privacy & Ethics

- Only interacts with publicly visible content
- Does not store personal data
- Respects Twitter's rate limits
- Comments are generated contextually, not spam
- User approves all comments before posting

## Legal & Compliance

- Use responsibly and in accordance with Twitter's Terms of Service
- Respect rate limits and avoid spam behavior
- Generated comments should add value to conversations
- Consider disclosing automated engagement if required by platform policies

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review browser console logs for errors
3. Verify your OpenRouter API configuration
4. Test with different settings and models

## Version History

- **v1.0.0**: Initial release with core features

## License

This project is for educational and personal use. Please review and comply with Twitter's Terms of Service and OpenRouter's usage policies.