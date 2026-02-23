const { PermissionsBitField } = require("discord.js");

module.exports = (client) => {

  const linkRegex = /https?:\/\/[^\s]+/i;

  client.on("messageCreate", async (message) => {

    if (message.author.bot) return;

    // Ignorer les messages privés (DMs)
    if (!message.guild) return;

    // Optionnel : ignorer les admins
    if (message.member && message.member.permissions && message.member.permissions.has(PermissionsBitField.Flags.Administrator)) return;

    if (linkRegex.test(message.content)) {

      if (message.deletable) {
        await message.delete().catch(() => {});
      }

      const warning = await message.channel.send(
        `🚫 ${message.author}, les liens sont interdits.`
      ).catch(() => {});

      if (warning) {
        setTimeout(() => {
          warning.delete().catch(() => {});
        }, 4000);
      }

    }

  });

};