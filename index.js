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
  entersState,
} = require("@discordjs/voice");

const PREFIX = "!";
const MEMBER_ROLE_NAME = "Membre";

// Railway: mets une variable d'env DISCORD_TOKEN
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
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
  partials: [Partials.Channel],
});

client.once("ready", () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

/**
 * Parse des durées:
 * - "34s", "23m", "2h", "1j"
 * - "1h30m", "2h15m10s"
 * - "23min", "10minutes", "5sec", "2heures", "1jour"
 */
function parseDurationToMs(inputRaw) {
  if (!inputRaw || typeof inputRaw !== "string") return null;
  const input = inputRaw.toLowerCase().replace(/\s+/g, "");

  // Autorise uniquement chiffres + lettres (unités)
  if (!/^[0-9a-z]+$/.test(input)) return null;

  const unitMap = {
    s: 1000,
    sec: 1000,
    secs: 1000,
    seconde: 1000,
    secondes: 1000,

    m: 60 * 1000,
    min: 60 * 1000,
    mins: 60 * 1000,
    minute: 60 * 1000,
    minutes: 60 * 1000,

    h: 60 * 60 * 1000,
    heure: 60 * 60 * 1000,
    heures: 60 * 60 * 1000,

    j: 24 * 60 * 60 * 1000,
    jour: 24 * 60 * 60 * 1000,
    jours: 24 * 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000, // au cas où
    day: 24 * 60 * 60 * 1000,
    days: 24 * 60 * 60 * 1000,
  };

  // Cherche toutes les paires (nombre)(unité)
  const matches = input.matchAll(/(\d+)([a-z]+)/g);

  let total = 0;
  let found = 0;

  for (const m of matches) {
    const num = Number(m[1]);
    const unit = m[2];

    if (!Number.isFinite(num) || num <= 0) return null;
    if (!unitMap[unit]) return null;

    total += num * unitMap[unit];
    found++;
  }

  // Si rien trouvé ou si la chaîne n'est pas entièrement consommée
  // ex: "10mabc" => invalid
  const rebuilt = Array.from(input.matchAll(/(\d+)([a-z]+)/g))
    .map((x) => `${x[1]}${x[2]}`)
    .join("");
  if (found === 0 || rebuilt !== input) return null;

  // Limite Discord timeout: max 28 jours
  const max = 28 * 24 * 60 * 60 * 1000;
  if (total > max) return { error: "TOO_LONG" };

  return { ms: total };
}

function hasPerm(member, perm) {
  return member.permissions.has(perm);
}

function canModerate(me, target) {
  // Le bot doit être au-dessus dans la hiérarchie
  // target.roles.highest.position < me.roles.highest.position
  return (
    target.roles.highest.position < me.roles.highest.position &&
    !target.user.bot // tu peux enlever ça si tu veux modérer des bots
  );
}

client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return; // ignore DM
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const cmd = (args.shift() || "").toLowerCase();

    // ===== HELP (liste des commandes) =====
    if (cmd === "help" || cmd === "aide" || cmd === "commandes") {
      return message.reply(
        [
          "📌 **Commandes disponibles :**",
          `• \`${PREFIX}join\` → je rejoins ton vocal`,
          `• \`${PREFIX}leave\` → je quitte le vocal`,
          `• \`${PREFIX}ban @membre [raison]\``,
          `• \`${PREFIX}unban <ID>\``,
          `• \`${PREFIX}mute @membre <durée> [raison]\`  (ex: 34s / 23m / 2h / 1j / 1h30m / 10minutes)`,
          `• \`${PREFIX}unmute @membre\``,
          `• \`${PREFIX}donnermembre\` → donne le rôle **${MEMBER_ROLE_NAME}** à tous ceux qui ne l’ont pas`,
        ].join("\n")
      );
    }

    // ===== JOIN =====
    if (cmd === "join") {
      const vc = message.member?.voice?.channel;
      if (!vc) return message.reply("❌ Tu dois être dans un vocal.");

      const me = message.guild.members.me;
      if (!me) return message.reply("❌ Impossible de récupérer le bot.");

      // Perms vocal
      const perms = vc.permissionsFor(me);
      if (!perms?.has(PermissionsBitField.Flags.Connect))
        return message.reply("❌ Je n'ai pas la permission **Se connecter**.");
      if (!perms?.has(PermissionsBitField.Flags.Speak))
        return message.reply("⚠️ Je peux rejoindre, mais je n'ai pas **Parler**.");

      // (Re)join
      const connection = joinVoiceChannel({
        channelId: vc.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
        selfDeaf: false,
        selfMute: false,
      });

      try {
        await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
      } catch {
        // Si pas "Ready", on détruit la connexion
        try {
          connection.destroy();
        } catch {}
        return message.reply("❌ Problème pour rejoindre le vocal (connexion).");
      }

      return message.reply("✅ Je rejoins le vocal.");
    }

    // ===== LEAVE =====
    if (cmd === "leave") {
      const connection = getVoiceConnection(message.guild.id);
      if (!connection) return message.reply("❌ Je ne suis dans aucun vocal.");

      try {
        connection.destroy(); // ← ça quitte vraiment
      } catch (e) {
        console.error(e);
        return message.reply("❌ Erreur en quittant le vocal.");
      }

      return message.reply("👋 Je quitte le vocal.");
    }

    // ===== BAN =====
    if (cmd === "ban") {
      if (!hasPerm(message.member, PermissionsBitField.Flags.BanMembers)) {
        return message.reply("❌ Tu n'as pas la permission **Bannir des membres**.");
      }

      const target = message.mentions.members.first();
      if (!target) return message.reply(`❌ Utilisation : \`${PREFIX}ban @membre [raison]\``);

      const me = message.guild.members.me;
      if (!me) return message.reply("❌ Impossible de récupérer le bot.");

      if (!hasPerm(me, PermissionsBitField.Flags.BanMembers)) {
        return message.reply("❌ Je n'ai pas la permission **Bannir des membres**.");
      }

      if (!canModerate(me, target)) {
        return message.reply("❌ Je ne peux pas bannir ce membre (hiérarchie/rôle).");
      }

      const reason = args.slice(1).join(" ") || "Aucune raison";

      try {
        await target.ban({ reason });
        return message.reply(`✅ **${target.user.tag}** a été banni.`);
      } catch (err) {
        console.error(err);
        return message.reply("❌ Impossible de bannir (permissions/hierarchie/erreur Discord).");
      }
    }

    // ===== UNBAN (sans raison) =====
    if (cmd === "unban") {
      if (!hasPerm(message.member, PermissionsBitField.Flags.BanMembers)) {
        return message.reply("❌ Tu n'as pas la permission **Bannir des membres**.");
      }

      const id = args[0];
      if (!id || !/^\d{16,20}$/.test(id)) {
        return message.reply(`❌ Utilisation : \`${PREFIX}unban <ID>\``);
      }

      const me = message.guild.members.me;
      if (!me) return message.reply("❌ Impossible de récupérer le bot.");
      if (!hasPerm(me, PermissionsBitField.Flags.BanMembers)) {
        return message.reply("❌ Je n'ai pas la permission **Bannir des membres**.");
      }

      try {
        await message.guild.members.unban(id);
        return message.reply(`✅ ID **${id}** a été débanni.`);
      } catch (err) {
        console.error(err);
        return message.reply("❌ Impossible de débannir (ID invalide ou pas banni).");
      }
    }

    // ===== MUTE (timeout) =====
    if (cmd === "mute") {
      if (!hasPerm(message.member, PermissionsBitField.Flags.ModerateMembers)) {
        return message.reply("❌ Tu n'as pas la permission **Modérer des membres**.");
      }

      const target = message.mentions.members.first();
      if (!target) {
        return message.reply(`❌ Utilisation : \`${PREFIX}mute @membre 10m [raison]\``);
      }

      const me = message.guild.members.me;
      if (!me) return message.reply("❌ Impossible de récupérer le bot.");

      if (!hasPerm(me, PermissionsBitField.Flags.ModerateMembers)) {
        return message.reply("❌ Je n'ai pas la permission **Modérer des membres**.");
      }

      if (!canModerate(me, target)) {
        return message.reply("❌ Je ne peux pas mute ce membre (hiérarchie/rôle).");
      }

      const durationRaw = args[1]; // ex: 10m, 1h30m, 23min
      if (!durationRaw) {
        return message.reply(`❌ Utilisation : \`${PREFIX}mute @membre 10m [raison]\``);
      }

      const parsed = parseDurationToMs(durationRaw);
      if (!parsed) {
        return message.reply("❌ Format invalide. Ex: `34s` / `23m` / `2h` / `1j` / `1h30m` / `10minutes`");
      }
      if (parsed.error === "TOO_LONG") {
        return message.reply("❌ Trop long : maximum **28 jours**.");
      }

      const reason = args.slice(2).join(" ") || "Aucune raison";

      try {
        await target.timeout(parsed.ms, reason);
        return message.reply(
          `✅ **${target.user.tag}** est mute pour **${durationRaw}**.`
        );
      } catch (err) {
        console.error(err);
        return message.reply("❌ Impossible de mute (permissions/hierarchie/erreur Discord).");
      }
    }

    // ===== UNMUTE =====
    if (cmd === "unmute") {
      if (!hasPerm(message.member, PermissionsBitField.Flags.ModerateMembers)) {
        return message.reply("❌ Tu n'as pas la permission **Modérer des membres**.");
      }

      const target = message.mentions.members.first();
      if (!target) return message.reply(`❌ Utilisation : \`${PREFIX}unmute @membre\``);

      const me = message.guild.members.me;
      if (!me) return message.reply("❌ Impossible de récupérer le bot.");
      if (!hasPerm(me, PermissionsBitField.Flags.ModerateMembers)) {
        return message.reply("❌ Je n'ai pas la permission **Modérer des membres**.");
      }

      try {
        await target.timeout(null);
        return message.reply(`✅ **${target.user.tag}** n'est plus mute.`);
      } catch (err) {
        console.error(err);
        return message.reply("❌ Impossible d'unmute (permissions/erreur Discord).");
      }
    }

    // ===== DONNER ROLE MEMBRE A TOUT LE MONDE =====
    if (cmd === "donnermembre") {
      if (!hasPerm(message.member, PermissionsBitField.Flags.ManageRoles)) {
        return message.reply("❌ Tu n'as pas la permission **Gérer les rôles**.");
      }

      const me = message.guild.members.me;
      if (!me) return message.reply("❌ Impossible de récupérer le bot.");
      if (!hasPerm(me, PermissionsBitField.Flags.ManageRoles)) {
        return message.reply("❌ Je n'ai pas la permission **Gérer les rôles**.");
      }

      const role = message.guild.roles.cache.find(
        (r) => r.name.toLowerCase() === MEMBER_ROLE_NAME.toLowerCase()
      );
      if (!role) return message.reply(`❌ Rôle introuvable : **${MEMBER_ROLE_NAME}**`);

      // Le bot doit être au-dessus du rôle
      if (role.position >= me.roles.highest.position) {
        return message.reply("❌ Le rôle **membre** est au-dessus (ou égal) au rôle du bot. Monte le rôle du bot.");
      }

      await message.reply("⏳ Je donne le rôle à ceux qui ne l'ont pas...");

      let added = 0;
      let checked = 0;

      const members = await message.guild.members.fetch();
      for (const [, m] of members) {
        checked++;
        if (m.user.bot) continue;
        if (m.roles.cache.has(role.id)) continue;

        try {
          await m.roles.add(role);
          added++;
        } catch (e) {
          // on ignore les erreurs individuelles (permissions etc.)
        }
      }

      return message.channel.send(
        `✅ Terminé. Ajouté à **${added}** membres (sur **${checked}**).`
      );
    }

    // Si commande inconnue
    return message.reply(`❓ Commande inconnue. Tape \`${PREFIX}help\`.`);
  } catch (err) {
    console.error(err);
    try {
      return message.reply("❌ Erreur interne.");
    } catch {}
  }
});

client.login(TOKEN);