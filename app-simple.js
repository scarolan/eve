// Very basic ChatGPT bot implementation
// This does not have any memory persistence
// so you cannot refer to things you mentioned
// in previous chat messages.
import pkg from '@slack/bolt';
const { App } = pkg;
import { ChatGPTAPI } from 'chatgpt'

const openai_api = new ChatGPTAPI({
  apiKey: process.env.OPENAI_API_KEY,
  completionParams: {
    model: 'gpt-3.5-turbo'
    //model: 'gpt-4'
  }
})

// Initializes your app with your bot token and app token
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

// Handle messages from users
app.message(async ({ message, say }) => {
  try {
    // Send message to OpenAI API
    const response = await openai_api.sendMessage(message.text);
    const chatgptResponse = response.text;

    // Respond back to user with ChatGPT's response
    await say(chatgptResponse);
  } catch (error) {
    console.error(error);
    await say('Sorry, something went wrong.');
  }
});

(async () => {
  // Start the app
  await app.start(process.env.PORT || 3000);
  console.log('Eve is alive!');
})();
