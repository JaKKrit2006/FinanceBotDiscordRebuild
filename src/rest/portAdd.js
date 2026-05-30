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


async function addAssetData(interaction, query, sub, symbol, cost=0, volume=0) {
  try {
    let data = await portData.findOne(query);
    // const money = data.balance.money.cash;

    if (!symbol && sub !== 'gold') {
      await interaction.editReply(`Sorry, your symbol could not find.`);
      return;
    }

    if (!symbol && sub === 'gold') {
      symbol = 'gold';
    }

    // assets data
    const assetData = {
      symbol: `${symbol}`,
      cost: cost,
      volume: volume
    }

    if (cost < 1) {
      await interaction.editReply(`Sorry, you can't set cost below 1`);
      return;
    }
    else if (volume <= 0) {
      await interaction.editReply(`Sorry, you can't set volume to 0 or below`);
      return;
    }


    if (sub === 'stock') {
      const stock = await yahooFinance.quote(symbol);

      if (!stock) {
        // can't find data
        await interaction.editReply(`Sorry, your ticker could not find.`);
        return;
      }

      await portData.updateOne(query, {$push : {
        'balance.assets.stock': assetData
      }})
    }

    if (sub === 'crypto') {
      const allCoinPath = path.join(__dirname, '..', '..', '..', 'allcoin.json');
      if (!fs.existsSync(allCoinPath)) {
        await interaction.editReply(`❌ ไม่พบไฟล์ allcoin.json ในระบบ กรุณาตรวจสอบพาร์ทไฟล์`);
        return;
      }

      const allCoin = JSON.parse(fs.readFileSync(allCoinPath, 'utf-8'));
      const coinMatch = allCoin.find(c =>
        c.symbol.toUpperCase() === symbol.toUpperCase() ||
        c.id.toUpperCase() === symbol.toUpperCase() ||
        c.name.toUpperCase() === symbol.toUpperCase()
      );

      if (!coinMatch) {
        await interaction.editReply(`Sorry, your coin name could not find.`);
        return;
      }

      await portData.updateOne(query, {$push : {
        'balance.assets.crypto': assetData
      }})
    }

    if (sub === 'gold') {
      await portData.updateOne(query, {$push : {
        'balance.assets.gold': assetData
      }})
    }

    // spend moeny
    // const moneyLeft = money - cost;
    // await portData.updateOne(query, { $set: {'balance.money.cash': moneyLeft} })

    // update data
    data = await portData.findOne(query);

    await interaction.editReply(`[${sub.toUpperCase()}] Add ${symbol} total cost: ${cost} volume: ${volume}`)
  }

  catch (error) {
    await interaction.editReply(`Error Code: ${error}`);
    console.log(error);
    return;
  }
}


module.exports = {
  name: 'portfolio',
  description: 'Add assets to your portfolio',
  devOnly: true,

  options: [
    {
      name: 'add',
      description: 'Add assets to your portfoilio. (Cash)',
      type: ApplicationCommandOptionType.SubcommandGroup,
      options: [
        {
          name: 'stock',
          description: 'Add stock',
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: 'symbol',
              description: 'ticker of stock',
              type: ApplicationCommandOptionType.String,
              require: true
            },
            {
              name: 'cost',
              description: 'total money you spend',
              type: ApplicationCommandOptionType.Number,
              require: true
            },
            {
              name: 'volume',
              description: 'total volume from buying',
              type: ApplicationCommandOptionType.Number,
              require: true
            }
          ]
        },
        {
          name: 'crypto',
          description: 'Add crypto',
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: 'name',
              description: 'name of coin',
              type: ApplicationCommandOptionType.String,
              require: true
            },
            {
              name: 'cost',
              description: 'total money you spend',
              type: ApplicationCommandOptionType.Number,
              require: true
            },
            {
              name: 'volume',
              description: 'total volume from buying',
              type: ApplicationCommandOptionType.Number,
              require: true
            }
          ]
        },
        {
          name: 'gold',
          description: 'Add gold',
          type: ApplicationCommandOptionType.Subcommand,
          options: [
            {
              name: 'cost',
              description: 'total money you spend',
              type: ApplicationCommandOptionType.Number,
              require: true
            },
            {
              name: 'volume',
              description: 'total volume from buying',
              type: ApplicationCommandOptionType.Number,
              require: true
            }
          ]
        }
      ]
    }

  ],

  callback: async (client, interaction) => {
    await interaction.deferReply({ /*flags: MessageFlags.Ephemeral*/ });

    try {
      // user input
      const group = interaction.options.getSubcommandGroup(); // add
      const cost = interaction.options.getNumber('cost');
      const volume = interaction.options.getNumber('volume');
      const symbol = interaction.options.getString('symbol');  // stock
      const name = interaction.options.getString('name'); // crypto
      // user id
      const query = {
        userId: interaction.user.id,
      }

      const data = await portData.findOne(query);

      if (group === 'add') {
        if (!data) {
          await interaction.editReply(`<@${interaction.user.id}> Sorry, you need to create your portfolio first.`);
          return;
        }
        
        addAssetData(interaction, query, sub, (symbol || name), cost, volume);
        return;
      }


      // reset portfolio's data
      if (sub === 'reset' && accept) {
        if (!data) {
          await interaction.editReply(`<@${interaction.user.id}> Sorry, you need to create your portfolio first.`);
          return;
        }

        // reset data
        await portData.updateOne(query, { $set: basePayload });
        await interaction.editReply(`<@${interaction.user.id}> Reset your data Portfolio successfully.`);

        return;
      }
    }

    catch (error) {
      console.log(error);
      interaction.editReply(`Error Code: ${error}`);
      
      return;
    }
  }
}