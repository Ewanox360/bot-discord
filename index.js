const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const {
  joinVoiceChannel,
  getVoiceConnection,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  NoSubscriberBehavior
} = require('@discordjs/voice');
const play = require('play-dl');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const TOKEN = process.env.TOKEN;

const audioMap = new Map(); // 1 player par serveur

function getOrCreateAudio(guildId) {
  let data = audioMap.get(guildId);

  if (!data) {
    const player = createAudioPlayer({
      behaviors: { noSubscriber: NoSubscriberBehavior.Pause }
    });

    data = { player };
    audioMap.set(guildId, data);
  }

  return data;
}

client.once('ready', () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const args = message.content.trim().split(/\s+/);
  const cmd = args.shift()?.toLowerCase();

  // ======================
  // !join
  // ======================
  if (cmd === "!join") {

    const member = await message.guild.members.fetch(message.author.id);
    const voiceChannel = member.voice?.channel;
    if (!voiceChannel) return message.reply("❌ Va dans un salon vocal.");

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
  if (cmd === "!leave") {
    const connection = getVoiceConnection(message.guild.id);
    if (!connection) return message.reply("❌ Je ne suis pas en vocal.");

    connection.destroy();
    audioMap.delete(message.guild.id);

    return message.reply("👋 J'ai quitté le vocal.");
  }

  // ======================
  // !play <lien>
  // ======================
  if (cmd === "!play") {

    const url = args[0];
    if (!url) return message.reply("❌ Utilisation : !play <lien>");

    const member = await message.guild.members.fetch(message.author.id);
    const voiceChannel = member.voice?.channel;
    if (!voiceChannel) return message.reply("❌ Va dans un salon vocal.");

    const botMember = await message.guild.members.fetchMe();
    const perms = voiceChannel.permissionsFor(botMember);

    if (!perms?.has(PermissionsBitField.Flags.Connect))
      return message.reply("❌ Je ne peux pas me connecter.");

    if (!perms?.has(PermissionsBitField.Flags.Speak))
      return message.reply("❌ Je ne peux pas parler.");

    if (!play.yt_validate(url))
      return message.reply("❌ Lien YouTube invalide.");

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
      selfDeaf: false
    });

    const data = getOrCreateAudio(message.guild.id);
    connection.subscribe(data.player);

    try {
      const info = await play.video_info(url);
      const stream = await play.stream_from_info(info);

      const resource = createAudioResource(stream.stream, {
        inputType: stream.type
      });

      data.player.play(resource);

      message.reply(`▶️ Lecture : **${info.video_details.title}**`);

      data.player.once(AudioPlayerStatus.Idle, () => {
        console.log("🎵 Lecture terminée");
      });

    } catch (err) {
      console.error(err);
      message.reply("❌ Erreur lecture (ffmpeg installé ?)");
    }
  }

  // ======================
  // !pause
  // ======================
  if (cmd === "!pause") {
    const data = audioMap.get(message.guild.id);
    if (!data) return message.reply("❌ Rien à mettre en pause.");

    data.player.pause();
    return message.reply("⏸️ Pause.");
  }

  // ======================
  // !resume / !résumé
  // ======================
  if (cmd === "!resume" || cmd === "!résumé") {
    const data = audioMap.get(message.guild.id);
    if (!data) return message.reply("❌ Rien à reprendre.");

    data.player.unpause();
    return message.reply("▶️ Reprise.");
  }

  // ======================
  // !stop (stop musique seulement)
  // ======================
  if (cmd === "!stop") {
    const data = audioMap.get(message.guild.id);
    if (!data) return message.reply("❌ Rien en cours.");

    data.player.stop(true);
    return message.reply("⏹️ Musique arrêtée.");
  }

});

client.login(TOKEN);