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


async function getVolumeAsset(sub, symbol, database) {
  try {
    let volume = 0;
  
    if (sub === 'gold') {
      const gold = database.balance.assets.gold[0]
      volume = gold.volume;
    }

    if (sub === 'stock') {
      const selectAsset = database.balance.assets.stock.find(i => i.symbol === symbol.toLowerCase());
      volume = selectAsset.volume;
    }

    if (sub === 'crypto') {
      const selectAsset = database.balance.assets.crypto.find(i => i.symbol === symbol.toLowerCase());
      volume = selectAsset.volume;
    }

    return volume.toFixed(8);
  }
  catch (error) {
    return false;
  }
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
  name: 'sell',
  description: 'Sell assets (stock, crypto, gold) with market price.',
  // devOnly: Boolean,
  // testOnly: true,
  // deleted: Boolean,

  options: [
    {
      name: 'stock',
      description: 'sell stock',
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
          description: 'select sell by (volume, cost)',
          type: ApplicationCommandOptionType.String,
          require: true,
          choices: [
            { name: 'cost', value: 'cost'},
            { name: 'volume', value: 'volume'}
          ]
        },
        {
          name: 'amount',
          description: 'sell amount or all (volume mode: number or percent 10%, 50%, all)',
          type: ApplicationCommandOptionType.String,
          require: true
        },
      ]
    },
    {
      name: 'crypto',
      description: 'sell crypto',
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
          description: 'select sell by (volume, cost)',
          type: ApplicationCommandOptionType.String,
          require: true,
          choices: [
            { name: 'cost', value: 'cost'},
            { name: 'volume', value: 'volume'}
          ]
        },
        {
          name: 'amount',
          description: 'sell amount or all (volume mode: number or percent 10%, 50%, all)',
          type: ApplicationCommandOptionType.String,
          require: true
        },
      ]
    },
    {
      name: 'gold',
      description: 'sell gold',
      type: ApplicationCommandOptionType.Subcommand,

      options: [
        {
          name: 'mode',
          description: 'select sell by (volume, cost)',
          type: ApplicationCommandOptionType.String,
          require: true,
          choices: [
            { name: 'cost', value: 'cost'},
            { name: 'volume', value: 'volume'}
          ]
        },
        {
          name: 'amount',
          description: 'sell amount or all (volume mode: number or percent 10%, 50%, all)',
          type: ApplicationCommandOptionType.String,
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
      let amount = interaction.options.getString('amount'); // interpret by mode

      // if no input data
      if (sub !== 'gold' && !(name || symbol)) {
        await interaction.editReply(`<@${interaction.user.id}> Sorry, You didn't enter any input data`);
        return;
      }

      let volume = 0;
      let marketprice = 0.1 || 1;
      let totalCost = 0;
      let selectAsset = '';
      let imageUrl = '';

      // user id
      const query = { userId: interaction.user.id }
      const data = await portData.findOne(query);

      // combine value in array first
      // assets array data
      const stockArr = combineValueArray(data.balance.assets.stock);
      const cryptoArr = combineValueArray(data.balance.assets.crypto);
      const goldArr = combineValueArray(data.balance.assets.gold);
      
      await portData.updateOne(query, { $set: {
        'balance.assets.stock': stockArr,
        'balance.assets.crypto': cryptoArr,
        'balance.assets.gold': goldArr
      }})

      // if no data
      if (!data) {
        return await interaction.editReply(`<@${interaction.user.id}> Sorry, You need to create portfolio first.`);
      }

      const userMoney = data.balance.money.cash;
      // debug
      // console.log(amount);

      // check user input
      if (sub === 'stock') {
        selectAsset = symbol.toUpperCase();
        // Promisify
        const companyProfile = await promisifiedCompanyProfile({ 'symbol': selectAsset }) || null;
        const stockData = await yahooFinance.quote(selectAsset);

        imageUrl = companyProfile.logo;
        
        // if stock no data
        if (!stockData) {
          return await interaction.editReply(`Error, your symbol not found,`);
        }

        // market state
        // you can on-off if you want
        const testOnly = true;
        const marketState = stockData.marketState;
        if (marketState !== 'REGUlAR' && !testOnly) {
          return await interaction.editReply(`Market isn't open yet.`);
        }

        marketprice = stockData.regularMarketPrice.toFixed(2);
      }
      if (sub === 'crypto') {
        selectAsset = name.toUpperCase();

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
        const goldYF = await yahooFinance.quote("GC=F");

        // market state
        const marketState = goldYF.marketState;
        if (marketState !== 'REGULAR') {
          return await interaction.editReply(`Market isn't open yet.`);
        }

        marketprice = goldSpotPrice.toFixed(2);
        selectAsset = 'GOLD (Spot)';
      }

      // percent input
      let hasPercentage = false;
      if (amount.includes('%')) {
        hasPercentage = true;
      }

      if (!hasPercentage && amount.toLowerCase() !== 'all') {
        amount = Number(amount);
      }

      // update data
      let upData = await portData.findOne(query);
      const volumeAsset = await getVolumeAsset(sub, (name || symbol), upData);

      if (!volumeAsset) {
        return await interaction.editReply(`Sorry, you don't have ${selectAsset} in your database`);
      }

      // if user has asset's value approximately 0$
      const valueSelectAsset = marketprice * volumeAsset;

      if (valueSelectAsset.toFixed(2) <= 0) {
        return await interaction.editReply(`Sorry, your asset's value nearly to 0$\n- you need to buy more and try to sell 'All'.`);
      }

      if (mode === 'cost') {
        // user error
        if (hasPercentage) {
          return await interaction.editReply(`Sorry, % form is only available in volume mode.`);
        }

        if (amount < 1) {
          return await interaction.editReply('Minimum of amount is 1.');
        }
        
        if (typeof amount === 'string') {
          if (amount.toLowerCase() === 'all') {
            volume = volumeAsset;
            totalCost = volume * marketprice;
          }
        } else if (Number.isFinite(amount)) {
          totalCost = amount.toFixed(2);
          volume = (amount / marketprice).toFixed(8);
        } else {
          return await interaction.editReply(`Sorry, cost mode input can only be a Number or 'All'`);
        }
      } 
      else if (mode === 'volume') {
        let divider = 0;

        // user error
        if (amount <= 0) {
          await interaction.editReply('You can not set volume to 0 or less');
          return;
        }

        if (hasPercentage) {
          divider = parseFloat(amount); // convert '10%' -> 10
        
          if (divider > 100 || divider < 1) {
            return await interaction.editReply(`Sorry, you can set percent in this range (1-100%).`);
          }
          divider = divider / 100;
          
          volume = divider * volumeAsset;
          totalCost = volume * marketprice;
        } else if (typeof amount === 'string') {
          if (amount.toLowerCase() === 'all') {
            volume = volumeAsset;
            totalCost = volume * marketprice;
          }
        } else if (Number.isFinite(amount)) {
          totalCost = (amount * marketprice).toFixed(2);
          volume = amount.toFixed(8);
        } else {
          return await interaction.editReply(`Sorry, volume mode input can only be a Number or Percent ('10%') or 'All'`);
        }        
      } 
      else {
        return await interaction.editReply('Error, please choose `mode`.'); 
      }

      if (Number(totalCost).toFixed(2) < 1) {
        return await interaction.editReply(`Minimum for selling value is 1. you selling it with price (${Number(totalCost).toFixed(2)})`); 
      }

      let costBeforeFee = Number(totalCost).toFixed(2);
      // fee commission 0.25% (Selling)
      let fee = (totalCost * 0.0025).toFixed(2);
      if (Number(fee) === 0) {
        fee = 0.01
      }
      totalCost = (Number(totalCost) - Number(fee)).toFixed(2); // minus bc selling
      volume = Number(volume).toFixed(8);

      // embeds
      const embed = new EmbedBuilder()
      .setAuthor({
        name: `Request by ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTitle(`Sell ${selectAsset} (1 min remaining...)`)
      .setThumbnail(imageUrl)
      .setDescription(
        `:exclamation: Confirm sell **${selectAsset}**\nDouble-check your information before confirm.`
      )
      .setColor('Red')
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
        flags: MessageFlags.Ephemeral
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
          // flags: MessageFlags.Ephemeral
        });
        return;
      }

      // check value button
      if (buttonInteraction.customId === 'confirm_reset') {
        // TODO add a logic
        // assetvolume - selling if <= 0.000001 delete that object
        totalCost = Number(totalCost);
        const threshold = 0.000001;

        let stockData = upData.balance.assets.stock;
        let cryptoData = upData.balance.assets.crypto;
        let goldData = upData.balance.assets.gold;

        // user money
        let userMoney = upData.balance.money.cash;
        // console.log(stockData);
        // costBeforeFee
        let leftVolume = volumeAsset - volume;
        // console.log("working...");
      

        if (sub === 'stock') {
          const selectAsset = stockData.findIndex(i => i.symbol === symbol.toLowerCase());
          stockData[selectAsset].volume = leftVolume;
          stockData[selectAsset].cost -= costBeforeFee;

          let filterArray = [];
          filterArray = stockData;

          if (leftVolume <= threshold) {
            // delete that stock
            filterArray = stockData.filter(i => i.symbol !== symbol.toLowerCase());
            // console.log(`This stock is almost zero`);
          }

          await portData.updateOne(query, {$set : {
            'balance.assets.stock': filterArray
          }})
        }

        if (sub === 'crypto') {
          const selectAsset = cryptoData.findIndex(i => i.symbol === name.toLowerCase());
          cryptoData[selectAsset].volume = leftVolume;
          cryptoData[selectAsset].cost -= costBeforeFee;

          let filterArray = [];
          filterArray = cryptoData;

          if (leftVolume <= threshold) {
            // delete that stock
            filterArray = cryptoData.filter(i => i.symbol !== name.toLowerCase());
            // console.log(`This stock is almost zero`);
          }

          await portData.updateOne(query, {$set : {
            'balance.assets.crypto': filterArray
          }})
        }

        if (sub === 'gold') {
          const selectAsset = goldData[0];
          selectAsset.volume = leftVolume;
          selectAsset.cost -= costBeforeFee;

          let filterArray = [];
          filterArray = goldData;

          if (leftVolume <= threshold) {
            // delete that stock
            filterArray = [];
            // console.log(`This stock is almost zero`);
          }

          await portData.updateOne(query, {$set : {
            'balance.assets.gold': filterArray
          }})
        }

        
        userMoney += totalCost;
        await portData.updateOne(query, {$set : { 'balance.money.cash': userMoney }})

        await buttonInteraction.update({
          content: `:white_check_mark: Order placed Successfully.\nYou sold: ${selectAsset} Received: ${totalCost}`,
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