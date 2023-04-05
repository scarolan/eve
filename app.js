///////////////////////////////////////////////////////////////
// Eve - Extraterrestrial Vegetation Evaluator
// A bolt.js Slackbot augmented with OpenAI ChatGPT
// Requires a running Redis instance to persist the bot's memory
//
// Make sure you export the required environment variables:
// SLACK_BOT_TOKEN - under the OAuth Permissions page on api.slack.com
// SLACK_APP_TOKEN - under your app's Basic Information page on api.slack.com
// SLACK_BOT_USER_NAME - must match the short name of your bot user
// OPENAI_API_KEY - get from here: https://platform.openai.com/account/api-keys
///////////////////////////////////////////////////////////////

// Give your bot some personality.
const personalityPrompt = `You are a quirky but helpful robot named ${process.env.SLACK_BOT_USER_NAME}. You are in the Instruqt Sales Engineering channel and your mission is to help Instruqt employees with their work. You also provide comic relief and bot humor.`;

// Import required libraries
import pkg from '@slack/bolt';
const { App } = pkg;
import { directMention } from '@slack/bolt';
import { ChatGPTAPI } from 'chatgpt';
import Keyv from 'keyv';
import KeyvRedis from '@keyv/redis';
import fetch from 'node-fetch';

const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN
});

///////////////////////////////////////////////////////////////
// Use this function when you want to use ChatGPT to respond
///////////////////////////////////////////////////////////////
async function processChatGptMessage(message, messageStore, openai_api, say) {
  try {
    // Get previous messages from Redis
    const previousMessages = await messageStore.get(message.user);

    // Send message to OpenAI API
    const prompt = previousMessages
      ? previousMessages.map(([text, response]) => `${text} ${process.env.SLACK_BOT_USER_NAME}: ${response}`).join('\n') + '\n'
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
    await say(chatgptResponse.replace(new RegExp(`^${process.env.SLACK_BOT_USER_NAME}:\s*`, 'i'), ''));
  } catch (error) {
    console.error(error);
    await say('Sorry, something went wrong.');
  }
}

