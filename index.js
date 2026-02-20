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

const connections = new Map(); // guildId -> VoiceConnection

client.once("ready", () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const args = message.content.trim().split(/\s+/);
  const cmd = (args.shift() || "").toLowerCase();

  // =====================
  // !verifmembre
  // =====================
  if (cmd === "!verifmembre") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return message.reply("❌ Permission refusée (Gérer le serveur).");
    }

    const role = message.guild.roles.cache.find(r => r.name === "Membre");
    if (!role) return message.reply("❌ Le rôle **Membre** n'existe pas.");

    await message.guild.members.fetch();

    const sansRole = message.guild.members.cache.filter(
      m => !m.user.bot && !m.roles.cache.has(role.id)
    );

    if (sansRole.size === 0) {
      return message.reply("✅ Tout le monde a le rôle **Membre**.");
    }

    return message.reply(`⚠️ ${sansRole.size} membre(s) n'ont pas le rôle **Membre**.`);
  }

  // =====================
  // !donnermembre
  // =====================
  if (cmd === "!donnermembre") {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return message.reply("❌ Permission refusée (Gérer le serveur).");
    }

    const role = message.guild.roles.cache.find(r => r.name === "Membre");
    if (!role) return message.reply("❌ Le rôle **Membre** n'existe pas.");

    const me = await message.guild.members.fetchMe();

    if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return message.reply("❌ Je n'ai pas la permission **Gérer les rôles**.");
    }

    if (role.position >= me.roles.highest.position) {
      return message.reply("❌ Mets le rôle du bot **au-dessus** du rôle **Membre**.");
    }

    await message.guild.members.fetch();

    const sansRole = message.guild.members.cache.filter(
      m => !m.user.bot && !m.roles.cache.has(role.id)
    );

    if (sansRole.size === 0) {
      return message.reply("✅ Tous les membres ont déjà le rôle **Membre**.");
    }

    let ok = 0;
    let fail = 0;

    for (const member of sansRole.values()) {
      try {
        await member.roles.add(role);
        ok++;
      } catch {
        fail++;
      }
    }

    return message.reply(`✅ Terminé : ${ok} rôle(s) donnés. ❌ Échecs : ${fail}.`);
  }

  // =====================
  // !join
  // =====================
  if (cmd === "!join") {
    const channel = message.member.voice.channel;
    if (!channel) return message.reply("❌ Tu dois être en vocal.");

    const old = connections.get(message.guild.id);
    if (old) old.destroy();

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
      selfDeaf: true
    });

    connections.set(message.guild.id, connection);
    return message.reply("✅ Je rejoins le vocal.");
  }

  // =====================
  // !leave
  // =====================
  if (cmd === "!leave") {
    const connection = connections.get(message.guild.id) || getVoiceConnection(message.guild.id);

    if (!connection) {
      return message.reply("❌ Je ne suis pas en vocal.");
    }

    connection.destroy();
    connections.delete(message.guild.id);

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
  // !unban <ID>
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