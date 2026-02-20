const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');

const {
  joinVoiceChannel,
  getVoiceConnection,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior,
} = require('@discordjs/voice');

const play = require('play-dl');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// 🔐 Token uniquement via Railway -> Variables -> TOKEN
const TOKEN = process.env.TOKEN;

// --- Audio par serveur (une lecture à la fois par serveur) ---
const guildAudio = new Map(); // guildId -> { player, connection }

function getOrCreateAudio(guildId) {
  let data = guildAudio.get(guildId);
  if (!data) {
    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
    });
    data = { player, connection: null };
    guildAudio.set(guildId, data);
  }
  return data;
}

client.once('ready', () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;

    const args = message.content.trim().split(/\s+/);
    const cmd = (args.shift() || '').toLowerCase();

    // ======================
    // !verifmembre
    // ======================
    if (cmd === '!verifmembre') {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        return message.reply("❌ Permission refusée (Gérer le serveur).");
      }

      const role = message.guild.roles.cache.find((r) => r.name === 'Membre');
      if (!role) return message.reply("❌ Le rôle **Membre** n'existe pas.");

      await message.guild.members.fetch();

      const sansRole = message.guild.members.cache.filter(
        (m) => !m.user.bot && !m.roles.cache.has(role.id)
      );

      if (sansRole.size === 0) return message.reply("✅ Tout le monde a le rôle **Membre**.");

      const liste = sansRole.map((m) => `<@${m.id}>`).join('\n');
      return message.reply(`⚠️ Membres sans le rôle **Membre** (${sansRole.size}) :\n${liste}`);
    }

    // ======================
    // !donnermembre
    // ======================
    if (cmd === '!donnermembre') {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ManageGuild)) {
        return message.reply("❌ Permission refusée (Gérer le serveur).");
      }

      const role = message.guild.roles.cache.find((r) => r.name === 'Membre');
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

      return message.reply(`✅ Terminé : rôle **Membre** donné à **${ok}** membres. ❌ Échecs : **${fail}**.`);
    }

    // ======================
    // !ban @membre raison...
    // ======================
    if (cmd === '!ban') {
      if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        return message.reply("❌ Tu n'as pas la permission de bannir.");
      }

      const me = await message.guild.members.fetchMe();
      if (!me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        return message.reply("❌ Je n'ai pas la permission **Bannir des membres**.");
      }

      const target = message.mentions.members.first();
      if (!target) return message.reply("❌ Utilisation : `!ban @membre raison`");

      if (target.id === message.author.id) return message.reply("❌ Tu ne peux pas te bannir toi-même.");
      if (target.id === client.user.id) return message.reply("❌ Je ne peux pas me bannir 😄");

      if (
        message.member.roles.highest.position <= target.roles.highest.position &&
        message.guild.ownerId !== message.author.id
      ) {
        return message.reply("❌ Tu ne peux pas bannir quelqu’un avec un rôle égal/supérieur au tien.");
      }

      if ((await message.guild.members.fetchMe()).roles.highest.position <= target.roles.highest.position) {
        return message.reply("❌ Je ne peux pas bannir ce membre : mets le rôle du bot plus haut.");
      }

      const reason = args.slice(1).join(' ') || 'Aucune raison fournie.';

      try {
        await target.ban({ reason });
        return message.channel.send(`🔨 **${target.user.tag}** a été banni.\n📝 Raison : ${reason}`);
      } catch (err) {
        console.error(err);
        return message.reply("❌ Impossible de bannir (permissions/hiérarchie/erreur).");
      }
    }

    // ======================
    // !unban pseudo
    // (recherche par username uniquement)
    // ======================
    if (cmd === '!unban') {
      if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        return message.reply("❌ Tu n'as pas la permission de débannir.");
      }

      const me = await message.guild.members.fetchMe();
      if (!me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        return message.reply("❌ Je n'ai pas la permission **Bannir/Débannir**.");
      }

      const pseudo = args.join(' ');
      if (!pseudo) return message.reply("❌ Utilisation : `!unban pseudo`");

      try {
        const bans = await message.guild.bans.fetch();
        const banned = bans.find((b) => b.user.username.toLowerCase() === pseudo.toLowerCase());

        if (!banned) return message.reply("❌ Aucun utilisateur banni avec ce pseudo.");

        await message.guild.members.unban(banned.user.id);
        return message.channel.send(`✅ **${banned.user.tag}** a été débanni.`);
      } catch (err) {
        console.error(err);
        return message.reply("❌ Erreur lors du débannissement.");
      }
    }

    // ======================
    // !mute @membre 10m/2h/1d raison...
    // (timeout Discord => serveur entier)
    // ======================
    if (cmd === '!mute') {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        return message.reply("❌ Tu n'as pas la permission de mute (modérer).");
      }

      const me = await message.guild.members.fetchMe();
      if (!me.permissions.has(PermissionsBitField.Flags.ModerateMembers)) {
        return message.reply("❌ Je n'ai pas la permission **Modérer des membres**.");
      }

      const target = message.mentions.members.first();
      if (!target) return message.reply("❌ Utilisation : `!mute @membre 10m raison`");

      if (target.id === message.author.id) return message.reply("❌ Tu ne peux pas te mute toi-même.");
      if (target.id === client.user.id) return message.reply("❌ Je ne peux pas me mute 😄");

      if (
        message.member.roles.highest.position <= target.roles.highest.position &&
        message.guild.ownerId !== message.author.id
      ) {
        return message.reply("❌ Tu ne peux pas mute quelqu’un avec un rôle égal/supérieur au tien.");
      }

      if (me.roles.highest.position <= target.roles.highest.position) {
        return message.reply("❌ Je ne peux pas mute ce membre : mets le rôle du bot plus haut.");
      }

      const timeArg = args[1]; // args: ["@membre", "10m", "raison..."]
      if (!timeArg) return message.reply("❌ Donne une durée : `10m`, `2h`, `1d`.");

      const match = timeArg.match(/^(\d+)([mhd])$/i);
      if (!match) return message.reply("❌ Format invalide. Exemple : `!mute @membre 10m spam`");

      const amount = parseInt(match[1], 10);
      const unit = match[2].toLowerCase();

      let durationMs = 0;
      if (unit === 'm') durationMs = amount * 60 * 1000;
      if (unit === 'h') durationMs = amount * 60 * 60 * 1000;
      if (unit === 'd') durationMs = amount * 24 * 60 * 60 * 1000;

      if (amount <= 0 || !Number.isFinite(durationMs)) return message.reply("❌ Durée invalide.");

      const maxMs = 28 * 24 * 60 * 60 * 1000; // 28 jours
      if (durationMs > maxMs) return message.reply("❌ Maximum : 28 jours.");

      const reason = args.slice(2).join(' ') || 'Aucune raison fournie.';

      try {
        await target.timeout(durationMs, reason);
        return message.channel.send(`🔇 **${target.user.tag}** mute pour **${timeArg}**.\n📝 Raison : ${reason}`);
      } catch (err) {
        console.error(err);
        return message.reply("❌ Erreur lors du mute (permissions/hiérarchie).");
      }
    }

    // ======================
    // !unmute @membre
    // ======================
    if (cmd === '!unmute') {
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
        return message.reply("❌ Erreur lors du unmute.");
      }
    }

    // ======================
    // !join / !leave
    // ======================
    if (cmd === '!join') {
      const voiceChannel = message.member?.voice?.channel;
      if (!voiceChannel) {
        return message.reply("❌ Tu dois être dans un salon vocal pour que je te rejoigne.");
      }

      const perms = voiceChannel.permissionsFor(message.guild.members.me);
      if (!perms?.has(PermissionsBitField.Flags.Connect)) {
        return message.reply("❌ Je n'ai pas la permission **Se connecter** à ce vocal.");
      }

      joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
        selfDeaf: true,
      });

      return message.reply(`✅ Je rejoins **${voiceChannel.name}** !`);
    }

    if (cmd === '!leave') {
      const conn = getVoiceConnection(message.guild.id);
      if (!conn) return message.reply("❌ Je ne suis pas dans un salon vocal.");

      conn.destroy();
      guildAudio.delete(message.guild.id);
      return message.reply("✅ J'ai quitté le vocal.");
    }

    // ======================
    // YouTube Audio: !play / !stop
    // ======================
    if (cmd === '!play') {
      const url = args[0];
      if (!url) return message.reply("❌ Utilisation : `!play <lien YouTube>`");

      const voiceChannel = message.member?.voice?.channel;
      if (!voiceChannel) return message.reply("❌ Va dans un salon vocal puis refais `!play`.");

      const perms = voiceChannel.permissionsFor(message.guild.members.me);
      if (!perms?.has(PermissionsBitField.Flags.Connect)) {
        return message.reply("❌ Je n'ai pas la permission **Se connecter** au vocal.");
      }
      if (!perms?.has(PermissionsBitField.Flags.Speak)) {
        return message.reply("❌ Je n'ai pas la permission **Parler** dans le vocal.");
      }

      if (!play.yt_validate(url)) {
        return message.reply("❌ Lien YouTube invalide.");
      }

      // Join
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
        selfDeaf: false,
      });

      const data = getOrCreateAudio(message.guild.id);
      data.connection = connection;
      connection.subscribe(data.player);

      try {
        const info = await play.video_info(url);
        const stream = await play.stream_from_info(info); // audio stream

        const resource = createAudioResource(stream.stream, { inputType: stream.type });
        data.player.play(resource);

        // Quitte à la fin
        data.player.once(AudioPlayerStatus.Idle, () => {
          const conn = getVoiceConnection(message.guild.id);
          if (conn) conn.destroy();
          guildAudio.delete(message.guild.id);
        });

        return message.reply(`▶️ Lecture : **${info.video_details.title}**`);
      } catch (err) {
        console.error(err);
        return message.reply("❌ Impossible de lire ce lien (souvent FFmpeg).");
      }
    }

    if (cmd === '!stop') {
      const data = guildAudio.get(message.guild.id);
      if (data?.player) data.player.stop(true);

      const conn = getVoiceConnection(message.guild.id);
      if (conn) conn.destroy();

      guildAudio.delete(message.guild.id);
      return message.reply("⏹️ Stop. J'ai quitté le vocal.");
    }
  } catch (err) {
    console.error(err);
    if (message.channel) message.reply("❌ Une erreur est arrivée. Regarde les logs Railway.");
  }
});

client.login(TOKEN);