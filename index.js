require("dotenv").config();

const { Client, GatewayIntentBits, PermissionsBitField } = require("discord.js");
const { joinVoiceChannel, getVoiceConnection } = require("@discordjs/voice");

const PREFIX = "!";
const TOKEN = process.env.DISCORD_TOKEN;
const MEMBER_ROLE_NAME = "Membre";
const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // 28 jours max

// ---------- Parse durée flexible (10s, 5m, 2h, 1d, 1w, 1h30m, 2d6h...)
function parseDuration(input) {
  if (!input) return null;

  const regex = /(\d+)\s*(w|d|h|m|s)/gi;
  let match;
  let totalMs = 0;

  const mult = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
  };

  while ((match = regex.exec(input)) !== null) {
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    if (!mult[unit]) return null;
    totalMs += value * mult[unit];
  }

  if (totalMs <= 0) return null;

  const cleaned = input.toLowerCase().replace(regex, "").replace(/\s+/g, "");
  if (cleaned.length !== 0) return null;

  return totalMs;
}

function prettyDuration(ms) {
  const s = Math.floor(ms / 1000);
  const w = Math.floor(s / 604800);
  const d = Math.floor((s % 604800) / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  const parts = [];
  if (w) parts.push(`${w}w`);
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (sec) parts.push(`${sec}s`);
  return parts.join(" ");
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

client.once("ready", () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const command = (args.shift() || "").toLowerCase();

    // ===================== HELP
    if (command === "help") {
      return message.reply(
        [
          "📌 **Commandes :**",
          "🎧 `!join`",
          "👋 `!leave`",
          "🔇 `!mute @membre 1h30m`",
          "🔊 `!unmute @membre`",
          "⛔ `!ban @membre raison`",
          "✅ `!unban ID`",
          `👥 \`!donnermembre\` (donne le rôle ${MEMBER_ROLE_NAME} à tous)`
        ].join("\n")
      );
    }

    // ===================== JOIN
    if (command === "join") {
      const channel = message.member.voice?.channel;
      if (!channel) return message.reply("❌ Tu dois être en vocal.");

      const existing = getVoiceConnection(message.guild.id);
      if (existing) return message.reply("✅ Déjà en vocal.");

      joinVoiceChannel({
        channelId: channel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
        selfDeaf: false,
      });

      return message.reply("✅ Je rejoins le vocal.");
    }

    // ===================== LEAVE
    if (command === "leave") {
      const connection = getVoiceConnection(message.guild.id);
      if (!connection) return message.reply("❌ Je ne suis pas en vocal.");

      connection.destroy();
      return message.reply("👋 Je quitte le vocal.");
    }

    // ===================== DONNER MEMBRE (à tous)
    if (command === "donnermembre") {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return message.reply("❌ Permission Gérer les rôles requise.");
      }

      const role = message.guild.roles.cache.find(r => r.name === MEMBER_ROLE_NAME);
      if (!role) return message.reply(`❌ Le rôle ${MEMBER_ROLE_NAME} n'existe pas.`);

      const me = message.guild.members.me;
      if (role.position >= me.roles.highest.position) {
        return message.reply("❌ Mets le rôle du bot au-dessus du rôle Membre.");
      }

      await message.guild.members.fetch();

      const membersWithoutRole = message.guild.members.cache.filter(
        member => !member.user.bot && !member.roles.cache.has(role.id)
      );

      if (membersWithoutRole.size === 0) {
        return message.reply("✅ Tout le monde a déjà le rôle.");
      }

      let success = 0;

      for (const member of membersWithoutRole.values()) {
        try {
          await member.roles.add(role);
          success++;
        } catch {}
      }

      return message.reply(`✅ ${success} membre(s) ont reçu le rôle ${MEMBER_ROLE_NAME}.`);
    }

    // ===================== MUTE
    if (command === "mute") {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        return message.reply("❌ Permission Modérer requise.");
      }

      const target = message.mentions.members.first();
      if (!target) return message.reply("❌ Utilisation : !mute @membre 10m");

      const durationText = args[0];
      const durationMs = parseDuration(durationText);
      if (!durationMs) return message.reply("❌ Durée invalide (10s, 5m, 2h, 1d...)");

      if (durationMs > MAX_TIMEOUT_MS)
        return message.reply("❌ Maximum 28 jours.");

      try {
        await target.timeout(durationMs);
        return message.reply(`🔇 ${target.user.tag} mute ${prettyDuration(durationMs)}.`);
      } catch (err) {
        console.error(err);
        return message.reply("❌ Impossible de mute.");
      }
    }

    // ===================== UNMUTE
    if (command === "unmute") {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        return message.reply("❌ Permission Modérer requise.");
      }

      const target = message.mentions.members.first();
      if (!target) return message.reply("❌ Utilisation : !unmute @membre");

      try {
        await target.timeout(null);
        return message.reply(`🔊 ${target.user.tag} est unmute.`);
      } catch (err) {
        console.error(err);
        return message.reply("❌ Impossible de unmute.");
      }
    }

    // ===================== BAN
    if (command === "ban") {
      if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        return message.reply("❌ Permission Ban requise.");
      }

      const target = message.mentions.members.first();
      if (!target) return message.reply("❌ Utilisation : !ban @membre raison");

      const reason = args.join(" ") || "Aucune raison";

      try {
        await target.ban({ reason });
        return message.reply(`⛔ ${target.user.tag} banni.`);
      } catch (err) {
        console.error(err);
        return message.reply("❌ Impossible de ban.");
      }
    }

    // ===================== UNBAN (SANS RAISON)
    if (command === "unban") {
      if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        return message.reply("❌ Permission Ban requise.");
      }

      const userId = args[0];
      if (!userId) return message.reply("❌ Utilisation : !unban ID");

      try {
        await message.guild.members.unban(userId);
        return message.reply(`✅ Utilisateur ${userId} unban.`);
      } catch (err) {
        console.error(err);
        return message.reply("❌ Impossible de unban (ID invalide ou pas banni).");
      }
    }

    return message.reply("❓ Commande inconnue.");
  } catch (e) {
    console.error(e);
    return message.reply("❌ Erreur interne.");
  }
});

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN manquant dans Railway.");
  process.exit(1);
}

client.login(TOKEN);