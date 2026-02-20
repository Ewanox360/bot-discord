const {
  Client,
  GatewayIntentBits,
  Partials,
  PermissionsBitField,
} = require("discord.js");

const {
  joinVoiceChannel,
  getVoiceConnection,
  VoiceConnectionStatus,
} = require("@discordjs/voice");

const ms = require("ms");

const PREFIX = "!";
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Channel],
});

// ✅ Token via variable Railway: BOT_TOKEN
const TOKEN = process.env.BOT_TOKEN;

client.once("ready", () => {
  console.log(`Connecté en tant que ${client.user.tag}`);
});

// --- Helpers ---
function parseDuration(input) {
  // accepte : 10m, 2h, 1d, 1j, 30s
  if (!input) return null;
  const normalized = input.toLowerCase().replace(/j/g, "d"); // "j" -> "d"
  const value = ms(normalized);
  if (!value || value < 1000) return null;
  // Discord timeout max ~ 28 jours
  const max = 28 * 24 * 60 * 60 * 1000;
  if (value > max) return null;
  return value;
}

function requireGuild(message) {
  if (!message.guild) {
    message.reply("❌ Cette commande fonctionne uniquement sur un serveur.");
    return false;
  }
  return true;
}

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
  const cmd = (args.shift() || "").toLowerCase();

  // =========================
  // ✅ !join
  // =========================
  if (cmd === "join") {
    if (!requireGuild(message)) return;

    const member = message.member;
    const channel = member?.voice?.channel;

    if (!channel) {
      return message.reply("❌ Tu dois être dans un vocal pour que je te rejoigne.");
    }

    // Permissions du bot
    const me = message.guild.members.me;
    const perms = channel.permissionsFor(me);
    if (!perms?.has(PermissionsBitField.Flags.Connect)) {
      return message.reply("❌ Je n'ai pas la permission **Se connecter** dans ce vocal.");
    }

    try {
      // Détruit une ancienne connexion si elle existe (évite les bugs)
      const old = getVoiceConnection(message.guild.id);
      if (old) old.destroy();

      const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
        selfDeaf: true,
      });

      // Si la connexion crash, on la détruit proprement
      connection.on(VoiceConnectionStatus.Disconnected, () => {
        try {
          connection.destroy();
        } catch {}
      });

      return message.reply("✅ Je rejoins le vocal.");
    } catch (err) {
      console.error(err);
      return message.reply("❌ Erreur join (regarde les logs Railway).");
    }
  }

  // =========================
  // ✅ !leave  (FIX: destroy())
  // =========================
  if (cmd === "leave") {
    if (!requireGuild(message)) return;

    try {
      const connection = getVoiceConnection(message.guild.id);

      if (!connection) {
        return message.reply("❌ Je ne suis dans aucun vocal.");
      }

      // ✅ LE PLUS IMPORTANT : destroy()
      connection.destroy();

      return message.reply("👋 Je quitte le vocal.");
    } catch (err) {
      console.error(err);
      return message.reply("❌ Erreur leave (regarde les logs Railway).");
    }
  }

  // =========================
  // ✅ !mute @pseudo 10m raison
  // =========================
  if (cmd === "mute") {
    if (!requireGuild(message)) return;

    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return message.reply("❌ Tu n'as pas la permission **Modérer des membres**.");
    }

    const target = message.mentions.members.first();
    const durationStr = args.shift(); // ex: 10m / 2h / 1j
    const reason = args.join(" ") || "Aucune raison";

    if (!target || !durationStr) {
      return message.reply("❌ Utilisation : `!mute @membre 10m raison` (temps: 10m/2h/1j)");
    }

    const duration = parseDuration(durationStr);
    if (!duration) {
      return message.reply("❌ Temps invalide. Exemples: `10m`, `2h`, `1j`.");
    }

    // Evite de mute un modo/admin si tu veux (optionnel)
    if (target.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("❌ Je ne peux pas mute un administrateur.");
    }

    // Hiérarchie rôle bot vs cible
    const me = message.guild.members.me;
    if (target.roles.highest.position >= me.roles.highest.position) {
      return message.reply("❌ Je ne peux pas mute cette personne (rôle trop haut).");
    }

    try {
      await target.timeout(duration, reason);
      return message.reply(
        `✅ ${target.user.tag} mute pour **${durationStr}**.\n📝 Raison: **${reason}**`
      );
    } catch (err) {
      console.error(err);
      return message.reply("❌ Impossible de mute (permissions/hiérarchie/erreur Discord).");
    }
  }

  // =========================
  // ✅ !unmute @pseudo
  // =========================
  if (cmd === "unmute") {
    if (!requireGuild(message)) return;

    if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
      return message.reply("❌ Tu n'as pas la permission **Modérer des membres**.");
    }

    const target = message.mentions.members.first();
    if (!target) {
      return message.reply("❌ Utilisation : `!unmute @membre`");
    }

    try {
      await target.timeout(null);
      return message.reply(`✅ ${target.user.tag} n'est plus mute.`);
    } catch (err) {
      console.error(err);
      return message.reply("❌ Impossible d'unmute (permissions/hiérarchie/erreur Discord).");
    }
  }

  // =========================
  // ✅ !ban @pseudo raison
  // =========================
  if (cmd === "ban") {
    if (!requireGuild(message)) return;

    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return message.reply("❌ Tu n'as pas la permission **Bannir des membres**.");
    }

    const target = message.mentions.members.first();
    const reason = args.join(" ") || "Aucune raison";

    if (!target) {
      return message.reply("❌ Utilisation : `!ban @membre raison`");
    }

    const me = message.guild.members.me;
    if (target.roles.highest.position >= me.roles.highest.position) {
      return message.reply("❌ Je ne peux pas ban cette personne (rôle trop haut).");
    }

    try {
      await target.ban({ reason });
      return message.reply(`✅ ${target.user.tag} a été banni.\n📝 Raison: **${reason}**`);
    } catch (err) {
      console.error(err);
      return message.reply("❌ Impossible de ban (permissions/hiérarchie/erreur Discord).");
    }
  }

  // =========================
  // ✅ !unban ID raison
  // (Discord unban = user ID)
  // =========================
  if (cmd === "unban") {
    if (!requireGuild(message)) return;

    if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
      return message.reply("❌ Tu n'as pas la permission **Bannir des membres**.");
    }

    const userId = args.shift();
    const reason = args.join(" ") || "Aucune raison";

    if (!userId) {
      return message.reply("❌ Utilisation : `!unban ID raison`");
    }

    try {
      await message.guild.members.unban(userId, reason);
      return message.reply(`✅ Unban effectué pour **${userId}**.\n📝 Raison: **${reason}**`);
    } catch (err) {
      console.error(err);
      return message.reply("❌ Impossible d'unban (ID invalide / pas banni / erreur Discord).");
    }
  }
});

client.login(TOKEN);