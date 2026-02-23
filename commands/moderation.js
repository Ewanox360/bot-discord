const { PermissionsBitField } = require("discord.js");

module.exports = (client, PREFIX) => {

  client.on("messageCreate", async (message) => {

    if (message.author.bot) return;
    if (!message.guild) return;
    if (!message.content.startsWith(PREFIX)) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const cmd = args.shift().toLowerCase();

    if (cmd === "ban") {
      if (!message.member.permissions.has(PermissionsBitField.Flags.BanMembers))
        return message.reply("❌ Pas la permission.");

      const target = message.mentions.members.first();
      if (!target) return message.reply("❌ Exemple: !ban @pseudo raison");

      const reason = args.join(" ") || "Aucune raison";
      await target.ban({ reason }).catch(() => null);

      return message.reply(`✅ ${target.user.tag} banni.`);
    }

  });

};