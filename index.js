const { Client, GatewayIntentBits } = require("discord.js");
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  getVoiceConnection,
  AudioPlayerStatus
} = require("@discordjs/voice");
const { spawn } = require("child_process");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const players = new Map();

client.once("ready", () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

client.on("messageCreate", async (message) => {
  if (!message.guild || message.author.bot) return;

  const args = message.content.trim().split(/\s+/);
  const cmd = args.shift()?.toLowerCase();

  // =========================
  // JOIN
  // =========================
  if (cmd === "!join") {
    const channel = message.member.voice.channel;
    if (!channel) return message.reply("❌ Va en vocal.");

    joinVoiceChannel({
      channelId: channel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator
    });

    return message.reply("✅ Je rejoins le vocal.");
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
    if (!url) return message.reply("❌ Mets un lien YouTube.");

    const channel = message.member.voice.channel;
    if (!channel) return message.reply("❌ Va en vocal.");

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator
    });

    const player = createAudioPlayer();
    connection.subscribe(player);

    try {
      const yt = spawn("yt-dlp", [
        "-f",
        "bestaudio",
        "-o",
        "-",
        url
      ]);

      const ffmpeg = spawn("ffmpeg", [
        "-i",
        "pipe:0",
        "-f",
        "s16le",
        "-ar",
        "48000",
        "-ac",
        "2",
        "pipe:1"
      ]);

      yt.stdout.pipe(ffmpeg.stdin);

      const resource = createAudioResource(ffmpeg.stdout);
      player.play(resource);

      players.set(message.guild.id, player);

      player.on(AudioPlayerStatus.Playing, () => {
        console.log("▶️ Lecture en cours");
      });

      player.on("error", (error) => {
        console.error("Erreur player :", error);
      });

      return message.reply("▶️ Lecture lancée !");
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
  if (cmd === "!resume") {
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

client.login(process.env.TOKEN);