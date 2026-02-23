// test
require("dotenv").config();

const { Client, GatewayIntentBits } = require("discord.js");

// ✅ Crée le client Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// ✅ Variables d'environnement (Railway / .env local)
const PREFIX = process.env.PREFIX || "!";
const TOKEN = process.env.TOKEN;

// ✅ Sécurité : on stop si pas de token
if (!TOKEN) {
  console.error(
    "ERROR: No bot token found. Set TOKEN in Railway Variables or in a .env file."
  );
  process.exit(1);
}

// ✅ Charger tes commandes (chemins EXACTS)
require("./commands/antilink.js")(client);
require("./commands/moderation.js")(client, PREFIX);

// ✅ Quand le bot est prêt
client.once("clientReady", () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

// ✅ Connexion
client.login(TOKEN);