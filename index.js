const { Client, GatewayIntentBits, PermissionsBitField } = require("discord.js");
const { joinVoiceChannel, getVoiceConnection } = require("@discordjs/voice");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

client.once("ready", () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const args = message.content.trim().split(/\s+/);
  const cmd = (args.shift() || "").toLowerCase();

  // =====================
  // !join
  // =====================
  if (cmd === "!join") {
    const channel = message.member.voice.channel;
    if (!channel) return message.reply("❌ Tu dois être en vocal.");

    joinVoiceChannel({
      channelId: channel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator
    });

    return message.reply("✅ Je rejoins le vocal.");
  }

  // =====================
  // !leave (fiable)
  // =====================
  if (cmd === "!leave") {
    const botMember = await message.guild.members.fetchMe();
    if (!botMember.voice?.channel) {
      return message.reply("❌ Je ne suis pas en vocal.");
    }

    const connection = getVoiceConnection(message.guild.id);
    if (connection) connection.destroy();

    return message.reply("👋 Je quitte le vocal.");
  }

  // =====================
  // !ban @membre [raison...]
  // =====================
  if (cmd === "!ban") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return message.reply("❌ Tu n'as pas la permission de bannir.");
    }

    const me = await message.guild.members.fetchMe();
    if (!me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return message.reply("❌ Je n'ai pas la permission **Bannir des membres**.");
    }

    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Utilisation : `!ban @membre raison`");

    const reason = args.join(" ") || "Aucune raison fournie.";

    try {
      await target.ban({ reason });
      return message.channel.send(`🔨 **${target.user.tag}** a été banni.\n📝 Raison : ${reason}`);
    } catch (e) {
      console.error(e);
      return message.reply("❌ Impossible de bannir (permissions/hiérarchie).");
    }
  }

  // =====================
  // !unban <ID> (le plus fiable)
  // =====================
  if (cmd === "!unban") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return message.reply("❌ Tu n'as pas la permission de débannir.");
    }

    const me = await message.guild.members.fetchMe();
    if (!me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return message.reply("❌ Je n'ai pas la permission **Bannir/Débannir**.");
    }

    const userId = args[0];
    if (!userId) return message.reply("❌ Utilisation : `!unban <ID>`");

    try {
      await message.guild.members.unban(userId);
      return message.channel.send(`✅ Utilisateur débanni (ID: ${userId}).`);
    } catch (e) {
      console.error(e);
      return message.reply("❌ Impossible de débannir (ID invalide ou pas banni).");
    }
  }

  // =====================
  // !mute @membre <minutes> [raison...]
  // =====================
  if (cmd === "!mute") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return message.reply("❌ Tu n'as pas la permission de mute.");
    }

    const me = await message.guild.members.fetchMe();
    if (!me.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return message.reply("❌ Je n'ai pas la permission **Modérer des membres**.");
    }

    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Utilisation : `!mute @membre 10 raison`");

    const minutesStr = args[0];
    const minutes = parseInt(minutesStr, 10);
    if (!minutesStr || Number.isNaN(minutes) || minutes <= 0) {
      return message.reply("❌ Mets une durée en minutes. Exemple : `!mute @membre 10 spam`");
    }

    // max 28 jours
    if (minutes > 40320) return message.reply("❌ Maximum : 40320 minutes (28 jours).");

    const reason = args.slice(1).join(" ") || "Aucune raison fournie.";

    try {
      await target.timeout(minutes * 60 * 1000, reason);
      return message.channel.send(`🔇 **${target.user.tag}** mute **${minutes} min**.\n📝 Raison : ${reason}`);
    } catch (e) {
      console.error(e);
      return message.reply("❌ Impossible de mute (permissions/hiérarchie).");
    }
  }

  // =====================
  // !unmute @membre
  // =====================
  if (cmd === "!unmute") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return message.reply("❌ Tu n'as pas la permission.");
    }

    const me = await message.guild.members.fetchMe();
    if (!me.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return message.reply("❌ Je n'ai pas la permission **Modérer des membres**.");
    }

    const target = message.mentions.members.first();
    if (!target) return message.reply("❌ Utilisation : `!unmute @membre`");

    try {
      await target.timeout(null);
      return message.channel.send(`🔊 **${target.user.tag}** a été unmute.`);
    } catch (e) {
      console.error(e);
      return message.reply("❌ Impossible de unmute.");
    }
  }
});

client.login(process.env.TOKEN);