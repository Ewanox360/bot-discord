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

const PREFIX = "!";
const TOKEN = "TON_TOKEN_ICI";

// 🔥 ON CHARGE LES FICHIERS
require("./commands/antiLink")(client);
require("./commands/moderation")(client, PREFIX);

client.once("ready", () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

client.login(TOKEN);