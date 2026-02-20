const { Client, GatewayIntentBits, PermissionsBitField } = require("discord.js");
const { joinVoiceChannel, getVoiceConnection } = require("@discordjs/voice");

const PREFIX = "!";
const ROLE_MEMBRE_NAME = "Membre";
const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // 28 jours

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ],
});

// Stock de connexion vocal (pour leave fiable)
const connections = new Map(); // guildId -> VoiceConnection

// Temps flexible:
// "10m", "2h", "1d", "30s", "1w"
// "1h30m", "2d4h", "1w2d3h10m"
// "90" => 90 minutes (si juste un nombre)
function parseDuration(input) {
  if (!input) return null;

  const raw = input.toLowerCase().trim();

  // juste un nombre => minutes
  if (/^\d+$/.test(raw)) {
    const minutes = parseInt(raw, 10);
    if (!Number.isFinite(minutes) || minutes <= 0) return null;
    return minutes * 60 * 1000;
  }

  const regex = /(\d+)\s*([smhdw])/g;
  let match;
  let total = 0;
  let found = false;

  while ((match = regex.exec(raw)) !== null) {
    found = true;
    const value = parseInt(match[1], 10);
    const unit = match[2];

    if (!Number.isFinite(value) || value <= 0) return null;

    if (unit === "s") total += value * 1000;
    if (unit === "m") total += value * 60 * 1000;
    if (unit === "h") total += value * 60 * 60 * 1000;
    if (unit === "d") total += value * 24 * 60 * 60 * 1000;
    if (unit === "w") total += value * 7 * 24 * 60 * 60 * 1000;
  }

  if (!found) return null;

  // refuse si il reste des caractères non valides
  const cleaned = raw.replace(regex, "").replace(/\s+/g, "");
  if (cleaned.length !== 0) return null;

  return total;
}

// Enlève la première mention <@123> ou <@!123> du texte
function removeFirstMention(text) {
  return text.replace(/<@!?\d+>/, "").trim();
}

