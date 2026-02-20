const { Client, GatewayIntentBits, PermissionsBitField } = require("discord.js");
const { joinVoiceChannel, getVoiceConnection } = require("@discordjs/voice");

const PREFIX = "!";
const TOKEN = process.env.DISCORD_TOKEN;

if (!TOKEN) {
  console.error("❌ DISCORD_TOKEN manquant dans Railway.");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
  ],
});

client.once("ready", () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

// -------- Utils --------

function parseDuration(input) {
  // Accepte: 34s, 23m, 23min, 2h, 1j, 1d
  if (!input) return null;
  const str = input.toLowerCase().trim();

  // remplacements utiles
  const normalized = str
    .replace("mins", "min")
    .replace("minutes", "min")
    .replace("minute", "min")
    .replace("sec", "s")
    .replace("secs", "s")
    .replace("secondes", "s")
    .replace("seconde", "s")
    .replace("heures", "h")
    .replace("heure", "h")
    .replace("jours", "j")
    .replace("jour", "j");

  const match = normalized.match(/^(\d+)\s*(s|min|m|h|j|d)$/);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2];

  if (value <= 0) return null;

  // discord timeout max: 28 jours
  const MAX_MS = 28 * 24 * 60 * 60 * 1000;

  let ms = 0;
  if (unit === "s") ms = value * 1000;
  else if (unit === "m" || unit === "min") ms = value * 60 * 1000;
  else if (unit === "h") ms = value * 60 * 60 * 1000;
  else if (unit === "j" || unit === "d") ms = value * 24 * 60 * 60 * 1000;

  if (ms > MAX_MS) return null;
  return ms;
}

function prettyDuration(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}j`;
}

function getMemberFromMention(message, arg) {
  if (!arg) return null;
  const id = arg.replace(/[<@!>]/g, "");
  return message.guild.members.cache.get(id) || null;
}

// -------- Commands --------

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const cmd = (args.shift() || "").toLowerCase();

    // ---------------- JOIN ----------------
    if (cmd === "join") {
      const voice = message.member.voice.channel;
      if (!voice) return message.reply("❌ Tu dois être dans un vocal.");

      // permissions du bot
      const perms = voice.permissionsFor(message.guild.members.me);
      if (!perms?.has(PermissionsBitField.Flags.Connect))
        return message.reply("❌ Je n'ai pas la permission de me connecter.");
      if (!perms?.has(PermissionsBitField.Flags.Speak))
        return message.reply("❌ Je n'ai pas la permission de parler.");

      joinVoiceChannel({
        channelId: voice.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
        selfDeaf: false,
      });

      return message.reply(`✅ Je rejoins le vocal **${voice.name}**.`);
    }

    // ---------------- LEAVE ----------------
    if (cmd === "leave") {
      const connection = getVoiceConnection(message.guild.id);
      if (!connection) return message.reply("❌ Je ne suis dans aucun vocal.");

      // On essaye d'afficher le nom du vocal si possible
      const channel = message.guild.channels.cache.get(connection.joinConfig.channelId);
      connection.destroy();

      return message.reply(
        `👋 Je quitte le vocal${channel?.name ? ` **${channel.name}**` : ""}.`
      );
    }

    // ---------------- BAN ----------------
    if (cmd === "ban") {
      if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
        return message.reply("❌ Tu n'as pas la permission **Bannir des membres**.");
      if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers))
        return message.reply("❌ Je n'ai pas la permission **Bannir des membres**.");

      const targetArg = args.shift();
      const member = getMemberFromMention(message, targetArg);
      if (!member) return message.reply("❌ Utilisation : `!ban @membre raison`");

      const reason = args.join(" ") || "Aucune raison";
      if (!member.bannable) return message.reply("❌ Impossible de bannir (hiérarchie).");

      await member.ban({ reason });
      return message.reply(`🔨 **${member.user.username}** banni.\n📝 Raison : ${reason}`);
    }

    // ---------------- UNBAN (sans raison) ----------------
    if (cmd === "unban") {
      if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
        return message.reply("❌ Tu n'as pas la permission **Bannir des membres**.");
      if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.BanMembers))
        return message.reply("❌ Je n'ai pas la permission **Bannir des membres**.");

      const userId = args.shift();
      if (!userId) return message.reply("❌ Utilisation : `!unban ID`");

      try {
        await message.guild.members.unban(userId);
        return message.reply(`✅ ID **${userId}** unban.`);
      } catch {
        return message.reply("❌ ID invalide ou personne pas bannie.");
      }
    }

    // ---------------- MUTE (timeout) ----------------
    if (cmd === "mute") {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
        return message.reply("❌ Tu n'as pas la permission **Modérer des membres**.");
      if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ModerateMembers))
        return message.reply("❌ Je n'ai pas la permission **Modérer des membres**.");

      const targetArg = args.shift();
      const timeArg = args.shift(); // ex: 37s, 10m, 2h, 1j
      const member = getMemberFromMention(message, targetArg);

      if (!member || !timeArg) {
        return message.reply("❌ Utilisation : `!mute @membre 10m raison`");
      }

      const durationMs = parseDuration(timeArg);
      if (!durationMs) {
        return message.reply("❌ Format invalide. Ex : `34s`, `23m`, `23min`, `2h`, `1j`");
      }

      const reason = args.join(" ") || "Aucune raison";

      try {
        await member.timeout(durationMs, reason);

        const pretty = prettyDuration(durationMs);
        return message.reply(
          `🔇 **${member.user.username}** mute **${pretty}**\n📝 Raison : ${reason}`
        );
      } catch (err) {
        console.error(err);
        return message.reply("❌ Impossible de mute (permissions/hiérarchie/erreur Discord).");
      }
    }

    // ---------------- UNMUTE (remove timeout) ----------------
    if (cmd === "unmute") {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
        return message.reply("❌ Tu n'as pas la permission **Modérer des membres**.");
      if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ModerateMembers))
        return message.reply("❌ Je n'ai pas la permission **Modérer des membres**.");

      const targetArg = args.shift();
      const member = getMemberFromMention(message, targetArg);
      if (!member) return message.reply("❌ Utilisation : `!unmute @membre`");

      try {
        await member.timeout(null);
        return message.reply(`🔊 **${member.user.username}** unmute.`);
      } catch (err) {
        console.error(err);
        return message.reply("❌ Impossible de unmute (permissions/hiérarchie/erreur Discord).");
      }
    }

    // ---------------- DONNERMEMBRE ----------------
    if (cmd === "donnermembre") {
      // permission admin conseillée
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles))
        return message.reply("❌ Tu n'as pas la permission **Gérer les rôles**.");
      if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ManageRoles))
        return message.reply("❌ Je n'ai pas la permission **Gérer les rôles**.");

      const roleName = "Membre";
      const role = message.guild.roles.cache.find((r) => r.name === roleName);
      if (!role) return message.reply(`❌ Le rôle **${roleName}** n'existe pas.`);

      // prendre tous les membres (cache)
      await message.guild.members.fetch();

      const members = message.guild.members.cache.filter((m) => !m.user.bot);

      let added = 0;
      for (const m of members.values()) {
        // "aucun rôle" = uniquement @everyone => roles.size === 1
        if (m.roles.cache.size === 1) {
          if (!m.roles.cache.has(role.id)) {
            try {
              await m.roles.add(role);
              added++;
            } catch (e) {
              // ignore erreurs (hiérarchie)
            }
          }
        }
      }

      return message.reply(`✅ Rôle **${roleName}** donné à **${added}** membre(s) sans rôle.`);
    }

  } catch (err) {
    console.error(err);
  }
});

client.login(TOKEN);