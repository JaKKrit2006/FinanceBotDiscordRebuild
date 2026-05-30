const { ApplicationCommandOptionType, EmbedBuilder, Client, Interaction, Message, MessageFlags, time} = require('discord.js');
// database
const portData = require('../../models/portfolioUserData');

// colors image
const { Vibrant } = require("node-vibrant/node");
const sharp = require('sharp');

async function getColorImage(imageUrl) {
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const pngBuffer = await sharp(response.data).png().toBuffer();
    const palette = await Vibrant.from(pngBuffer).getPalette();
    const rgb = palette.LightVibrant._rgb;
    const hex = '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
    return hex || "#000000";
  } catch (err) {
    console.error(err);
    return "#000000";
  }
}

function formatToGMT7(dateStr) {
  
  if (dateStr.length === 0 && Array.isArray(dateStr)) { // if it doesn't have earning date and it has to be array
    return `No Deadline Yet.`;
  }

  const utcDate = new Date(dateStr);
  const timeStr = utcDate.toLocaleTimeString('en-US', {
    hour12: true,
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok'
  });

  const dateStrFormatted = utcDate.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Bangkok'
  }).replace(/ /g, ' '); // → "19 Nov 2025"

  return `${timeStr} | ${dateStrFormatted}`;
}

module.exports = {
  name: 'portfolio',
  description: 'Check your balance and assets',
  deleted: true,

  options: [
    {
      name: 'create',
      description: 'Create a portfoilio.',
      type: ApplicationCommandOptionType.Subcommand
    },
  ],

  callback: async (client, interaction) => {
    await interaction.deferReply();

    try {
      // user id
      const query = {
        userId: interaction.user.id,
      }
      const data = await portData.findOne(query);

      let titleText = ``;

      // Create a portfolio
      if (!data) {
        // create data for new user
        const newData = new portData({
          userName: interaction.user.username,
          userId: interaction.user.id,
          ranks: 'Newbie',
          time: new Date(),
          xp: 0,
          wealth: 1000,
          userAvatarUrl: interaction.user.displayAvatarURL() || null,
          balance: {
            money: {
            cash: 1000, // starter money
            },
            assets: { stock: [], crypto: [], gold: [] }
          }
        })

        await newData.save().catch(e => {
          console.error(e);
          await interaction.editReply(`Error Code: ${e}`);
          return;
        });

        titleText = `Portfolio Created`;
      } else {
        titleText = `You already have a portfolio`;
      }

      const upData = await portData.findOne(query);

      const userEmbed = new EmbedBuilder()
        .setTitle(titleText)
        .setColor(await getColorImage(interaction.user.displayAvatarURL()))
        .setThumbnail(interaction.user.displayAvatarURL() || null)
        .setFooter({
          text: `🗓️ ${new Date().toLocaleString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric'
            })}, ${new Date().toLocaleString('en-US',
            { hour12: true , timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }
          )} (GMT+7)`
        })
        .setDescription(`Created At ${formatToGMT7(upData.time)} (GMT+7)`);

      // reply
      await interaction.editReply({ embeds: [userEmbed] });

      await data.save().catch(e => {
        console.error(e);
        await interaction.editReply(`Error Code: ${e}`);
        return;
      });
    }

    catch (error) {
      console.log(error);
      await interaction.editReply(`Error Code: ${error}`);
      return;
    }
  }
}