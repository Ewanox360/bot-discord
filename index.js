const {
  Client,
  GatewayIntentBits,
  PermissionsBitField,
} = require("discord.js");

const {
  joinVoiceChannel,
  getVoiceConnection,
} = require("@discordjs/voice");

// ========= CONFIG =========
const TOKEN = "TON_TOKEN_ICI";
const PREFIX = "!";
const ADMIN_ROLE_NAME = "Admin";     // rôle autorisé à envoyer des liens
const MEMBER_ROLE_NAME = "membre";   // rôle donné par !donnermembre
// =========================

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

// --------- UTIL: parse durée (30s, 10m, 2h, 1j, 23min, etc.) ----------
function parseDurationToMs(input) {
  if (!input) return null;
  const s = input.trim().toLowerCase();

  // accepte : 10m, 10min, 10mins, 10minutes, 2h, 1j, 1d, 30s, 30sec...
  const match = s.match(/^(\d+)\s*(s|sec|secs|seconde|secondes|m|min|mins|minute|minutes|h|heure|heures|j|jour|jours|d|day|days)$/i);
  if (!match) return null;

  const value = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();

  if (Number.isNaN(value) || value <= 0) return null;

  const sec = ["s", "sec", "secs", "seconde", "secondes"];
  const min = ["m", "min", "mins", "minute", "minutes"];
  const hour = ["h", "heure", "heures"];
  const day = ["j", "jour", "jours", "d", "day", "days"];

  if (sec.includes(unit)) return value * 1000;
  if (min.includes(unit)) return value * 60 * 1000;
  if (hour.includes(unit)) return value * 60 * 60 * 1000;
  if (day.includes(unit)) return value * 24 * 60 * 60 * 1000;

  return null;
}

// --------- ANTI-LINK (sauf rôle Admin) ----------
client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;

    // ✅ Autorise UNIQUEMENT le rôle "Admin"
    const isAdminRole = message.member?.roles?.cache?.some((r) => r.name === ADMIN_ROLE_NAME);
    if (isAdminRole) return;

    // 🔗 Détection liens
    const linkRegex =
      /(https?:\/\/\S+)|(www\.\S+)|(discord\.gg\/\S+)|(discord\.com\/invite\/\S+)|(\b\S+\.(com|fr|net|org|gg|io|me|tv|be|xyz)\b)/i;

    if (!linkRegex.test(message.content)) return;

    // supprime si possible
    await message.delete().catch(() => {});

    // mini avertissement (supprimé après 4s)
    message.channel
      .send(`🚫 ${message.author}, les liens sont interdits ici.`)
      .then((m) => setTimeout(() => m.delete().catch(() => {}), 4000))
      .catch(() => {});
  } catch (e) {
    console.log("Anti-link error:", e);
  }
});

// --------- COMMANDES PREFIX "!" ----------
client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const cmd = (args.shift() || "").toLowerCase();

    // ========= !join =========
    if (cmd === "join") {
      const channel = message.member?.voice?.channel;
      if (!channel) return message.reply("❌ Tu dois être dans un vocal.");

      joinVoiceChannel({
        channelId: channel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
        selfDeaf: true,
      });

      return message.reply(`✅ Je rejoins **${channel.name}**`);
    }

    // ========= !leave =========
    if (cmd === "leave") {
      const connection = getVoiceConnection(message.guild.id);
      if (!connection) return message.reply("❌ Je ne suis dans aucun vocal.");
      connection.destroy();
      return message.reply("✅ J’ai quitté le vocal.");
    }

    // ========= !ban @user [raison] =========
    if (cmd === "ban") {
      if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        return message.reply("❌ Tu n’as pas la permission de ban.");
      }

      const target = message.mentions.members.first();
      if (!target) return message.reply("❌ Mentionne quelqu’un : `!ban @pseudo raison`");

      const reason = args.join(" ") || "Aucune raison";
      await target.ban({ reason }).catch(() => null);

      return message.reply(`✅ **${target.user.tag}** a été banni. Raison: ${reason}`);
    }

    // ========= !unban <id> =========
    if (cmd === "unban") {
      if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        return message.reply("❌ Tu n’as pas la permission de unban.");
      }

      const userId = args[0];
      if (!userId) return message.reply("❌ Exemple: `!unban 123456789012345678`");

      await message.guild.bans.remove(userId).catch(() => null);
      return message.reply(`✅ ID **${userId}** débanni.`);
    }

    // ========= !mute @user <durée> [raison] =========
    if (cmd === "mute") {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        return message.reply("❌ Tu n’as pas la permission de mute (timeout).");
      }

      const target = message.mentions.members.first();
      if (!target) return message.reply("❌ Exemple: `!mute @pseudo 10m spam`");

      const durationStr = args[0];
      const durationMs = parseDurationToMs(durationStr);
      if (!durationMs) {
        return message.reply("❌ Durée invalide. Exemples: `30s`, `10m`, `2h`, `1j`, `23min`");
      }

      // Discord timeout max = 28 jours
      const maxMs = 28 * 24 * 60 * 60 * 1000;
      if (durationMs > maxMs) return message.reply("❌ Durée trop longue (max 28 jours).");

      const reason = args.slice(1).join(" ") || "Aucune raison";

      await target.timeout(durationMs, reason).catch(() => null);

      return message.reply(`✅ **${target.user.tag}** mute ${durationStr}. Raison: ${reason}`);
    }

    // ========= !donnermembre =========
    if (cmd === "donnermembre") {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return message.reply("❌ Tu n’as pas la permission de gérer les rôles.");
      }

      const role = message.guild.roles.cache.find((r) => r.name === MEMBER_ROLE_NAME);
      if (!role) return message.reply(`❌ Rôle introuvable: **${MEMBER_ROLE_NAME}**`);

      const members = await message.guild.members.fetch();
      let count = 0;

      for (const [, m] of members) {
        if (m.user.bot) continue;
        if (m.roles.cache.has(role.id)) continue;

        await m.roles.add(role).catch(() => {});
        count++;
      }

      return message.reply(`✅ Rôle **${MEMBER_ROLE_NAME}** donné à **${count}** membre(s).`);
    }

    // ========= commandes inconnues =========
    // (tu peux enlever ça si tu veux)
    // return message.reply("❌ Commande inconnue.");
  } catch (e) {
    console.log("Command error:", e);
  }
});

client.login(TOKEN);