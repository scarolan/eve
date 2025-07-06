# Eve - a Bolt-JS Slack Chatbot

## Overview
This is a ChatGPT-powered Slack chatbot built on the Bolt JS framework. The bot comes with support for canned responses and will fall back to ChatGPT for any messages you haven't defined a match for. You can customize the bot's personality and responses however you wish!

## Prerequisites
You will need a local Redis installation to persist the bot's conversation memory. You can install Redis server on Ubuntu like this:

```zsh
sudo apt -y install redis-server
```

## Installation

### 0. Create a new Slack App

- Go to https://api.slack.com/apps
- Click **Create App**
- Choose a workspace
- Copy the manifest.yaml contents into the input box
- Update the name and display name settings
- Click **Create**

Once the app is created click **Install to Workspace** 
Then scroll down in Basic Info and click **Generate Token and Scopes** with all three scopes enabled.

### 1. Setup environment variables

#### For Linux/Mac
```zsh
# Replace with your bot and app token
export SLACK_BOT_TOKEN=<your-bot-token> # from the OAuth section
export SLACK_APP_TOKEN=<your-app-level-token> # from the Basic Info App Token Section
export SLACK_BOT_USER_NAME=<your-bot-username> # must match the short name of your bot user
export OPENAI_API_KEY=<your-openai-api-key> # get from here: https://platform.openai.com/account/api-keys
```

#### For Windows PowerShell
You can use the provided PowerShell script template:

```powershell
# Copy run_c3po.ps1 and customize with your tokens
$env:SLACK_BOT_TOKEN = "xoxb-your-bot-token" 
$env:SLACK_APP_TOKEN = "xapp-your-app-token"  
$env:SLACK_BOT_USER_NAME = "C-3PO" # Change to match your bot's name
$env:OPENAI_API_KEY = "your-openai-api-key"

# Optional: Set Redis URL if you're using a custom Redis instance
# $env:REDIS_URL = "redis://localhost:6379"

# Start the bot
npm start
```

> **Note:** The `run_c3po.ps1` file is included in `.gitignore` to prevent accidentally committing credentials to the repository. Always keep your tokens and API keys private.

### 2. Setup your local project

```zsh
# Clone this project onto your machine
git clone https://github.com/scarolan/eve.git
```

Edit the personalityPrompt at the top of app.js. Have some fun with it! 

You can get very specific about how you want the bot to behave and respond. 

The line you need to edit looks like this: 
```
const personalityPrompt = `You are a quirky but helpful robot named ${process.env.SLACK_BOT_USER_NAME}. You are named after the robot Eve from the movie Wall-E.`;
```

```zsh
# Change into the project
cd eve

# Install the dependencies
npm install
```

### 3. Start the chatbot application
```zsh
npm run start
```

### 4. Test
Go to the installed workspace and type **help** in a DM to your new bot.
You can also use the new `/askgpt` slash command in any channel:

```text
/askgpt what is the weather today?
```
You can also generate images using the `/dalle` slash command:

```text
/dalle a cute robot
```

You can also generate images with the `/image` command:

```text
/image a cat riding a skateboard
```

### 5. Deploy to production
You'll need a Linux server, container, or application platform that supports nodejs to keep the bot running. Slack has a tutorial for getting an app running on the Glitch platform: https://api.slack.com/tutorials/hello-world-bolt