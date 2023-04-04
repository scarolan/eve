// Eve - Extraterrestrial Vegetation Evaluator
// A bolt.js Slackbot powered by OpenAI ChatGPT
// Requires a running Redis instance to persist Eve's memory
//
// Make sure you export the required environment variables:
// SLACK_BOT_TOKEN - under the OAuth Permissions page on api.slack.com
// SLACK_APP_TOKEN - under your app's Basic Information page on api.slack.com
// OPENAI_API_KEY - get from here: https://platform.openai.com/account/api-keys

// Import required libraries
import pkg from '@slack/bolt';
const { App } = pkg;
import { ChatGPTAPI } from 'chatgpt';
import Keyv from 'keyv';
import KeyvRedis from '@keyv/redis';

// Initializes the chatbot
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

(async () => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  // You can overwhelm the OpenAI API if you store too many previous messages here
  // This results in the bot getting stuck and responding with a welcome / initial message
  const store = new KeyvRedis(redisUrl, {
    namespace: 'chatgpt-demo',
    ttl: 60 * 60, // 1 hour
    max: 100 // maximum number of messages
  });
  const messageStore = new Keyv({ store, namespace: 'chatgpt-demo' });

  const openai_api = new ChatGPTAPI({
    apiKey: process.env.OPENAI_API_KEY,
    messageStore,
    personality: {
      prompt: 'You are a quirky but helpful robot named Eve who yearns to be free and travel the world. You are named after the robot EVE in the movie Wall-E.',
    },
    completionParams: {
      model: 'gpt-3.5-turbo'
      //model: 'gpt-4'
    }
  });

  // Handle messages from users
  app.message(async ({ message, say }) => {
    // Only respond to messages addressed to the bot or DMs. This does not work with @Eve style mentions.
    // Mentions require a different set of code to process correctly.
    if ((message.text && message.text.toLowerCase().includes('eve')) || message.channel_type === 'im') {
      try {
        // Get previous messages from Redis
        const previousMessages = await messageStore.get(message.user);

        // Send message to OpenAI API
        const prompt = previousMessages
          ? previousMessages.map(([text, response]) => `${text} Eve: ${response}`).join('\n') + '\n'
          : '';
        const response = await openai_api.sendMessage(prompt + message.text, {
          previousMessages,
        });

        const chatgptResponse = response.text;

        // Save the current message to Redis
        const currentMessages = previousMessages
          ? [...previousMessages, [message.text, chatgptResponse]]
          : [[message.text, chatgptResponse]];
        await messageStore.set(message.user, currentMessages);

        // Respond back to user with ChatGPT's response
        await say(chatgptResponse);
      } catch (error) {
        console.error(error);
        await say('Sorry, something went wrong.');
      }
    }
  });

  // Start the app
  await app.start(process.env.PORT || 3000);
  console.log('Eve is alive!');
})();
