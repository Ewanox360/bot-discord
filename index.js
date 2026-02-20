const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

client.once("ready", () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

client.on("messageCreate", (message) => {
  if (message.author.bot) return;

  console.log("Message reçu :", message.content);

  if (message.content === "!ping") {
    message.reply("🏓 Pong !");
  }

  if (message.content === "!test") {
    message.reply("✅ Les commandes fonctionnent.");
  }
});

client.login(process.env.TOKEN);