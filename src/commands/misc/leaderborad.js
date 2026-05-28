// database
const portData = require('../../models/portfolioUserData');

module.exports = {
  name: 'leaderboard',
  description: '(Dev only) view leaderboard',
  // devOnly: true,
  // testOnly: true,
  // options: Object[],
  // deleted: Boolean,

  callback: async (client, interaction) => {
    await interaction.deferReply();

    const data = await portData.find({}); // find all data in database
    // console.log(data);
    const wealthList = [];

    for (const userData of data) {
        const payload = {
          userName: userData.userName,
          userId: userData.userId,
          userAvatarUrl: userData.userAvatarUrl,
          wealth: userData.wealth
        }
        const userWealth = userData.wealth;
        wealthList.push(payload);
    }

    const sortedWealthList = wealthList.sort((a, b) => b.wealth - a.wealth); // sort by wealth in descending order
    //console.log(sortedWealthList);

    let leaderboardMessage = '```Leaderboard:\n\n';

    for (const [index, user] of sortedWealthList.entries()) {
        if (index >= 10) break; // show top 10 users
        leaderboardMessage += `${index + 1}. ${user.userName} - Wealth: $${user.wealth.toFixed(2)}\n`;
    }
    leaderboardMessage += '```';
    currentUserRank = sortedWealthList.findIndex(user => user.userId === interaction.user.id) + 1;

    await interaction.editReply(`${leaderboardMessage}\n Your current rank: ${currentUserRank}`);
  },
};
