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

// Fix leave : on stocke la connexion vocal par serveur
const connections = new Map(); // guildId -> VoiceConnection

client.once("ready", () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  try {
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

      const role = message.guild.roles.cache.find((r) => r.name === "Membre");
      if (!role) return message.reply("❌ Le rôle **Membre** n'existe pas.");

      await message.guild.members.fetch();

      const sansRole = message.guild.members.cache.filter(
        (m) => !m.user.bot && !m.roles.cache.has(role.id)
      );

      if (sansRole.size === 0) {
        return message.reply("✅ Tout le monde a le rôle **Membre**.");
      }

      const list = sansRole.map((m) => `<@${m.id}>`).join("\n");
      return message.reply(`⚠️ Membres sans **Membre** (${sansRole.size}) :\n${list}`);
    }

    // =====================
    // !donnermembre
    // =====================
    if (cmd === "!donnermembre") {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        return message.reply("❌ Permission refusée (Gérer le serveur).");
      }

      const role = message.guild.roles.cache.find((r) => r.name === "Membre");
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
        (m) => !m.user.bot && !m.roles.cache.has(role.id)
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
    // !leave (fix)
    // =====================
    if (cmd === "!leave") {
      const connection = connections.get(message.guild.id) || getVoiceConnection(message.guild.id);

      if (!connection) return message.reply("❌ Je ne suis pas en vocal.");

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
      } catch (err) {
        console.error(err);
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
      } catch (err) {
        console.error(err);
        return message.reply("❌ Impossible de débannir (ID invalide ou pas banni).");
      }
    }

    // =====================
    // !mute @membre 10m raison
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
      if (!target) return message.reply("❌ Utilisation : `!mute @membre 10m raison`");

      const timeArg = args[0];
      if (!timeArg) return message.reply("❌ Format : `10m` / `2h` / `1d`");

      const match = timeArg.match(/^(\d+)([mhd])$/i);
      if (!match) return message.reply("❌ Format invalide (10m / 2h / 1d)");

      const amount = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();

      let duration = 0;
      if (unit === "m") duration = amount * 60000;
      if (unit === "h") duration = amount * 3600000;
      if (unit === "d") duration = amount * 86400000;

      const maxMs = 28 * 24 * 60 * 60 * 1000; // 28 jours
      if (duration > maxMs) return message.reply("❌ Maximum : 28 jours.");

      const reason = args.slice(1).join(" ") || "Aucune raison fournie.";

      try {
        await target.timeout(duration, reason);
        return message.reply(`🔇 **${target.user.tag}** mute **${timeArg}**\n📝 Raison : ${reason}`);
      } catch (err) {
        console.error(err);
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
      } catch (err) {
        console.error(err);
        return message.reply("❌ Impossible de unmute.");
      }
    }
  } catch (err) {
    console.error(err);
    return message.reply("❌ Erreur. Regarde les logs Railway.");
  }
});

client.login(process.env.TOKEN);