// index.js
require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,      // optionnel
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,  // optionnel (si tu utilises la voix)
  ],
});

const PREFIX = process.env.PREFIX || "!";
const TOKEN = process.env.TOKEN;

if (!TOKEN) {
  console.error("ERROR: No bot token found. Set TOKEN in Railway Variables or in a .env file.");
  process.exit(1);
}

// Charger les commandes (chemins EXACTS)
require("./commands/antilink.js")(client);
require("./commands/moderation.js")(client, PREFIX);

// Bot prêt
client.once("ready", () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

// Connexion
client.login(TOKEN);