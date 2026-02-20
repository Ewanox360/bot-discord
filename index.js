const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const {
  joinVoiceChannel,
  getVoiceConnection,
  createAudioPlayer,
  createAudioResource,
  NoSubscriberBehavior,
} = require('@discordjs/voice');

const play = require('play-dl');
const ffmpegPath = require('ffmpeg-static');

// ✅ Force play-dl à utiliser ffmpeg-static (Railway)
try {
  if (ffmpegPath) {
    process.env.FFMPEG_PATH = ffmpegPath;
    if (typeof play.setFFmpegPath === 'function') play.setFFmpegPath(ffmpegPath);
  }
} catch (e) {
  console.log("⚠️ Impossible de définir ffmpegPath:", e);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

const TOKEN = process.env.TOKEN;

// 1 player par serveur
const audioMap = new Map(); // guildId -> { player }

function getOrCreatePlayer(guildId) {
  let data = audioMap.get(guildId);
  if (!data) {
    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause },
    });
    data = { player };
    audioMap.set(guildId, data);
  }
  return data.player;
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
    // !join
    // ======================
    if (cmd === '!join') {
      const member = await message.guild.members.fetch(message.author.id);
      const voiceChannel = member.voice?.channel;

      if (!voiceChannel) return message.reply('❌ Va dans un salon vocal.');

      const botMember = await message.guild.members.fetchMe();
      const perms = voiceChannel.permissionsFor(botMember);
      if (!perms?.has(PermissionsBitField.Flags.Connect)) {
        return message.reply("❌ Je n'ai pas la permission **Se connecter**.");
      }

      joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
        selfDeaf: true,
      });

      return message.reply(`✅ Je rejoins **${voiceChannel.name}**`);
    }

    // ======================
    // !leave
    // ======================
    if (cmd === '!leave') {
      const conn = getVoiceConnection(message.guild.id);
      if (!conn) return message.reply("❌ Je ne suis pas en vocal.");

      conn.destroy();
      audioMap.delete(message.guild.id);

      return message.reply("👋 J'ai quitté le vocal.");
    }

    // ======================
    // !play <lien youtube>
    // ======================
    if (cmd === '!play') {
      const url = args[0];
      if (!url) return message.reply("❌ Utilisation : `!play <lien YouTube>`");

      const member = await message.guild.members.fetch(message.author.id);
      const voiceChannel = member.voice?.channel;
      if (!voiceChannel) return message.reply("❌ Va dans un salon vocal puis refais `!play`.");

      const botMember = await message.guild.members.fetchMe();
      const perms = voiceChannel.permissionsFor(botMember);

      if (!perms?.has(PermissionsBitField.Flags.Connect))
        return message.reply("❌ Je ne peux pas me connecter.");
      if (!perms?.has(PermissionsBitField.Flags.Speak))
        return message.reply("❌ Je ne peux pas parler.");

      if (!play.yt_validate(url)) return message.reply("❌ Lien YouTube invalide.");

      // rejoint (ou reconnecte)
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: message.guild.id,
        adapterCreator: message.guild.voiceAdapterCreator,
        selfDeaf: false,
      });

      const player = getOrCreatePlayer(message.guild.id);
      connection.subscribe(player);

      try {
        const info = await play.video_info(url);
        const stream = await play.stream_from_info(info); // play-dl gère ffmpeg

        const resource = createAudioResource(stream.stream, { inputType: stream.type });
        player.play(resource);

        return message.reply(`▶️ Lecture : **${info.video_details.title}**`);
      } catch (err) {
        console.error(err);
        return message.reply("❌ Erreur lecture (ffmpeg/YouTube). Regarde les logs Railway.");
      }
    }

    // ======================
    // !pause
    // ======================
    if (cmd === '!pause') {
      const data = audioMap.get(message.guild.id);
      if (!data) return message.reply("❌ Rien à mettre en pause.");
      data.player.pause();
      return message.reply("⏸️ Pause.");
    }

    // ======================
    // !resume / !résumé
    // ======================
    if (cmd === '!resume' || cmd === '!résumé') {
      const data = audioMap.get(message.guild.id);
      if (!data) return message.reply("❌ Rien à reprendre.");
      data.player.unpause();
      return message.reply("▶️ Reprise.");
    }

    // ======================
    // !stop (stop musique, reste en vocal)
    // ======================
    if (cmd === '!stop') {
      const data = audioMap.get(message.guild.id);
      if (!data) return message.reply("❌ Rien en cours.");
      data.player.stop(true);
      return message.reply("⏹️ Musique arrêtée.");
    }
  } catch (err) {
    console.error(err);
    if (message?.channel) message.reply("❌ Erreur. Regarde les logs Railway.");
  }
});

client.login(TOKEN);