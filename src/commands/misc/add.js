const { ApplicationCommandOptionType } = require('discord.js');

// database
const portData = require('../../models/portfolioUserData');

module.exports = {
  name: 'add',
  description: '(Dev only) add money',
  devOnly: true,
  // testOnly: true,
  options: [
    {
      name: 'account',
      description: 'select an account you want to give money',
      type: ApplicationCommandOptionType.User,
      require: true
    },
    {
      name: 'amount',
      description: 'amount you want to give money',
      type: ApplicationCommandOptionType.Number,
      require: true
    }
  ],
  // deleted: Boolean,

  callback: async (client, interaction) => {
    await interaction.deferReply();

    try {
      const userData = interaction.options.getUser('account');
      const amount = interaction.options.getNumber('amount');

      if (userData.bot) {
        return await interaction.editReply(`<@${interaction.user.id}> Sorry, that is a bot.`);
      }

      // user id
      const query = { userId: userData.id }
      const data = await portData.findOne(query);

      // if no data
      if (!data) {
        return await interaction.editReply(`<@${interaction.user.id}> Sorry, that user need to create portfolio first.`);
      }

      const money = data.balance.money.cash;
      const total = money + amount;
      await portData.updateOne(query, {$set : {
        'balance.money.cash': total
      }})

      await interaction.editReply(`<@${interaction.user.id}> give money amount __**${amount}**__ to <@${userData.id}>`);
    }
    catch (error) {
      console.log(error);
      return await interaction.editReply(`Error Code: ${error}`);
    }
  }
};
