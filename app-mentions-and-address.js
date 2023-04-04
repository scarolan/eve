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
import { directMention } from '@slack/bolt';
import { ChatGPTAPI } from 'chatgpt';
import Keyv from 'keyv';
import KeyvRedis from '@keyv/redis';

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

(async () => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const store = new KeyvRedis(redisUrl, {
    namespace: 'chatgpt-demo',
    ttl: 60 * 60,
    max: 100
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
    }
  });

  // Listen for direct mentions to the bot
  app.message(directMention(), async ({ message, say }) => {

    // Check if the user is asking for help
    if (message.text.toLowerCase().includes('help')) {
      await say(`You can message me in the channel with @Eve or chat with me directly in a DM.`);
      return;
    }

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
  });

  // Handle messages that include Eve or eve, and direct messages
  app.message(async ({ message, say }) => {
    if ((message.text && /^(eve|Eve)(?=($|[\s!?]))|(?<=\s)(eve|Eve)(?=($|[\s!?]))/i.test(message.text)) || message.channel_type === 'im') {
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