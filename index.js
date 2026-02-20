const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const { joinVoiceChannel, getVoiceConnection } = require('@discordjs/voice');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const TOKEN = process.env.TOKEN;

client.once('ready', () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const args = message.content.trim().split(/\s+/);
  const cmd = (args.shift() || '').toLowerCase();

  // ======================
  // !verifmembre
  // ======================
  if (cmd === '!verifmembre') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return message.reply("❌ Permission refusée.");
    }

    const role = message.guild.roles.cache.find(r => r.name === "Membre");
    if (!role) return message.reply("❌ Le rôle 'Membre' n'existe pas.");

    await message.guild.members.fetch();

    const sansRole = message.guild.members.cache.filter(
      m => !m.user.bot && !m.roles.cache.has(role.id)
    );

    if (sansRole.size === 0) {
      return message.reply("✅ Tout le monde a le rôle Membre.");
    }

    return message.reply(`⚠️ ${sansRole.size} membre(s) sans rôle.`);
  }

  // ======================
  // !donnermembre
  // ======================
  if (cmd === '!donnermembre') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
      return message.reply("❌ Permission refusée.");
    }

    const role = message.guild.roles.cache.find(r => r.name === "Membre");
    if (!role) return message.reply("❌ Le rôle 'Membre' n'existe pas.");

    const me = await message.guild.members.fetchMe();

    if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return message.reply("❌ Je n'ai pas la permission Gérer les rôles.");
    }

    await message.guild.members.fetch();

    const sansRole = message.guild.members.cache.filter(
      m => !m.user.bot && !m.roles.cache.has(role.id)
    );

    for (const member of sansRole.values()) {
      await member.roles.add(role).catch(() => {});
    }

    return message.reply("✅ Rôle donné aux membres concernés.");
  }

  // ======================
  // !ban
  // ======================
  if (cmd === '!ban') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return message.reply("❌ Tu n'as pas la permission.");
    }

    const member = message.mentions.members.first();
    if (!member) return message.reply("❌ Mentionne un membre.");

    const reason = args.slice(1).join(" ") || "Aucune raison.";

    try {
      await member.ban({ reason });
      message.channel.send(`🔨 ${member.user.tag} banni.\nRaison : ${reason}`);
    } catch {
      message.reply("❌ Impossible de bannir.");
    }
  }

  // ======================
  // !unban
  // ======================
  if (cmd === '!unban') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return message.reply("❌ Permission refusée.");
    }

    const pseudo = args.join(" ");
    if (!pseudo) return message.reply("❌ Utilisation : !unban pseudo");

    const bans = await message.guild.bans.fetch();
    const banned = bans.find(b => b.user.username.toLowerCase() === pseudo.toLowerCase());

    if (!banned) return message.reply("❌ Aucun utilisateur trouvé.");

    await message.guild.members.unban(banned.user.id);
    message.channel.send(`✅ ${banned.user.tag} débanni.`);
  }

  // ======================
  // !mute
  // ======================
  if (cmd === '!mute') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return message.reply("❌ Permission refusée.");
    }

    const member = message.mentions.members.first();
    if (!member) return message.reply("❌ Mentionne un membre.");

    const timeArg = args[1];
    if (!timeArg) return message.reply("❌ Format: !mute @membre 10m");

    const match = timeArg.match(/^(\d+)([mhd])$/);
    if (!match) return message.reply("❌ Format invalide (10m / 2h / 1d)");

    const amount = parseInt(match[1]);
    const unit = match[2];

    let duration = 0;
    if (unit === "m") duration = amount * 60000;
    if (unit === "h") duration = amount * 3600000;
    if (unit === "d") duration = amount * 86400000;

    const reason = args.slice(2).join(" ") || "Aucune raison.";

    try {
      await member.timeout(duration, reason);
      message.channel.send(`🔇 ${member.user.tag} mute pour ${timeArg}`);
    } catch {
      message.reply("❌ Erreur lors du mute.");
    }
  }

  // ======================
  // !unmute
  // ======================
  if (cmd === '!unmute') {
    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return message.reply("❌ Permission refusée.");
    }

    const member = message.mentions.members.first();
    if (!member) return message.reply("❌ Mentionne un membre.");

    await member.timeout(null);
    message.channel.send(`🔊 ${member.user.tag} unmute.`);
  }

  // ======================
  // !join
  // ======================
  if (cmd === '!join') {
    const member = await message.guild.members.fetch(message.author.id);
    const voiceChannel = member.voice?.channel;

    if (!voiceChannel) {
      return message.reply("❌ Va dans un salon vocal.");
    }

    joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
      selfDeaf: true
    });

    return message.reply(`✅ Je rejoins ${voiceChannel.name}`);
  }

  // ======================
  // !leave
  // ======================
  if (cmd === '!leave') {
    const connection = getVoiceConnection(message.guild.id);
    if (!connection) return message.reply("❌ Je ne suis pas en vocal.");

    connection.destroy();
    return message.reply("✅ J'ai quitté le vocal.");
  }

});

client.login(TOKEN);