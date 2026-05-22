const {
  Client,
  Interaction,
  ApplicationCommandOptionType,
  PermissionFlagsBits
} = require('discord.js');

module.exports = {
  /**
   * 
   * @param {Client} client 
   * @param {Interaction} interaction 
   */


  callback: async (client, interaction) => {
    const targetUserId = interaction.options.get('target-user').value;
    const reason = interaction.options.get('reason')?.value || 'No reason provided';

    await interaction.deferReply();

    const targetUser = await interaction.guild.members.fetch(targetUserId);

    if (!targetUser) {
      await interaction.editReply('User not found in this server.');
      return;
    }

    if (targetUser.id === interaction.user.id) {
      await interaction.editReply('You cannot ban yourself.');
      return;
    }

    const targetUserRolePosition = targetUser.roles.highest.position; // Highest role position of the target user
    const requestUserRolePosition = interaction.member.roles.highest.position; // Highest role position of the user making the request 
    const botRolePosition = interaction.guild.members.me.roles.highest.position; // Highest role position of the bot

    if (targetUserRolePosition >= requestUserRolePosition) {
      await interaction.editReply('You cannot ban that user because their highest role is equal to or higher than yours.');
      return;
    }

    if (targetUserRolePosition >= botRolePosition) {
      await interaction.editReply('I cannot ban that user because their highest role is equal to or higher than mine.');
      return;
    }

    // ban the user
    try {
      await targetUser.ban({ reason });
      await interaction.editReply(`Successfully banned ${targetUser}.\nReason: ${reason}`);
    } catch (error) {
      console.error('Error banning user:', error);
    }
  },


  deleted: true,
  name: 'ban',
  description: 'Bans a member!!!',
  // devOnly: Boolean,
  // testOnly: Boolean,
  options: [
    {
      name: 'target-user',
      description: 'The user to ban.',
      required: true,
      type: ApplicationCommandOptionType.Mentionable,
    },
    {
      name: 'reason',
      description: 'The reason for banning.',
      type: ApplicationCommandOptionType.String,
    },
  ],
  permissionsRequired: [PermissionFlagsBits.Administrator],
  botPermissions: [PermissionFlagsBits.Administrator],

  
};
