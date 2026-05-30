const { ApplicationCommandOptionType, EmbedBuilder, Client, Interaction, Message, MessageFlags, time} = require('discord.js');
const portData = require('../../models/portfolioUserData');

// yahoo
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// crypto
const fs = require('fs');
const path = require('path');
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";

// gold spot
const axios = require('axios');
const goldUrl = 'https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD';

// colors image
const { Vibrant } = require("node-vibrant/node");
const sharp = require('sharp');

async function getColorImage(imageUrl) {
  try {
    // load image to buffer
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });

    // convert PNG buffer before feed to Vibrant
    const pngBuffer = await sharp(response.data).png().toBuffer();
    const palette = await Vibrant.from(pngBuffer).getPalette();

    // debug
    //console.log(palette);

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
  // const gmt7Date = new Date(utcDate.getTime() + 7 * 60 * 60 * 1000);

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


async function getAllSymbol(database, typeAsset) {
  const data = await database;
  let result = [];

  data.balance.assets[typeAsset].forEach(item => {
    const symbol = item.symbol;
    
    result.push(symbol);
  })

  return result;
}


function combineValueArray(array) {
  let result = [];

  array.forEach(item => {
    let existing = result.find(x => x.symbol === item.symbol);
    if (existing) {
      existing.cost += item.cost;
      existing.volume += item.volume;
    } else {
      result.push({ ...item });
    }
  });

  return result;
}


module.exports = {
  name: 'portfolio',
  description: 'Check your balance and assets',
  deleted: false,
  devOnly: true,

  options: [
    {
      name: 'create',
      description: 'Create a portfoilio.',
      type: ApplicationCommandOptionType.Subcommand
    },
    {
      name: 'reset',
      description: '!Reset your data in portfolio. (Warning!)',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'accept',
          description: 'Are you sure?',
          type: ApplicationCommandOptionType.Boolean,
          required: true,
        },
      ],
    },
    {
      name: 'check',
      description: 'Check your portfoilio. (Must be created)',
      type: ApplicationCommandOptionType.Subcommand
    },
    {
      name: 'delete',
      description: '!Delete your portfoilio. (Warning!)',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'accept',
          description: 'Are you sure?',
          type: ApplicationCommandOptionType.Boolean,
          required: true,
        },
      ]
    }
  ],

  callback: async (client, interaction) => {
    await interaction.deferReply(/*{ flags: hide }*/);

    try {
      // user input
      const sub = interaction.options.getSubcommand();
      const accept = interaction.options.getBoolean('accept') || false;
      
      const basePayload = {
        ranks: 'Newbie',
        time: new Date(),
        xp: 0,
        wealth: 1000,
        balance: {
          money: {
            cash: 1000, // starter money
          },
          assets: { stock: [], crypto: [], gold: [] }
        }
      };

      // user id
      const query = {
        userId: interaction.user.id,
      }

      const data = await portData.findOne(query);

      // Create a portfolio
      if (sub === 'create') {
        // if user already have data in data base
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
            console.log(`Error Code: ${e}`);
            return;
          });

          await interaction.editReply(`<@${interaction.user.id}> Create a Portfolio successfully.`);
          return;
        }

        await interaction.editReply(`<@${interaction.user.id}> You Already create a portfolio.`);

        await data.save().catch(e => {
          console.log(`Error Code: ${e}`);
          return;
        });
      }

      // check status
      else if (sub === 'check') {
        if (!data) {
          await interaction.editReply(`<@${interaction.user.id}> Sorry, you need to create your portfolio first.`);
          return;
        }
        await interaction.editReply(`test`);
      }

      // reset portfolio's data
      else if (sub === 'reset' && accept) {
        if (!data) {
          await interaction.editReply(`<@${interaction.user.id}> Sorry, you need to create your portfolio first.`);
          return;
        }
        // reset data
        await portData.updateOne(query, { $set: basePayload });
        await interaction.editReply(`<@${interaction.user.id}> Reset your data Portfolio successfully.`);
      }

      // delete portfolio's data
      else if (sub === 'delete' && accept) {
        if (!data) {
          await interaction.editReply(`<@${interaction.user.id}> Sorry, you need to create your portfolio first.`);
          return;
        } 

        // delete data
        const result = await portData.deleteOne(query);
        if (result.deletedCount === 1) {
          await interaction.editReply(`<@${interaction.user.id}> Delete your data successfully.`);
        } else {
          await interaction.editReply(`<@${interaction.user.id}> Nothing to delete (not found).`);
        }
      }

      // if user doesn't confirm their action
      else {
        await interaction.editReply(`<@${interaction.user.id}> Please confirm your action by selecting "Yes" or "No".`);
      }
    }
    catch (error) {
      console.log(error);
      interaction.editReply(`Error Code: ${error}`);
      return;
    }
  }
}
