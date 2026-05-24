const { 
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ComponentType, EmbedBuilder, ApplicationCommandOptionType, MessageFlags
} = require('discord.js');

const axios = require('axios');

// database
const portData = require('../../models/portfolioUserData');

// yahoo
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// finnhub
const util = require('util');
const finnhub = require('finnhub');
const finnhubClient = new finnhub.DefaultApi(process.env.FINNHUB_API) // Replace this

// Promisify Finnhub methods
const promisifiedCompanyProfile = util.promisify(finnhubClient.companyProfile2).bind(finnhubClient);

// Coingecko Web API
const fs = require('fs');
const path = require('path');
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY; // Replace this with your actual API key
const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";

module.exports = {
  name: 'buy',
  description: 'Buy assets (stock, crypto, gold) with market price.',
  // devOnly: Boolean,
  // testOnly: true,
  // deleted: Boolean,

  options: [
    {
      name: 'stock',
      description: 'buy stock',
      type: ApplicationCommandOptionType.Subcommand,

      options: [
        {
          name: 'symbol',
          description: 'ticker of stock',
          type: ApplicationCommandOptionType.String,
          require: true
        },
        {
          name: 'mode',
          description: 'select buy by (volume, cost)',
          type: ApplicationCommandOptionType.String,
          require: true,
          choices: [
            { name: 'cost', value: 'cost'},
            { name: 'volume', value: 'volume'}
          ]
        },
        {
          name: 'amount',
          description: 'buy amount',
          type: ApplicationCommandOptionType.Number,
          require: true
        },
      ]
    },
    {
      name: 'crypto',
      description: 'buy crypto',
      type: ApplicationCommandOptionType.Subcommand,

      options: [
        {
          name: 'name',
          description: 'coin name',
          type: ApplicationCommandOptionType.String,
          require: true
        },
        {
          name: 'mode',
          description: 'select buy by (volume, cost)',
          type: ApplicationCommandOptionType.String,
          require: true,
          choices: [
            { name: 'cost', value: 'cost'},
            { name: 'volume', value: 'volume'}
          ]
        },
        {
          name: 'amount',
          description: 'buy amount',
          type: ApplicationCommandOptionType.Number,
          require: true
        },
      ]
    },
    {
      name: 'gold',
      description: 'buy gold',
      type: ApplicationCommandOptionType.Subcommand,

      options: [
        {
          name: 'mode',
          description: 'select buy by (volume, cost)',
          type: ApplicationCommandOptionType.String,
          require: true,
          choices: [
            { name: 'cost', value: 'cost'},
            { name: 'volume', value: 'volume'}
          ]
        },
        {
          name: 'amount',
          description: 'buy amount',
          type: ApplicationCommandOptionType.Number,
          require: true
        },
      ]
    }
  ],

  callback: async(client, interaction) => {
    await interaction.deferReply(/*{ flags: MessageFlags.Ephemeral }*/);

    try {
      const sub = interaction.options.getSubcommand();
      const name = interaction.options.getString('name') // crypto only
      const symbol = interaction.options.getString('symbol'); // stock only
      const mode = interaction.options.getString('mode'); // 'volume' or 'cost'
      const amount = interaction.options.getNumber('amount'); // interpret by mode

      // if no input data
      if (sub !== 'gold' && !(name || symbol)) {
        await interaction.editReply(`<@${interaction.user.id}> Sorry, You didn't enter any input data`);
        return;
      }

      let volume = 0;
      let marketprice = 120 || 1;
      let totalCost = 0;
      let selectAsset = '';
      let imageUrl = '';

      // user id
      const query = { userId: interaction.user.id }
      const data = await portData.findOne(query);

      // if no data
      if (!data) {
        await interaction.editReply(`<@${interaction.user.id}> Sorry, You need to create portfolio first.`);
        return;
      }

      const userMoney = data.balance.money.cash;
      // debug
      // console.log(amount);
      

      // check user input
      if (sub === 'stock') {
        const stockArr = data.balance.assets.stock;
        const count = stockArr.length;

        selectAsset = symbol.toUpperCase();

        const hasSameStock = stockArr.find(i => i.symbol.toUpperCase() === selectAsset);
        if (count >= 10 && !hasSameStock) {
          return await interaction.editReply(`<@${interaction.user.id}> Sorry, the number of assets is limited to 10.`);
        }

        // Promisify
        const companyProfile = await promisifiedCompanyProfile({ 'symbol': selectAsset }) || null;
        const stockData = await yahooFinance.quote(selectAsset);

        imageUrl = companyProfile.logo;

        if (!stockData) {
          await interaction.editReply(`Error, your symbol not found,`);
          return;
        }

        // market state
        // you can on-off if you want
        const marketState = stockData.marketState;
        if (marketState !== 'REGULAR') {
          await interaction.editReply(`Market isn't open yet.`);
          return;
        }

        marketprice = stockData.regularMarketPrice.toFixed(2);
      }
      if (sub === 'crypto') {
        const cryptoArr = data.balance.assets.crypto;
        const count = cryptoArr.length;

        selectAsset = name.toUpperCase();

        const hasSameCoin = cryptoArr.find(i => i.symbol.toUpperCase() === selectAsset);
        if (count >= 10 && !hasSameCoin) {
          return await interaction.editReply(`<@${interaction.user.id}> Sorry, the number of assets is limited to 10.`);
        }

        const allCoinPath = path.join(__dirname, '..', '..', '..', 'allcoin.json');
        if (!fs.existsSync(allCoinPath)) {
          return await interaction.editReply(`❌ ไม่พบไฟล์ allcoin.json ในระบบ กรุณาตรวจสอบพาร์ทไฟล์`);
        }
        const allCoin = JSON.parse(fs.readFileSync(allCoinPath, 'utf-8'));
        const coinMatch = allCoin.find(c =>
          c.name.toUpperCase() === selectAsset ||
          c.id.toUpperCase() === selectAsset ||
          c.symbol.toUpperCase() === selectAsset
        );
        if (!coinMatch) {
          return await interaction.editReply(`Sorry, your coin name could not find.`);
        }

        const cryptoResponse = await axios.get(`${COINGECKO_BASE_URL}/coins/${coinMatch.id}`, {
          headers: { 'x-cg-demo-api-key': COINGECKO_API_KEY }
        });
        const cryptoData = cryptoResponse.data;
        const cryptoMarketData = cryptoData.market_data;

        imageUrl = cryptoData.image.large;
        marketprice = cryptoMarketData.current_price.usd;
      }
      if (sub === 'gold') {
        const goldUrl = 'https://forex-data-feed.swissquote.com/public-quotes/bboquotes/instrument/XAU/USD';
        imageUrl = 'https://www.newtondesk.com/wp-content/uploads/2018/07/Pure-Gold.png';

        const response = await axios.get(goldUrl);
        const goldSpotPrice = (response.data[0].spreadProfilePrices[0].bid + response.data[0].spreadProfilePrices[0].ask) / 2;
        const goldYF = await yahooFinance.quote("JPY=X");

        // market state
        const marketState = goldYF.marketState;
        if (marketState !== 'REGULAR') {
          await interaction.editReply(`Market isn't open yet.`);
          return;
        }

        marketprice = goldSpotPrice.toFixed(2);
        selectAsset = 'GOLD (Spot)';
      }

      // user error
      if (mode === 'cost') {
        if (amount < 1) {
          await interaction.editReply('Minimum of amount is 1.');
          return;
        }
        totalCost = amount.toFixed(2);
        volume = (amount / marketprice).toFixed(8);
      } 
      else if (mode === 'volume') {
        if (amount <= 0) {
          await interaction.editReply(`You can't set volume to 0`);
          return;
        }
        totalCost = (amount * marketprice).toFixed(2);
        volume = amount.toFixed(8);
      } 
      else {
        await interaction.editReply('Sorry, please choose `mode`.');
        return;
      }

      if (Number(totalCost).toFixed(2) < 1) {
        return await interaction.editReply(`Minimum of buying value is 1. you buying it with price (${Number(totalCost).toFixed(2)})`);
      }

      // fee commission 0.25% (Buying)
      let fee = (totalCost * 0.0025).toFixed(2);
      if (Number(fee) === 0) {
        fee = 0.01
      }
      totalCost = (Number(totalCost) + Number(fee)).toFixed(2);

      // embed
      const embed = new EmbedBuilder()
      .setAuthor({
        name: `Request by ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTitle(`Buy ${selectAsset} (1 min remaining...)`)
      .setThumbnail(imageUrl)
      .setDescription(
        `:exclamation: Confirm purchase **${selectAsset}**\nDouble-check your information before confirm.`
      )
      .setColor('Green')
      .setFields(
        {
          name: ':page_facing_up: Details',
          value: `Price At: ${marketprice}\nVolume: ${volume}\nFee: ${fee} (0.25%)\n\n:dollar: Total Cost: ${totalCost}`,
          inline: true
        },
        {
          name: ':moneybag: Your Balance',
          value: `${userMoney.toFixed(2)}`,
          inline: true
        },
      )
      .setFooter({
        text: `🗓️ ${new Date().toLocaleString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric'
          })}, ${new Date().toLocaleString('en-US',
          { hour12: true , timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }
        )} (GMT+7)`
      });
    

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('confirm_reset')
          .setLabel('Confirm')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId('cancel_reset')
          .setLabel('Cancel')
          .setStyle(ButtonStyle.Danger)
      );

      await interaction.editReply({
        embeds: [embed],
        components: [row],
        // flags: MessageFlags.Ephemeral
      });

      
      const filter = (i) => i.user.id === interaction.user.id;

      let buttonInteraction;
      try {
        buttonInteraction = await interaction.channel.awaitMessageComponent({
          filter,
          time: 60_000, // 1 min
          componentType: ComponentType.Button,
        });
      } catch (err) {
        await interaction.editReply({
          content: `<@${interaction.user.id}> Your order expired. :timer:`,
          embeds: [],
          components: [],
          flags: MessageFlags.Ephemeral
        });
        return;
      }

      // check value button
      if (buttonInteraction.customId === 'confirm_reset') {
        // commands...
        const assetData = {
          symbol: selectAsset.toLowerCase(),
          cost: Number(totalCost),
          volume: Number(volume)
        }

        if (userMoney < totalCost) {
          await buttonInteraction.update({
            content: `<@${interaction.user.id}> You don't have enough money to buy.`,
            embeds: [],
            components: [],
            flags: MessageFlags.Ephemeral
          });
          return;
        }

        // spend moeny
        const moneyLeft = (userMoney - totalCost).toFixed(2);
        await portData.updateOne(query, { $set: {'balance.money.cash': moneyLeft} })

        if (sub === 'stock') {
          await portData.updateOne(query, {$push : {
            'balance.assets.stock': assetData
          }})
        }
        if (sub === 'crypto') {
          await portData.updateOne(query, {$push : {
            'balance.assets.crypto': assetData
          }})
        }
        if (sub === 'gold') {
          await portData.updateOne(query, {$push : {
            'balance.assets.gold': assetData
          }})
        }

        await buttonInteraction.update({
          content: `:white_check_mark: Order placed Successfully.\nYou spent: ${selectAsset} ${totalCost}`,
          embeds: [],
          components: [],
          flags: MessageFlags.Ephemeral
        });
      } else if (buttonInteraction.customId === 'cancel_reset') {
        await buttonInteraction.update({
          content: ':x: Your order has been cancelled.',
          embeds: [],
          components: [],
          flags: MessageFlags.Ephemeral
        });
      }
    }

    catch (error) {
      console.log(error);
      
      await interaction.editReply(`Error Code: ${error}`);
      return;
    }
  }
}