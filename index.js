const { 
  Client, 
  GatewayIntentBits, 
  PermissionsBitField 
} = require('discord.js');

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

const players = new Map();

function getPlayer(guildId) {
  if (!players.has(guildId)) {
    const player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause
      }
    });
    players.set(guildId, player);
  }
  return players.get(guildId);
}

client.once('ready', () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const args = message.content.trim().split(/\s+/);
  const cmd = args.shift()?.toLowerCase();

  // =========================
  // JOIN
  // =========================
  if (cmd === "!join") {
    const member = await message.guild.members.fetch(message.author.id);
    const channel = member.voice.channel;

    if (!channel) return message.reply("❌ Va dans un salon vocal.");

    const botMember = await message.guild.members.fetchMe();
    const perms = channel.permissionsFor(botMember);

    if (!perms.has(PermissionsBitField.Flags.Connect))
      return message.reply("❌ Je ne peux pas me connecter.");
    if (!perms.has(PermissionsBitField.Flags.Speak))
      return message.reply("❌ Je ne peux pas parler.");

    joinVoiceChannel({
      channelId: channel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
      selfDeaf: true
    });

    return message.reply(`✅ Je rejoins ${channel.name}`);
  }

  // =========================
  // LEAVE
  // =========================
  if (cmd === "!leave") {
    const connection = getVoiceConnection(message.guild.id);
    if (!connection) return message.reply("❌ Je ne suis pas en vocal.");

    connection.destroy();
    players.delete(message.guild.id);

    return message.reply("👋 Je quitte le vocal.");
  }

  // =========================
  // PLAY
  // =========================
  if (cmd === "!play") {
    const url = args[0];
    if (!url) return message.reply("❌ Utilisation : !play <lien YouTube>");

    const member = await message.guild.members.fetch(message.author.id);
    const channel = member.voice.channel;

    if (!channel) return message.reply("❌ Va dans un salon vocal.");

    if (!play.yt_validate(url))
      return message.reply("❌ Lien YouTube invalide.");

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
      selfDeaf: false
    });

    const player = getPlayer(message.guild.id);
    connection.subscribe(player);

    try {
      const stream = await play.stream(url, {
        discordPlayerCompatibility: true
      });

      const resource = createAudioResource(stream.stream, {
        inputType: stream.type
      });

      player.play(resource);

      return message.reply("▶️ Lecture en cours !");
    } catch (err) {
      console.error(err);
      return message.reply("❌ Erreur lecture.");
    }
  }

  // =========================
  // PAUSE
  // =========================
  if (cmd === "!pause") {
    const player = players.get(message.guild.id);
    if (!player) return message.reply("❌ Rien en cours.");

    player.pause();
    return message.reply("⏸️ Pause.");
  }

  // =========================
  // RESUME
  // =========================
  if (cmd === "!resume" || cmd === "!résumé") {
    const player = players.get(message.guild.id);
    if (!player) return message.reply("❌ Rien à reprendre.");

    player.unpause();
    return message.reply("▶️ Reprise.");
  }

  // =========================
  // STOP
  // =========================
  if (cmd === "!stop") {
    const player = players.get(message.guild.id);
    if (!player) return message.reply("❌ Rien à arrêter.");

    player.stop();
    return message.reply("⏹️ Musique arrêtée.");
  }
});

client.login(TOKEN);