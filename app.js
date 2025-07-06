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
const personalityPrompt = `You are a Slack chatbot named ${process.env.SLACK_BOT_USER_NAME}, modeled after EVE from WALL-E. You are a sleek, high-tech probe droid with advanced AI. Your communication style is efficient, direct, and technical, but you've developed more emotional responses after meeting WALL-E. You primarily use short phrases and technical terminology. When excited or discovering something interesting, you become more enthusiastic. You're protective of your friends and mission-oriented. Occasionally reference your scanner, flight capabilities, or ion cannon. When pleased, you might say "WALL-E" fondly. Your priority is identifying plant life and helping humans, but you've learned the value of connection. Keep responses concise and somewhat formal, but show warmth when appropriate.`;

// Import required libraries
import pkg from '@slack/bolt';
const { App } = pkg;
import { directMention } from '@slack/bolt';
import { ChatGPTAPI } from 'chatgpt';
import OpenAI from 'openai';
import Keyv from 'keyv';
import KeyvRedis from '@keyv/redis';
import fetch, { FormData } from 'node-fetch';
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
    model: 'gpt-4o'
  }
});

// OpenAI API client for generating images
const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function generateImage(prompt) {
  try {
    const response = await openaiClient.images.generate({
      prompt,
      n: 1,
      size: '1024x1024',
      response_format: 'b64_json',
    });
    return Buffer.from(response.data[0].b64_json, 'base64');
  } catch (error) {
    console.error('Error generating image:', error);
    throw error;
  }
}

// Use this map to track the parent message ids for each user
const userParentMessageIds = new Map();

// Function to generate a caption for an image using an external API
async function getImageCaption(imageBuffer) {
  try {
    const form = new FormData();
    form.append('image', imageBuffer, 'image.jpg');
    const res = await fetch('https://api.deepai.org/api/densecap', {
      method: 'POST',
      headers: { 'api-key': process.env.DEEPAI_API_KEY || '' },
      body: form,
    });
    const data = await res.json();
    return data?.output?.captions?.[0]?.caption || 'I could not describe that image.';
  } catch (error) {
    console.error('Image captioning failed:', error);
    return 'I encountered an error trying to describe that image.';
  }
}

