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
    const money = data.balance.money.cash;

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

    // cost, volume and money alert when user enter wrong input
    if (money < cost) {
      await interaction.editReply(`Sorry, your money is not enough. (Your Balance: ${money}฿)`);
      return;
    }

    if (cost < 1) {
      await interaction.editReply(`Sorry, you can't set cost below 1`);
      return;
    }

    if (volume <= 0) {
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
    const moneyLeft = money - cost;
    await portData.updateOne(query, { $set: {'balance.money.cash': moneyLeft} })

    // merge data
    //
    //
    //

    // update data
    data = await portData.findOne(query);

    await interaction.editReply(`[${sub.toUpperCase()}] Add ${symbol} total cost: ${cost} volume: ${volume}`)
    // console.log(assetData);
    // console.log(data);
  }

  catch (error) {
    await interaction.editReply(`Error Code: ${error}`);
    console.log(error);

    return;
  }
}


module.exports = {
  name: 'portfolio',
  description: 'Check your balance and assets',

  options: [
    {
      name: 'create',
      description: 'Create a portfoilio.',
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
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'accept',
          description: 'Are you sure?',
          type: ApplicationCommandOptionType.Boolean,
          required: true,
        },
        {
          name: 'show',
          description: 'show your portfolio to everyone in the channel.',
          type: ApplicationCommandOptionType.Boolean,
        }
      ]
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
    },
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
    const show = interaction.options.getBoolean('show');
    let hide = 0;
    if (!show) {
      hide = MessageFlags.Ephemeral
    }
    await interaction.deferReply({ flags: hide });

    try {
      // user input
      const group = interaction.options.getSubcommandGroup(); // add
      const cost = interaction.options.getNumber('cost');
      const volume = interaction.options.getNumber('volume');
      const symbol = interaction.options.getString('symbol');  // stock
      const name = interaction.options.getString('name'); // crypto
      
      const sub = interaction.options.getSubcommand();
      const accept = interaction.options.getBoolean('accept');
      

      const basePayload = {
        ranks: 'Newbie',
        time: new Date(),
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

      if (group === 'add') {
        if (!data) {
          await interaction.editReply(`<@${interaction.user.id}> Sorry, you need to create your portfolio first.`);
          return;
        }
        
        addAssetData(interaction, query, sub, (symbol || name), cost, volume);
        return;
      }


      // Create a portfolio
      if (sub === 'create' && accept) {
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

      // delete portfolio's data
      if (sub === 'delete' && accept) {
        if (!data) {
          await interaction.editReply(`<@${interaction.user.id}> Sorry, you need to create your portfolio first.`);
          return;
        } 

        // delete data
        const result = await portData.deleteOne(query); // ⭐ ต้อง await
        if (result.deletedCount === 1) {
          await interaction.editReply(`<@${interaction.user.id}> Delete your data successfully.`);
        } else {
          await interaction.editReply(`<@${interaction.user.id}> Nothing to delete (not found).`);
        }

        return;
      }

      // check status
      if (sub === 'check' && accept) {
        if (!data) {
          await interaction.editReply(`<@${interaction.user.id}> Sorry, you need to create your portfolio first.`);
          return;
        } 

        let upData = await portData.findOne(query);

        // assets array data 
        const stockArr = combineValueArray(upData.balance.assets.stock);
        const cryptoArr = combineValueArray(upData.balance.assets.crypto);
        const goldArr = combineValueArray(upData.balance.assets.gold);
        
        // update data after combine
        await portData.updateOne(query, { $set: {
          'balance.assets.stock': stockArr,
          'balance.assets.crypto': cryptoArr,
          'balance.assets.gold': goldArr
        }})

        upData = await portData.findOne(query);

        const totalWealth = upData.wealth;

        let stockSymbol = await getAllSymbol(upData, 'stock');
        let cryptoSymbol = await getAllSymbol(upData, 'crypto');
        // const goldSymbol = await getAllSymbol(upData, 'gold');

        const myMoney = upData.balance.money.cash;

        let userBalance = myMoney; // myMoney is default setting
        let totalCost = myMoney;

        // check all of totalcost user spend
        stockArr.forEach(item => {
          const cost = item.cost;
          totalCost += cost;
        });
        cryptoArr.forEach(item => {
          const cost = item.cost;
          totalCost += cost;
        });
        goldArr.forEach(item => {
          const cost = item.cost;
          totalCost += cost;
        });


        let stockSymList = ['None'];
        let stockVolCostList = ['-'];
        let stockPriceList = ['-'];
        let cryptoSymList = ['None'];
        let cryptoVolCostList = ['-'];
        let cryptoPriceList = ['-'];
        let goldSym = ['None'];
        let goldVolCost = ['-'];
        let goldPrice = ['-'];
        
  
        if (stockSymbol.length !== 0) {
          const stockData = await yahooFinance.quote(stockSymbol);
          stockSymList = [];
          stockVolCostList = [];
          stockPriceList = [];

          // create new array object
          let newArray = [];

          stockData.forEach(item => {
            const itemSymbol = item.symbol;
            const mySelectAssets = upData.balance.assets.stock.find(i => i.symbol.toUpperCase() === itemSymbol);
            const myVolumeAssets = mySelectAssets.volume;
            const itemPrice = item.regularMarketPrice;
            const cost = itemPrice * myVolumeAssets;

            const dataObject = {
              symbol: item.symbol.toUpperCase(),
              market: itemPrice * myVolumeAssets,
              volume: myVolumeAssets,
              cost: mySelectAssets.cost
            }

            newArray.push(dataObject);
            userBalance += cost;
          });

          newArray.sort((a, b) => b.market - a.market);
          newArray.forEach(item => {
            const diff = item.market - item.cost;
            const diffPercent = 100 * ((item.market/item.cost) - 1);

            const sym = `${item.symbol}\n`;
            const volCost = `${item.volume >= 100 ? item.volume.toFixed(4) : item.volume.toFixed(7)} | ${item.cost.toFixed(2)}\n`;
            const market = `${item.market.toFixed(2)} (${diff > 0 ? '+' : ''}${diff.toFixed(2)} ${diffPercent.toFixed(2)}%)\n`;

            stockSymList.push(sym);
            stockVolCostList.push(volCost);
            stockPriceList.push(market);
          });
        }

        if (cryptoArr.length !== 0) {
          cryptoSymList = [];
          cryptoVolCostList = [];
          cryptoPriceList = [];

          // อ่าน allcoin.json จากเครื่อง
          const allCoinPath = path.join(__dirname, '..', '..', '..', 'allcoin.json');
          if (!fs.existsSync(allCoinPath)) {
            return await interaction.editReply(`❌ ไม่พบไฟล์ allcoin.json ในระบบ กรุณาตรวจสอบพาร์ทไฟล์`);
          }
          const allCoin = JSON.parse(fs.readFileSync(allCoinPath, 'utf-8'));

          // แปลงชื่อเหรียญ → coin id
          let cryptoSym = [];
          for (const item of cryptoSymbol) {
            const coinMatch = allCoin.find(c =>
              c.name.toUpperCase() === item.toUpperCase() ||
              c.id.toUpperCase() === item.toUpperCase() ||
              c.symbol.toUpperCase() === item.toUpperCase()
            );
            if (coinMatch) {
              cryptoSym.push(coinMatch.id);
            }
          }

          if (cryptoSym.length === 0) {
            return await interaction.editReply(`❌ ไม่พบข้อมูลเหรียญในไฟล์ระบบ`);
          }

          // ดึงราคาจาก CoinGecko Web API (simple/price)
          const priceResponse = await axios.get(`${COINGECKO_BASE_URL}/simple/price`, {
            headers: { 'x-cg-demo-api-key': COINGECKO_API_KEY },
            params: {
              ids: cryptoSym.join(','),
              vs_currencies: 'usd'
            }
          });

          const priceData = priceResponse.data;
          // console.log(priceData);

          // create new array object
          let newArray = [];

          for (const coinId of Object.keys(priceData)) {
            const itemPrice = priceData[coinId].usd;

            // หา asset ที่ตรงกับ coin id หรือชื่อ
            const coinInfo = allCoin.find(c => c.id.toUpperCase() === coinId.toUpperCase());
            let mySelectAssets;
            if (coinInfo) {
              mySelectAssets = upData.balance.assets.crypto.find(
                i => i.symbol.toUpperCase() === coinInfo.symbol.toUpperCase()
              );
            }
            if (!mySelectAssets) continue;

            const myVolumeAssets = mySelectAssets.volume;
            const cost = itemPrice * myVolumeAssets;

            newArray.push({
              symbol: mySelectAssets.symbol.toUpperCase(),
              market: cost,
              volume: myVolumeAssets,
              cost: mySelectAssets.cost
            });
            userBalance += cost;
          }

          newArray.sort((a, b) => b.market - a.market);
          newArray.forEach(item => {
            const diff = item.market - item.cost;
            const diffPercent = 100 * ((item.market/item.cost) - 1);

            const sym = `${item.symbol}\n`;
            const volCost = `${item.volume >= 100 ? item.volume.toFixed(4) : item.volume.toFixed(7)} | ${item.cost.toFixed(2)}\n`;
            const market = `${item.market.toFixed(2)} (${diff > 0 ? '+' : ''}${diff.toFixed(2)} ${diffPercent.toFixed(2)}%)\n`;

            cryptoSymList.push(sym);
            cryptoVolCostList.push(volCost);
            cryptoPriceList.push(market);
          });
        }

        if (goldArr.length !== 0) {
          const response = await axios.get(goldUrl);
          const goldSpotPrice = (response.data[0].spreadProfilePrices[0].bid + response.data[0].spreadProfilePrices[0].ask) / 2;
          const myVolumeAssets = upData.balance.assets.gold[0].volume;
          const cost = goldSpotPrice * myVolumeAssets;
          const costBuy = upData.balance.assets.gold[0].cost;

          const diff = cost - costBuy;
          const diffPercent = 100 * ((cost/costBuy) -1);

          goldSym = 'Gold (Spot)';
          goldVolCost = `${myVolumeAssets >= 100 ? myVolumeAssets.toFixed(4) : myVolumeAssets.toFixed(7)} | ${costBuy.toFixed(2)}`;
          goldPrice = `${cost.toFixed(2)} (${diff > 0 ? '+' : ''}${diff.toFixed(2)} ${diffPercent.toFixed(2)}%)`;
          userBalance += cost;
        }

        const diff = (userBalance - totalCost).toFixed(2);
        const diffPercent = (((userBalance/totalCost) - 1) * 100).toFixed(2);

        // update wealth data after calculate balance
        await portData.updateOne(query, { $set: {
          'wealth': userBalance,
        }})

        // TODO Ui for user status
        // console.log(interaction)
        const userEmbed = new EmbedBuilder()
          .setAuthor({
            name: `Request by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          })
          .setTitle(`${interaction.user.username}'s Portfolio`)
          .setColor(await getColorImage(interaction.user.displayAvatarURL()))
          .setThumbnail(interaction.user.displayAvatarURL() || null)
          .setFooter({
            text: `🗓️ ${new Date().toLocaleString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric'
              })}, ${new Date().toLocaleString('en-US',
              { hour12: true , timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }
            )} (GMT+7)`
          })
          .setDescription(`Created At ${formatToGMT7(upData.time)} (GMT+7)`)
          .setFields(
            {
              name: `${diff > 0 ? ':small_red_triangle:' : ':small_red_triangle_down:'} Balance`,
              value: `${Number(userBalance).toFixed(2)}\n(${diff} ${diffPercent}%)`,
              inline: true
            },
            {
              name: ':moneybag: Money',
              value: `${myMoney.toFixed(2)}`,
              inline: true
            },
            {
              name: ':medal: Rank',
              value: `${upData.ranks}`,
              inline: true
            },
            {
              name: 'Stock',
              value: `${stockSymList.join('')}`,
              inline: true
            },
            {
              name: 'Volume | Cost',
              value: `${stockVolCostList.join('')}`,
              inline: true
            },
            {
              name: 'Market Price',
              value: `${stockPriceList.join('')}`,
              inline: true
            },
            {
              name: 'Crypto',
              value: `${cryptoSymList.join('')}`,
              inline: true
            },
            {
              name: 'Volume | Cost',
              value: `${cryptoVolCostList.join('')}`,
              inline: true
            },
            {
              name: 'Market Price',
              value: `${cryptoPriceList.join('')}`,
              inline: true
            },
            {
              name: 'Gold',
              value: `${goldSym}`,
              inline: true
            },
            {
              name: 'Volume | Cost',
              value: `${goldVolCost}`,
              inline: true
            },
            {
              name: 'Market Price',
              value: `${goldPrice}`,
              inline: true
            },
            {
              name: 'Currency',
              value: `:flag_us: USD`,
              inline: true
            }
          );

        await interaction.editReply({
          /* content: `<@${interaction.user.id}>\nBalance: ${userBalance.toFixed(2)} (cost basic ${totalCost.toFixed(2)})\n` +
          `Your money: ${myMoney} (${diff} ${diffPercent}%) \nAssets:
          stock: ${stockSymbol.join(', ')}
          crypto: ${cryptoSymbol.join(', ')}
          gold: ${goldSymbol.join(', ')}`,
          */
          embeds: [ userEmbed ]
        });
        return;
      }

      await interaction.editReply(`<@${interaction.user.id}> ` + 'If you want to do command. Please select `accept=true` and confirm again.');
    }

    catch (error) {
      console.log(error);
      interaction.editReply(`Error Code: ${error}`);
      
      return;
    }
  }
}