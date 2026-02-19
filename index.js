const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// 🔐 TOKEN sécurisé (à mettre dans Railway, PAS ici)
const TOKEN = process.env.TOKEN;

client.once('ready', () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const isAdmin = message.member.permissions.has(
    PermissionsBitField.Flags.ManageGuild
  );

  // -------- !verifmembre --------
  if (message.content === "!verifmembre") {
    if (!isAdmin) return message.reply("❌ Permission refusée.");

    const role = message.guild.roles.cache.find(r => r.name === "Membre");
    if (!role) return message.reply("❌ Le rôle 'Membre' n'existe pas.");

    await message.guild.members.fetch();

    const sansRole = message.guild.members.cache.filter(m =>
      !m.user.bot && !m.roles.cache.has(role.id)
    );

    if (sansRole.size === 0) {
      return message.reply("✅ Tout le monde a le rôle Membre.");
    }

    const liste = sansRole.map(m => `<@${m.id}>`).join("\n");
    return message.reply(`⚠️ Membres sans rôle (${sansRole.size}) :\n${liste}`);
  }

  // -------- !donnermembre --------
  if (message.content === "!donnermembre") {
    if (!isAdmin) return message.reply("❌ Permission refusée.");

    const role = message.guild.roles.cache.find(r => r.name === "Membre");
    if (!role) return message.reply("❌ Le rôle 'Membre' n'existe pas.");

    const me = await message.guild.members.fetchMe();

    if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
      return message.reply("❌ Je n'ai pas la permission Gérer les rôles.");
    }

    if (role.position >= me.roles.highest.position) {
      return message.reply("❌ Mets mon rôle au-dessus du rôle Membre.");
    }

    await message.guild.members.fetch();

    const sansRole = message.guild.members.cache.filter(m =>
      !m.user.bot && !m.roles.cache.has(role.id)
    );

    if (sansRole.size === 0) {
      return message.reply("✅ Tout le monde a déjà le rôle.");
    }

    let count = 0;

    for (const member of sansRole.values()) {
      try {
        await member.roles.add(role);
        count++;
      } catch {}
    }

    return message.reply(`✅ Rôle donné à ${count} membres.`);
  }
});

client.login(TOKEN);