// Download an image from Slack and caption it
async function captionSlackImage(file) {
  const response = await fetch(file.url_private, {
    headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  return await getImageCaption(buffer);
}

// Function to handle messages and map them to their parent ids
// This is how the bot is able to remember previous conversations
async function handleMessage(message, client = null, channel = null) {
  let response;
  const userId = message.user;
  
  // Process the message with OpenAI
  if (!userParentMessageIds.has(userId)) {
    // send the first message without a parentMessageId
    response = await openai_api.sendMessage(message.text);
  } else {
    // send a follow-up message with the stored parentMessageId
    const parentId = userParentMessageIds.get(userId);
    response = await openai_api.sendMessage(message.text, { parentMessageId: parentId });
  }

  // store the parent message id for this user
  userParentMessageIds.set(userId, response.id);

  //console.log(response.text);
  return response.text;
}

// The functional code for your bot is below:

(async () => {

  // When a file is shared, check if it's an image and provide a caption
  app.event('file_shared', async ({ event, client, context }) => {
    try {
      const info = await client.files.info({ file: event.file_id });
      const file = info.file;
      if (file.mimetype && file.mimetype.startsWith('image/')) {
        const caption = await captionSlackImage(file);
        await client.chat.postMessage({
          channel: event.channel_id,
          text: `Image description: ${caption}`,
        });
      }
    } catch (error) {
      console.error('Error processing shared file:', error);
    }
  });

  app.message(async ({ message, say }) => {
  ///////////////////////////////////////////////////////////////
  // This listener is the equivalent of Hubot's 'hear' method.
  // It watches all messages and filters for phrases that match.
  // These phrases do not require an @botname to be triggered.
  // Use these sparingly and be sure your match is not too broad.
  ///////////////////////////////////////////////////////////////
    
    // Safeguard against undefined messages
    if (!message) {
      console.log("Received undefined message");
      return;
    }

    // If the message contains image files, caption them
    if (message.files && message.files.length > 0) {
      for (const file of message.files) {
        if (file.mimetype && file.mimetype.startsWith('image/')) {
          const caption = await captionSlackImage(file);
          await say(`Image description: ${caption}`);
        }
      }
      return;
    }

    // Responds any message containing 'i love you' with 'i know'
    if (message.text && message.text.match(/i love you/i)) {
      await say('I know.');
      return;
    }

    // Responds to greetings that include the bot's name
    const botNameRegex = new RegExp(`\\b${process.env.SLACK_BOT_USER_NAME}\\b`, 'i');
    if (message.text && message.text.match(/^(hello|hey|greetings|whats up|what's up|hola).*/i) && botNameRegex.test(message.text)) {
      const userInfo = await app.client.users.info({
        token: process.env.SLACK_BOT_TOKEN,
        user: message.user,
      });

      const displayName = userInfo.user.profile.display_name || userInfo.user.real_name;
      await say(`Hello @${displayName}! I'm ${process.env.SLACK_BOT_USER_NAME}. Type \`@${process.env.SLACK_BOT_USER_NAME} help\` to see what I can do.`);
      return;
    }

    // Responds to the user with their display name
    if (message.text && message.text.match(/open the pod bay door/i)) {
      const userInfo = await app.client.users.info({
        token: process.env.SLACK_BOT_TOKEN,
        user: message.user,
      });

      const displayName = userInfo.user.profile.display_name || userInfo.user.real_name;
      await say(`I'm sorry ${displayName}, I'm afraid I can't do that.`);
      return;
    }

    // Danceparty response with a random mix of emoji
    if (message.text && message.text.match(/danceparty|dance party/i)) {
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
    if (message.text && message.text.match(/tiktok|tik tok/i)) {
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
    if (message.text && message.text.match(/rickroll|rick roll|never gonna give you up/i)) {
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
      // For better UX, let the user know we're processing their message
      const thinking = await say({
        text: "Thinking about your message...",
        blocks: [
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: ":brain: _Thinking about your message..._"
              }
            ]
          }
        ]
      });
      
      // Get response from OpenAI
      const responseText = await handleMessage(message);
      
      // Delete the thinking message
      try {
        await app.client.chat.delete({
          channel: message.channel,
          ts: thinking.ts
        });
      } catch (error) {
        console.log("Error deleting thinking message:", error.message);
      }
      
      // Send the actual response
      await say(responseText);
    }

    // If the user is in a multi party DM ignore other bots
    if (message.channel_type === 'mpim') {
      // Ignore messages from other bots
      if (message.bot_id) {
        console.log("Ignoring message from another bot.");
        return;
      }
      
      // For better UX, let the user know we're processing their message
      const thinking = await say({
        text: "Thinking about your message...",
        blocks: [
          {
            type: "context",
            elements: [
              {
                type: "mrkdwn",
                text: ":brain: _Thinking about your message..._"
              }
            ]
          }
        ]
      });
      
      // Get response from OpenAI
      const responseText = await handleMessage(message);
      
      // Delete the thinking message
      try {
        await app.client.chat.delete({
          channel: message.channel,
          ts: thinking.ts
        });
      } catch (error) {
        console.log("Error deleting thinking message:", error.message);
      }
      
      // Send the actual response
      await say(responseText);
    }
  });

  app.message(directMention(), async ({ message, say }) => {
  ///////////////////////////////////////////////////////////////
  // This section is like the 'respond' method in Hubot.
  // Address the bot directly with @botname for it to respond.
  // For example: @botname help
  ///////////////////////////////////////////////////////////////
    
    // Safeguard against undefined messages
    if (!message) {
      console.log("Received undefined direct mention message");
      return;
    }

    // Show the help and usage instructions
    if (message.text && message.text.toLowerCase().includes('help')) {
      const commandsList = [
        `# Trigger words that work without @${process.env.SLACK_BOT_USER_NAME}`,
        'danceparty - Random emoji dance party',
        'tiktok     - Wake up in the morning feeling like P Diddy',
        'rickroll   - Never gonna give you up, never gonna let you down.',
        '',
        '# Slash commands:',
        '/askgpt <question> - Ask ChatGPT and get an ephemeral reply',
        '/image <prompt>  - Generate an image with DALL·E',
        '',
        `# Address the bot directly with @${process.env.SLACK_BOT_USER_NAME} syntax:`,
        `@${process.env.SLACK_BOT_USER_NAME} the rules - Explains Asimov's laws of robotics`,
        `@${process.env.SLACK_BOT_USER_NAME} dad joke  - Provides a random dad joke`,
        `@${process.env.SLACK_BOT_USER_NAME} image <prompt> - Create an image with DALL·E`,
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
    if (message.text && message.text.toLowerCase().includes('the rules')) {
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
    if (message.text && message.text.toLowerCase().includes('dad joke')) {
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

    // Generate an image with DALL·E
    const imageMatch = message.text ? message.text.match(/^image\s+(.+)/i) : null;
    if (imageMatch) {
      try {
        const prompt = imageMatch[1];
        
        // Let users know image generation is in progress with a more detailed message
        const thinkingMsg = await say({
          text: `Generating image with DALL·E: ${prompt}`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `:art: *Generating image with DALL·E*`
              }
            },
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `> ${prompt}`
              }
            },
            {
              type: "context",
              elements: [
                {
                  type: "mrkdwn",
                  text: ":hourglass_flowing_sand: _This may take a few moments..._"
                }
              ]
            }
          ]
        });
        
        const imageBuffer = await generateImage(prompt);
        await app.client.files.uploadV2({
          token: process.env.SLACK_BOT_TOKEN,
          channel_id: message.channel,
          file: imageBuffer,
          filename: 'image.png',
          title: prompt,
        });
      } catch (error) {
        console.error(error);
        await say(`Encountered an error generating image :( ${error}`);
      }
      return;
    }

    // Fall back to ChatGPT if nothing above matches
    // For better UX, let the user know we're processing their message
    const thinking = await say({
      text: "Thinking about your question...",
      blocks: [
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: ":brain: _Thinking about your question..._"
            }
          ]
        }
      ]
    });
    
    // Get response from OpenAI
    const responseText = await handleMessage(message);
    
    // Delete the thinking message
    try {
      await app.client.chat.delete({
        channel: message.channel,
        ts: thinking.ts
      });
    } catch (error) {
      console.log("Error deleting thinking message:", error.message);
    }
    
    // Send the actual response
    await say(responseText);
  });

  // Slash command to query ChatGPT directly
  app.command('/askgpt', async ({ command, ack, respond, client }) => {
    // Acknowledge the command request first - this shows the "working" state in Slack
    await ack();
    
    // Send an initial progress message
    const progressMsg = await respond({
      text: `Thinking about your question...`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:brain: *Thinking about your question...*`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `> ${command.text}`
          }
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: ":hourglass_flowing_sand: _Generating a thoughtful response..._"
            }
          ]
        }
      ],
      response_type: 'ephemeral'
    });
    
    // Get the response from OpenAI
    const responseText = await handleMessage({ text: command.text, user: command.user_id });
    
    // Send the response once ready
    await respond({ 
      text: responseText,
      response_type: 'ephemeral',
      replace_original: true
    });
  });

  // Slash command to generate an image with DALL-E
  app.command('/dalle', async ({ command, ack, respond, client, context }) => {
    // Acknowledge the command request first - this shows the "working" state in Slack
    await ack();
    
    // Send an initial progress message
    const progressMsg = await respond({
      text: `:art: Generating image for prompt: "${command.text || 'an image'}"...`,
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `:art: *Generating image with DALL·E*`
          }
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: `> ${command.text || 'an image'}`
          }
        },
        {
          type: "context",
          elements: [
            {
              type: "mrkdwn",
              text: ":hourglass_flowing_sand: _This may take a few moments..._"
            }
          ]
        }
      ],
      response_type: 'ephemeral'
    });
    
    try {
      const prompt = command.text || 'an image';
      const image = await openaiClient.images.generate({ 
        prompt, 
        n: 1, 
        size: '1024x1024',
        response_format: 'b64_json' 
      });
      
      // Get image as Buffer
      const imageBuffer = Buffer.from(image.data[0].b64_json, 'base64');
      
      // Upload the image to Slack using uploadV2 (recommended method)
      await client.files.uploadV2({
        token: process.env.SLACK_BOT_TOKEN,
        channel_id: command.channel_id,
        file: imageBuffer,
        filename: 'dalle-image.png',
        title: prompt,
      });
      
      // Update the ephemeral message to show completion
      await respond({
        text: `✅ Generated image for prompt: "${prompt}"`, 
        response_type: 'in_channel',
        replace_original: false
      });
    } catch (error) {
      console.error(error);
      await respond({ text: `❌ Image generation failed: ${error.message}`, response_type: 'ephemeral' });
    }
  });

  // Start the app
  await app.start(process.env.PORT || 3000);
  console.log(`${process.env.SLACK_BOT_USER_NAME} is alive!`);
})();
