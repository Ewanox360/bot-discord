const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

require("dotenv").config();

const PREFIX = process.env.PREFIX || "!";
const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error("ERROR: No bot token found. Set TOKEN in a .env file or as an environment variable.");
  process.exit(1);
}

// 🔥 ON CHARGE LES FICHIERS
require("./commands/antiLink.js")(client);
require("./commands/moderation.js")(client, PREFIX);

client.once("ready", () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

client.login(TOKEN);