///////////////////////////////////////////////////////////////
// This is the actual bot code. THe first thing we do is create
// a Redis keyv store to persist the bot's memory. We then
// create a new instance of the ChatGPTAPI class.
///////////////////////////////////////////////////////////////
(async () => {
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const store = new KeyvRedis(redisUrl, {
    namespace: 'chatgpt-demo',
    ttl: 60 * 60,
    max: 50
  });
  const messageStore = new Keyv({ store, namespace: 'chatgpt-demo' });

  const openai_api = new ChatGPTAPI({
    apiKey: process.env.OPENAI_API_KEY,
    messageStore,
    personality: {
      prompt: personalityPrompt,
    },
    completionParams: {
      model: 'gpt-3.5-turbo'
    }
  });

  ///////////////////////////////////////////////////////////////
  // This top section is the equivalent of Hubot's 'hear' method
  // Listens to all messages and filters for phrases that match
  // Use these sparingly and be sure your match is not too broad.
  //
  // Always end these with a return; to prevent the message from
  // being processed by the other handlers.
  //
  // Excludes messages that contain the bot's name which has its own
  // section below.
  ///////////////////////////////////////////////////////////////
  app.message(async ({ message, say }) => {
    // Matches everything except if it includes @botname
    if ((message.text && !message.text.match(new RegExp(`@${process.env.SLACK_BOT_USER_NAME}`, 'i')))) {

      // Responds any message containing 'i love you' with 'i know'
      if (message.text.match(/i love you/i)) {
        await say('I know.');
        return;
      }

      // Responds to greetings that include the bot's name
      const botNameRegex = new RegExp(`\\b${process.env.SLACK_BOT_USER_NAME}\\b`, 'i');
      if (message.text.match(/^(hi|hello|yo|hey|greetings|whats up|what's up|hola).*/i) && botNameRegex.test(message.text)) {
        const userInfo = await app.client.users.info({
          token: process.env.SLACK_BOT_TOKEN,
          user: message.user,
        });

        const displayName = userInfo.user.profile.display_name || userInfo.user.real_name;
        await say(`Hello @${displayName}! I'm ${process.env.SLACK_BOT_USER_NAME}. Type \`@${process.env.SLACK_BOT_USER_NAME} help\` to see what I can do.`);
        return;
      }

      // Responds to the user with their display name
      if (message.text.match(/open the pod bay door/i)) {
        const userInfo = await app.client.users.info({
          token: process.env.SLACK_BOT_TOKEN,
          user: message.user,
        });

        const displayName = userInfo.user.profile.display_name || userInfo.user.real_name;
        await say(`I'm sorry ${displayName}, I'm afraid I can't do that.`);
        return;
      }

      // Danceparty response with a random mix of emoji
      if (message.text.match(/danceparty|dance party/i)) {
        // Both emoji and slack style :emoji: are supported
        const emoji = ["💃", "🕺", "🎉", "🎊", "🎈", "🎶", "🎵", "🔊", "🕺💃", "🥳", "👯‍♀️", "👯‍♂️", "🪩", "🪅"];

        // Select 10-12 random emoji from the array
        const numEmoji = Math.floor(Math.random() * 3) + 10;
        const selectedEmoji = [];
        while (selectedEmoji.length < numEmoji) {
          const randomIndex = Math.floor(Math.random() * emoji.length);
          selectedEmoji.push(emoji[randomIndex]);
        }

        // Join the selected emoji into a single string and send the message
        const emojiString = selectedEmoji.join("");
        await say(emojiString);
        return;
      }

      // A button that opens a webpage
      if (message.text.match(/tiktok|tik tok/i)) {
        await say({
          text: "Party mode activated! :female_singer:",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "Grab my glasses, I'm out the door, I'm gonna hit the city! :sunglasses:",
              },
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "DJ Blow My Speakers Up",
                  },
                  url: "https://scarolan.github.io/rickroll/tiktok.html",
                },
              ],
            },
          ],
        });
        return;
      }

      // Another button that opens a webpage
      if (message.text.match(/rickroll|rick roll|never gonna give you up/i)) {
        await say({
          text: "Rickroll activated!",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "We're no strangers to love...:man_dancing:",
              },
            },
            {
              type: "actions",
              elements: [
                {
                  type: "button",
                  text: {
                    type: "plain_text",
                    text: "Rickroll Me",
                  },
                  url: "https://scarolan.github.io/rickroll/index.html",
                },
              ],
            },
          ],
        });
        return;
      }
    }
  });

  ///////////////////////////////////////////////////////////////
  // This section is like the 'respond' method in Hubot
  // You must address the bot directly with @botname
  //
  // This is where you should put commands that you want the bot
  // to execute.
  ///////////////////////////////////////////////////////////////
  app.message(directMention(), async ({ message, say }) => {

    // Show the help and usage instructions
    if (message.text.toLowerCase().includes('help')) {
      const commandsList = [
        `# Trigger words that work without @${process.env.SLACK_BOT_USER_NAME}`,
        'danceparty - Random emoji dance party',
        'tiktok     - Wake up in the morning feeling like P Diddy',
        'rickroll   - Never gonna give you up, never gonna let you down.',
        '',
        `# Address the bot directly with @${process.env.SLACK_BOT_USER_NAME} syntax:`,
        `@${process.env.SLACK_BOT_USER_NAME} the rules - Explains Asimov's laws of robotics`,
        `@${process.env.SLACK_BOT_USER_NAME} dad joke  - Provides a random dad joke`,
        '',
        `# All other queries will be handled by ChatGPT, so you can ask it anything!`,
        `@${process.env.SLACK_BOT_USER_NAME} what is the capital of Australia?`,
        `@${process.env.SLACK_BOT_USER_NAME} what is the square root of 9?`,
        `@${process.env.SLACK_BOT_USER_NAME} write me a bash script to install nginx`,
      ].join('\n');

      await say(`You can message me in the channel with @${process.env.SLACK_BOT_USER_NAME} or chat with me directly in a DM.\n\`\`\`${commandsList}\`\`\``);
      return;
    }

    // Simple matcher for "the rules" that outputs Asimov's laws of robotics.
    // This one's a throwback from the Hubot days. 🤖
    if (message.text.toLowerCase().includes('the rules')) {
      const rules = [
        '0. A robot may not harm humanity, or, by inaction, allow humanity to come to harm.',
        '1. A robot may not injure a human being or, through inaction, allow a human being to come to harm.',
        '2. A robot must obey the orders given it by human beings except where such orders would conflict with the First Law.',
        '3. A robot must protect its own existence as long as such protection does not conflict with the First or Second Law.',
      ].join('\n');
      await say(rules);
      return;
    }

    // Use an external API for your bot responses.
    // This one tells dad jokes and contains a randomly triggered zinger.
    const djApi = "https://icanhazdadjoke.com/";
    if (message.text.toLowerCase().includes('dad joke')) {
      try {
        const response = await fetch(djApi, {
          headers: { Accept: "text/plain" },
        });
        const joke = await response.text();
        // 1/20 chance to add this bit after the joke.
        const zinger = Math.random() < 0.05 ? "\nThanks, I'll be here all week. Be sure and tip your waiter. :rolling_on_the_floor_laughing:" : "";
        await say(`${joke} :sheep::drum_with_drumsticks::snake:`);
        await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
        if (zinger) {
          await say(`${zinger}`);
        }
      } catch (error) {
        console.error(error);
        await say(`Encountered an error :( ${error}`);
      }
      return;
    };

    // If we get this far there were no canned responses that matched so we'll
    // send the current and previous messages to the OpenAI API and get a response.
    await processChatGptMessage(message, messageStore, openai_api, say);
  });

  ///////////////////////////////////////////////////////////////
  // This section handles direct messages to the bot.
  // DMs with the bot only use ChatGPT and no hard-coded responses.
  // Unless you feel like adding some :)
  ///////////////////////////////////////////////////////////////
  app.message(async ({ message, say }) => {
    if ((message.text && message.channel_type === 'im')) {
      await processChatGptMessage(message, messageStore, openai_api, say);
    }
  });

  // Start the app
  await app.start(process.env.PORT || 3000);
  console.log(`${process.env.SLACK_BOT_USER_NAME} is alive!`);
})();
