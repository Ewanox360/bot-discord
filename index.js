const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// 🔐 Le token est dans Railway → Variables → TOKEN
const TOKEN = process.env.TOKEN;

client.once('ready', () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.guild) return;

    const args = message.content.trim().split(/\s+/);
    const cmd = args.shift()?.toLowerCase();

    // =========================
    // !verifmembre
    // =========================
    if (cmd === '!verifmembre') {
      const isAllowed = message.member.permissions.has(PermissionsBitField.Flags.ManageGuild);
      if (!isAllowed) return message.reply("❌ Tu n'as pas la permission d'utiliser cette commande.");

      const role = message.guild.roles.cache.find(r => r.name === 'Membre');
      if (!role) return message.reply("❌ Le rôle **Membre** n'existe pas.");

      await message.guild.members.fetch();

      const sansRole = message.guild.members.cache.filter(m =>
        !m.user.bot && !m.roles.cache.has(role.id)
      );

      if (sansRole.size === 0) {
        return message.reply("✅ Tout le monde a le rôle **Membre**.");
      }

      const liste = sansRole.map(m => `<@${m.id}>`).join('\n');
      return message.reply(`⚠️ Membres sans le rôle **Membre** (${sansRole.size}) :\n${liste}`);
    }

    // =========================
    // !donnermembre
    // =========================
    if (cmd === '!donnermembre') {
      const isAllowed = message.member.permissions.has(PermissionsBitField.Flags.ManageGuild);
      if (!isAllowed) return message.reply("❌ Tu n'as pas la permission d'utiliser cette commande.");

      const role = message.guild.roles.cache.find(r => r.name === 'Membre');
      if (!role) return message.reply("❌ Le rôle **Membre** n'existe pas.");

      const me = await message.guild.members.fetchMe();

      if (!me.permissions.has(PermissionsBitField.Flags.ManageRoles)) {
        return message.reply("❌ Je n'ai pas la permission **Gérer les rôles**.");
      }

      if (role.position >= me.roles.highest.position) {
        return message.reply("❌ Mets le rôle du bot **au-dessus** du rôle **Membre**.");
      }

      await message.guild.members.fetch();

      const sansRole = message.guild.members.cache.filter(m =>
        !m.user.bot && !m.roles.cache.has(role.id)
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
        } catch (e) {
          fail++;
        }
      }

      return message.reply(`✅ Terminé : rôle **Membre** donné à **${ok}** membres. ❌ Échecs : **${fail}**.`);
    }

    // =========================
    // !ban @membre [raison...]
    // =========================
    if (cmd === '!ban') {
      // Permission utilisateur
      if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        return message.reply("❌ Tu n'as pas la permission de bannir.");
      }

      // Permission bot
      const me = await message.guild.members.fetchMe();
      if (!me.permissions.has(PermissionsBitField.Flags.BanMembers)) {
        return message.reply("❌ Je n'ai pas la permission **Bannir des membres**.");
      }

      const target = message.mentions.members.first();
      if (!target) {
        return message.reply("❌ Utilisation : `!ban @membre raison`");
      }

      // Empêche l'auto-ban
      if (target.id === message.author.id) {
        return message.reply("❌ Tu ne peux pas te bannir toi-même.");
      }

      // Empêche de bannir le bot
      if (target.id === client.user.id) {
        return message.reply("❌ Je ne peux pas me bannir 😄");
      }

      // Respect hiérarchie (ton rôle vs cible)
      if (
        message.member.roles.highest.position <= target.roles.highest.position &&
        message.guild.ownerId !== message.author.id
      ) {
        return message.reply("❌ Tu ne peux pas bannir quelqu’un avec un rôle égal/supérieur au tien.");
      }

      // Respect hiérarchie (rôle du bot vs cible)
      if (me.roles.highest.position <= target.roles.highest.position) {
        return message.reply("❌ Je ne peux pas bannir ce membre : mets le rôle du bot plus haut.");
      }

      const reason = args.join(' ') || "Aucune raison fournie.";

      try {
        await target.ban({ reason });
        return message.channel.send(`🔨 **${target.user.tag}** a été banni.\n📝 Raison : ${reason}`);
      } catch (err) {
        console.error(err);
        return message.reply("❌ Impossible de bannir (permissions/hiérarchie/erreur Discord).");
      }
    }

  } catch (err) {
    console.error(err);
    if (message.channel) message.reply("❌ Une erreur est arrivée. Regarde les logs Railway.");
  }
});

client.login(TOKEN);