client.once("ready", () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.trim().split(/\s+/);
    const cmd = (args.shift() || "").toLowerCase();

    // =====================
    // !verifmembre
    // =====================
    if (cmd === "!verifmembre") {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        return message.reply("❌ Permission refusée (Gérer le serveur).");
      }

      const role = message.guild.roles.cache.find((r) => r.name === ROLE_MEMBRE_NAME);
      if (!role) return message.reply(`❌ Le rôle **${ROLE_MEMBRE_NAME}** n'existe pas.`);

      await message.guild.members.fetch();

      const sansRole = message.guild.members.cache.filter(
        (m) => !m.user.bot && !m.roles.cache.has(role.id)
      );

      if (sansRole.size === 0) {
        return message.reply(`✅ Tout le monde a le rôle **${ROLE_MEMBRE_NAME}**.`);
      }

      const list = sansRole.map((m) => `<@${m.id}>`).join("\n");
      return message.reply(`⚠️ Membres sans **${ROLE_MEMBRE_NAME}** (${sansRole.size}) :\n${list}`);
    }

    // =====================
    // !donnermembre
    // =====================
    if (cmd === "!donnermembre") {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        return message.reply("❌ Permission refusée (Gérer le serveur).");
      }

      const role = message.guild.roles.cache.find((r) => r.name === ROLE_MEMBRE_NAME);
      if (!role) return message.reply(`❌ Le rôle **${ROLE_MEMBRE_NAME}** n'existe pas.`);

      const me = await message.guild.members.fetchMe();

      if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return message.reply("❌ Je n'ai pas la permission **Gérer les rôles**.");
      }

      if (role.position >= me.roles.highest.position) {
        return message.reply(`❌ Mets le rôle du bot **au-dessus** du rôle **${ROLE_MEMBRE_NAME}**.`);
      }

      await message.guild.members.fetch();

      const sansRole = message.guild.members.cache.filter(
        (m) => !m.user.bot && !m.roles.cache.has(role.id)
      );

      if (sansRole.size === 0) {
        return message.reply(`✅ Tous les membres ont déjà le rôle **${ROLE_MEMBRE_NAME}**.`);
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
        selfDeaf: true,
      });

      connections.set(message.guild.id, connection);
      return message.reply("✅ Je rejoins le vocal.");
    }

    // =====================
    // !leave (ULTRA FIX)
    // =====================
    if (cmd === "!leave") {
      // Vérifie l'état vocal réel du bot
      const botMember = await message.guild.members.fetchMe();
      const botVoiceChannelId = botMember.voice?.channelId;

      // On récupère la connexion (Map OU getVoiceConnection)
      const connection = connections.get(message.guild.id) || getVoiceConnection(message.guild.id);

      if (!botVoiceChannelId && !connection) {
        return message.reply("❌ Je ne suis pas en vocal.");
      }

      // Destruction
      if (connection) connection.destroy();
      connections.delete(message.guild.id);

      // Petit retry (Discord peut "lag" 1-2 sec)
      setTimeout(async () => {
        const bm = await message.guild.members.fetchMe().catch(() => null);
        if (bm?.voice?.channelId) {
          const c2 = getVoiceConnection(message.guild.id);
          if (c2) c2.destroy();
          connections.delete(message.guild.id);
        }
      }, 1500);

      return message.reply("👋 Je quitte le vocal.");
    }

    // =====================
    // !ban @membre raison...
    // =====================
    if (cmd === "!ban") {
      if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        return message.reply("❌ Tu n'as pas la permission **Bannir des membres**.");
      }

      const me = await message.guild.members.fetchMe();
      if (!me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        return message.reply("❌ Je n'ai pas la permission **Bannir des membres**.");
      }

      const target = message.mentions.members.first();
      if (!target) return message.reply("❌ Utilisation : `!ban @membre raison`");

      const cleaned = removeFirstMention(message.content).split(/\s+/);
      // cleaned[0] = !ban, cleaned[1..] = raison
      const reason = cleaned.slice(1).join(" ") || "Aucune raison fournie.";

      try {
        await target.ban({ reason });
        return message.reply(`🔨 **${target.user.tag}** banni.\n📝 Raison : ${reason}`);
      } catch (err) {
        console.error(err);
        return message.reply("❌ Impossible de bannir (permissions/hiérarchie).");
      }
    }

    // =====================
    // !unban ID
    // =====================
    if (cmd === "!unban") {
      if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        return message.reply("❌ Tu n'as pas la permission **Bannir/Débannir**.");
      }

      const me = await message.guild.members.fetchMe();
      if (!me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        return message.reply("❌ Je n'ai pas la permission **Bannir/Débannir**.");
      }

      const userId = args[0];
      if (!userId) return message.reply("❌ Utilisation : `!unban <ID>`");

      try {
        await message.guild.members.unban(userId);
        return message.reply(`✅ Débanni : ID ${userId}`);
      } catch (err) {
        console.error(err);
        return message.reply("❌ Impossible de débannir (ID invalide ou pas banni).");
      }
    }

    // =====================
    // !mute @membre temps raison...
    // temps flexible: 30s / 10m / 2h / 1d / 1w / 1h30m / 2d4h etc
    // =====================
    if (cmd === "!mute") {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        return message.reply("❌ Tu n'as pas la permission **Modérer des membres**.");
      }

      const me = await message.guild.members.fetchMe();
      if (!me.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        return message.reply("❌ Je n'ai pas la permission **Modérer des membres**.");
      }

      const target = message.mentions.members.first();
      if (!target) return message.reply("❌ Utilisation : `!mute @membre 10m raison`");

      // Nettoyage mention pour lire temps correctement
      const cleaned = removeFirstMention(message.content).trim().split(/\s+/);
      // cleaned[0] = !mute, cleaned[1] = temps, cleaned[2..] = raison
      const timeArg = cleaned[1];
      if (!timeArg) return message.reply("❌ Utilisation : `!mute @membre 10m raison`");

      const duration = parseDuration(timeArg);
      if (!duration) {
        return message.reply("❌ Temps invalide. Ex: `30s`, `10m`, `2h`, `1d`, `1w`, `1h30m`");
      }

      if (duration > MAX_TIMEOUT_MS) {
        return message.reply("❌ Maximum : 28 jours.");
      }

      const reason = cleaned.slice(2).join(" ") || "Aucune raison fournie.";

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
        return message.reply("❌ Tu n'as pas la permission **Modérer des membres**.");
      }

      const me = await message.guild.members.fetchMe();
      if (!me.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        return message.reply("❌ Je n'ai pas la permission **Modérer des membres**.");
      }

      const target = message.mentions.members.first();
      if (!target) return message.reply("❌ Utilisation : `!unmute @membre`");

      try {
        await target.timeout(null);
        return message.reply(`🔊 **${target.user.tag}** unmute.`);
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