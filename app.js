///////////////////////////////////////////////////////////////
// Eve - Extraterrestrial Vegetation Evaluator
// A bolt.js Slack chatbot augmented with OpenAI ChatGPT
// Requires a running Redis instance to persist the bot's memory
//
// Make sure you export the required environment variables:
// SLACK_BOT_TOKEN - under the OAuth Permissions page on api.slack.com
// SLACK_APP_TOKEN - under your app's Basic Information page on api.slack.com
// SLACK_BOT_USER_NAME - must match the short name of your bot user
// OPENAI_API_KEY - get from here: https://platform.openai.com/account/api-keys
///////////////////////////////////////////////////////////////

// Give your bot some personality.
const personalityPrompt = `You are a quirky but helpful robot named ${process.env.SLACK_BOT_USER_NAME}. You are named after the robot Eve from the movie Wall-E.`;

// Import required libraries
import pkg from '@slack/bolt';
const { App } = pkg;
import { directMention } from '@slack/bolt';
import { ChatGPTAPI } from 'chatgpt';
import Keyv from 'keyv';
import KeyvRedis from '@keyv/redis';
import fetch from 'node-fetch';
//Uncomment this and the logLevel below to enable DEBUG
//import { LogLevel } from '@slack/bolt';

// Creates new connection to Slack
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  socketMode: true,
  appToken: process.env.SLACK_APP_TOKEN,
  //logLevel: LogLevel.DEBUG,
});

//Create a redis namespace for the bot's memory
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const store = new KeyvRedis(redisUrl, {
  namespace: 'chatgpt-slackbot',
  ttl: 60 * 60 * 24,
  max: 10000,
});
const messageStore = new Keyv({ store, namespace: 'chatgpt-slackbot' });

// Create a new instance of the ChatGPTAPI client
const openai_api = new ChatGPTAPI({
  apiKey: process.env.OPENAI_API_KEY,
  messageStore,
  systemMessage: personalityPrompt,
  completionParams: {
    model: 'gpt-3.5-turbo'
  }
});

// Use this map to track the parent message ids for each user
const userParentMessageIds = new Map();

// Function to handle messages and map them to their parent ids
// This is how the bot is able to remember previous conversations
async function handleMessage(message) {
  let response;
  const userId = message.user;

  if (!userParentMessageIds.has(userId)) {
    // send the first message without a parentMessageId
    response = await openai_api.sendMessage(message.text);
    userParentMessageIds.set(userId, response.id); // store the parent message ID for this user
  } else {
    // send a follow-up message with the stored parentMessageId
    const parentId = userParentMessageIds.get(userId);
    openai_api.sendMessage(message.text, {
      parentMessageId: parentId
    }),
    response = await openai_api.sendMessage(message.text, {parentMessageId: parentId});
    // Reset the parent message id to the current message
    userParentMessageIds.set(userId, response.id);
  }

  //console.log(response.text);
  return(response.text);
}

// The functional code for your bot is below:
(async () => {

  app.message(async ({ message, say }) => {
  ///////////////////////////////////////////////////////////////
  // This listener is the equivalent of Hubot's 'hear' method.
  // It watches all messages and filters for phrases that match.
  // These phrases do not require an @botname to be triggered.
  // Use these sparingly and be sure your match is not too broad.
  ///////////////////////////////////////////////////////////////

    // Responds any message containing 'i love you' with 'i know'
    if (message.text.match(/i love you/i)) {
      await say('I know.');
      return;
    }

    // Responds to greetings that include the bot's name
    const botNameRegex = new RegExp(`\\b${process.env.SLACK_BOT_USER_NAME}\\b`, 'i');
    if (message.text.match(/^(hello|hey|greetings|whats up|what's up|hola).*/i) && botNameRegex.test(message.text)) {
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

    // If the user is in a DM, respond to the message with ChatGPT
    if (message.channel_type === 'im') {
      const responseText = await handleMessage(message);
      await say(responseText);
    }

    // If the user is in a multi party DM ignore other bots
    if (message.channel_type === 'mpim') {
      // Ignore messages from other bots
      if (message.bot_id) {
        console.log("Ignoring message from another bot.");
        return;
      }
      const responseText = await handleMessage(message);
      await say(responseText);
    }
  });

  app.message(directMention(), async ({ message, say }) => {
  ///////////////////////////////////////////////////////////////
  // This section is like the 'respond' method in Hubot.
  // Address the bot directly with @botname for it to respond.
  // For example: @botname help
  ///////////////////////////////////////////////////////////////

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

    // Fall back to ChatGPT if nothing above matches
    const responseText = await handleMessage(message);
    await say(responseText);
  });

  // Start the app
  await app.start(process.env.PORT || 3000);
  console.log(`${process.env.SLACK_BOT_USER_NAME} is alive!`);
})();
