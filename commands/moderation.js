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

    if (cmd === "mute") {
      if (!message.member.permissions.has(PermissionsBitField.Flags.ModerateMembers))
        return message.reply("❌ Pas la permission.");

      const target = message.mentions.members.first();
      if (!target) return message.reply("❌ Exemple: !mute @pseudo 10m raison");

      if (!message.guild.members.me.permissions.has(PermissionsBitField.Flags.ModerateMembers))
        return message.reply("❌ Le bot n'a pas la permission 'Moderate Members'.");

      // Empêcher de mute une personne de rang supérieur ou égal
      if (
        message.member.roles.highest.position <= target.roles.highest.position &&
        message.guild.ownerId !== message.member.id
      )
        return message.reply("❌ Tu ne peux pas mute cette personne (hiérarchie).");

      // args: [duration, ...reason]
      const durStr = args.shift();

      function parseDuration(str) {
        if (!str) return null;
        const m = str.match(/^(\d+)(s|m|h|d)?$/i);
        if (!m) return null;
        const n = parseInt(m[1], 10);
        const unit = (m[2] || "m").toLowerCase();
        switch (unit) {
          case "s":
            return n * 1000;
          case "m":
            return n * 60 * 1000;
          case "h":
            return n * 60 * 60 * 1000;
          case "d":
            return n * 24 * 60 * 60 * 1000;
          default:
            return null;
        }
      }

      const durationMs = parseDuration(durStr);
      if (!durationMs)
        return message.reply("❌ Durée invalide. Exemple: 10m, 1h, 30s, 2d");

      const reason = args.join(" ") || "Aucune raison";

      await target.timeout(durationMs, reason).catch((err) => {
        console.error(err);
        return null;
      });

      return message.reply(`✅ ${target.user.tag} a été mute pour ${durStr} (${reason}).`);
    }

  });

};