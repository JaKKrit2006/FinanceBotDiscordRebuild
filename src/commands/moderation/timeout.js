const { Client, Interaction, ApplicationCommandOptionType, PermissionFlagsBits } = require('discord.js');
const ms = require('ms');

module.exports = {

  /**
   * 
   * @param {Client} client 
   * @param {Interaction} interaction 
   */
  deleted: true,
  name: 'timeout',
  description: 'Timeout a member in the server',
  options: [
    {
      name: 'target-user',
      description: 'The user to timeout',
      type: ApplicationCommandOptionType.Mentionable,
      required: true
    },
    {
      name: 'duration',
      description: 'Duration of the timeout (e.g., 10m, 1h, 1d)',
      type: ApplicationCommandOptionType.String,
      required: true
    },
    {
      name: 'reason',
      description: 'Reason for the timeout',
      type: ApplicationCommandOptionType.String,
      // required: false
    }
  ],

  permissionsRequired: [PermissionFlagsBits.MuteMembers],
  botPermissions: [PermissionFlagsBits.MuteMembers],

  callback: async (client, interaction) => {
    const mentionable = interaction.options.get('target-user').value;
    const durationInput = interaction.options.get('duration').value; // 1m 5m 10m 1h 4h 1d
    const reason = interaction.options.get('reason')?.value || 'No reason provided';

    await interaction.deferReply();

    const targetUser = await interaction.guild.members.fetch(mentionable);
    

    if (!targetUser) {
      await interaction.editReply('User not found in this server.');
      return;
    }

    if (targetUser.user.bot) {
      await interaction.editReply('You cannot timeout a bot.');
      return;
    }

    const msDuration = ms(durationInput);
    if (isNaN(msDuration)) {
      await interaction.editReply('Invalid duration format. Please use formats like 10m, 1h, 1d.');
      return;
    }
    
    if (msDuration < 5000 || msDuration > 2419200000) { // 5 seconds to 28 days
      await interaction.editReply('Duration must be between 5 seconds and 28 days.');
      return;
    }

    const targetUserRolePosition = targetUser.roles.highest.position; // Highest role position of the target user
    const requestUserRolePosition = interaction.member.roles.highest.position; // Highest role position of the user making the request 
    const botRolePosition = interaction.guild.members.me.roles.highest.position; // Highest role position of the bot

    if (targetUserRolePosition >= requestUserRolePosition) {
      await interaction.editReply('You cannot timeout that user because their highest role is equal to or higher than yours.');
      return;
    }

    if (targetUserRolePosition >= botRolePosition) {
      await interaction.editReply('I cannot timeout that user because their highest role is equal to or higher than mine.');
      return;
    }

    // timeout the user
    try {
      const { default: prettyMs } = await import('pretty-ms');
      
      if (targetUser.isCommunicationDisabled()) {
        await targetUser.timeout(msDuration, reason);
        await interaction.editReply(`Updated timeout for ${targetUser} to ${prettyMs(msDuration, { verbose: true })}.\nReason: ${reason}`);
        return;
      }

      await targetUser.timeout(msDuration, reason);
      await interaction.editReply(`Successfully timed out ${targetUser} for ${prettyMs(msDuration, { verbose: true })}.\nReason: ${reason}`);

    } catch (error) {
      console.error('Error timing out user:', error);
    }
  },
}