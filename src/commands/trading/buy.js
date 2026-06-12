const { ApplicationCommandOptionType, EmbedBuilder, EmbedAssertions,ContainerBuilder,
  TextDisplayBuilder, SeparatorBuilder, ButtonBuilder, ButtonStyle, SectionBuilder,
  MessageFlags, SeparatorSpacingSize, AttachmentBuilder, FileBuilder, MediaGalleryBuilder,
  MediaGalleryItemBuilder, ThumbnailBuilder,  ActionRowBuilder, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
 } = require('discord.js');

const axios = require('axios');
const util = require('util');
const dayjs = require('dayjs');

// database
const portData = require('../../models/portfolioUserData');

// yahoo
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// logo
const LOGO_API_KEY = process.env.LOGO_API_KEY;

const finnhub = require('finnhub');
const finnhubClient = new finnhub.DefaultApi(process.env.FINNHUB_API)
// Promisify Finnhub methods
const promisifiedCompanyProfile = util.promisify(finnhubClient.companyProfile2).bind(finnhubClient);

// Coingecko Web API
const fs = require('fs');
const path = require('path');
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";


async function createBuyOrder(color, assetType, mode, assetSymbol, marketPrice, shortName, logoURL, textDetail, fee, totalCostWithFee, interaction, amountInv, money) {
  const summary = new ContainerBuilder()
    .setAccentColor(color) // Lime green
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## :white_check_mark: Order Verified! -> (Buy)\nAsset: **${assetType.toUpperCase()}** Mode: **${mode.toUpperCase()}**`)
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(logoURL)
        )
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## :page_facing_up: Details\n- Name: **${shortName}**\n- Symbol: **${assetSymbol}**\n- Price: **$${marketPrice}**${textDetail}\n`)
    )
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`## :shopping_cart: Total Cost\n- Fee: **${fee}** (0.25%)\n- :dollar: **__$${totalCostWithFee}__** (Including Fee)`)
    )
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`## :identification_card: User's Profile\n- Wallet: **$${money}**\n- Inventory: **${amountInv}/10**`)
        )
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(interaction.user.displayAvatarURL())
        )
    )
    .addActionRowComponents(
      new ActionRowBuilder()
        .addComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Primary)
            .setLabel(`Buy $${totalCostWithFee}`)
            .setCustomId('confirm_purchase')
        )
        .addComponents(
          new ButtonBuilder()
            .setStyle(ButtonStyle.Secondary)
            .setLabel('Cancel')
            .setCustomId('cancel_purchase')
        )
    )
    .addTextDisplayComponents( new TextDisplayBuilder().setContent(`-# Please confirm your purchase within 1 minute!`))
    .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Replied by Yomi`)
    );

  return summary;
} 


module.exports = {
  name: 'buy',
  description: 'Buy assets (stock, crypto, gold) with market price.',
  // devOnly: Boolean,
  // testOnly: true,
  deleted: false,

  callback: async(client, interaction) => {
    await interaction.deferReply(/*{ flags: MessageFlags.Ephemeral }*/);

    
    const query = { userId: interaction.user.id }
    let data = await portData.findOne(query);

    if (!data) {
      await interaction.editReply(`<@${interaction.user.id}> Sorry, You need to create portfolio first.`);
      return;
    }
    

    // ! Global Variable Zone -------------------------------------------------------------
    let assetType = '';
    let mode = '';
    let assetSymbol = '';
    let amount = '';
    let amountInv = 0;

    // ! asset detial
    let marketPrice = '';
    let shortName = '';
    let logoURL = '';
    let cryptoSymbol_special = '';
    
    try {
      const select = new StringSelectMenuBuilder()
        .setCustomId('assets_select')
        .setPlaceholder('Select assets type...')
        .addOptions([
          { label: 'Stock',  description: 'USA Stock',                 value: 'stock',  emoji: '📈'},
          { label: 'ETF',    description: 'ETF in USA market',         value: 'etf',    emoji: '🏦'},
          { label: 'Crypto', description: `There's only Top 50 coins`, value: 'crypto', emoji: '💎'},
          { label: 'Gold',   description: 'Gold future only',          value: 'gold',   emoji: '🪙'},
        ]);
      const selectMode = new StringSelectMenuBuilder()
        .setCustomId('mode_select')
        .setPlaceholder('Select Mode...')
        .addOptions([
          { label: 'Cost',   description: 'Amount of money (At least 5$)',                value: 'cost',    emoji: '💰'},
          { label: 'Volume', description: 'Share quantity (At least 1 Share/Coin/Oz)',    value: 'volume',  emoji: '⚖️'},
        ]);

      const openModalBtn = new ButtonBuilder()
        .setCustomId('open_modal_btn')
        .setLabel('Fill in Information!')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📝');

      const container = new ContainerBuilder()
        .setAccentColor(0x32CD32) // Lime green

        .addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents( new TextDisplayBuilder()
              .setContent(`## :receipt: Order Buying Assets!\nSelect an asset type and mode, then fill in your Order details below`
                + `\n- **This message will appear for 1 minute!**`
              )
            )
            .setThumbnailAccessory( new ThumbnailBuilder()
              .setURL('https://raw.githubusercontent.com/JaKKrit2006/FinanceBotDiscordRebuild/refs/heads/main/src/bin/yomiGif/yomi_happy1.gif')
            )
        )
        .addSeparatorComponents( new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))

        .addTextDisplayComponents( new TextDisplayBuilder().setContent(`## :bar_chart: Assets`))
        .addActionRowComponents( new ActionRowBuilder().addComponents(select))

        .addTextDisplayComponents( new TextDisplayBuilder().setContent(`## :shopping_cart: Mode`))
        .addActionRowComponents( new ActionRowBuilder().addComponents(selectMode))
        
        .addTextDisplayComponents( new TextDisplayBuilder().setContent(`-# Please select both options above before continuing!\n`))

        .addActionRowComponents( new ActionRowBuilder().addComponents(openModalBtn))

        .addSeparatorComponents( new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
        .addTextDisplayComponents( new TextDisplayBuilder()
          .setContent(`-# Request by ${interaction.user.username}`)
        )

        const replyForm = await interaction.editReply({
          components: [container],
          flags: MessageFlags.IsComponentsV2,
        });

        // collector zone
        const filter = (i) => true; //i.user.id === interaction.user.id;
        const collector = replyForm.createMessageComponentCollector({ filter, time: 60000 });

        collector.on('collect', async (i) => {
          if (i.user.id !== interaction.user.id) {
            await i.reply({ content: `Sorry, This's not your menu!`, flags: MessageFlags.Ephemeral });
            return;
          }

          // ! Select Menu
          // ? Assets Select Menu
          if (i.customId === 'assets_select') {
            const selectedValue = i.values[0];
            assetType = selectedValue;
            await i.deferUpdate();
          }

          // ? Mode Select Menu
          if (i.customId === 'mode_select') {
            const selectedValue = i.values[0];
            mode = selectedValue;
            await i.deferUpdate();
          }

          // ! Modal Menu
          if (i.customId === 'open_modal_btn') {
            if (assetType === '' || mode === '') {
              await i.reply({
                content: `Please select both options!`,
                flags: MessageFlags.Ephemeral
              });
              return;
            }
            
            let amountText = (mode === 'volume') ? 'Quantity' : 'Amount'; 

            // modal form
            const modal = new ModalBuilder()
              .setCustomId('modal_form')
              .setTitle(`Assets's details`);

            if (assetType === 'gold') {
              const amountInput = new TextInputBuilder()
                .setCustomId('amount_input_text')
                .setLabel(amountText)
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Number only...')
                .setRequired(true);

              const secondActionRow = new ActionRowBuilder().addComponents(amountInput);
              modal.addComponents(secondActionRow);
            }
            else {
              const symbolInput = new TextInputBuilder()
                .setCustomId('symbol_input_text')
                .setLabel('Ticker or Symbol of Asset')
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Ex. NVDA, META, BTC, ETH...')
                .setRequired(true);
              const amountInput = new TextInputBuilder()
                .setCustomId('amount_input_text')
                .setLabel(amountText)
                .setStyle(TextInputStyle.Short)
                .setPlaceholder('Number only...')
                .setRequired(true);

              const firstActionRow = new ActionRowBuilder().addComponents(symbolInput);
              const secondActionRow = new ActionRowBuilder().addComponents(amountInput);
              modal.addComponents(firstActionRow, secondActionRow);
            }

            await i.showModal(modal);

            try {
              const modalSubmit = await i.awaitModalSubmit({
                filter: (m) => m.customId === 'modal_form' && m.user.id === interaction.user.id,
                time: 60000, // 1 min
              });

              await modalSubmit.deferUpdate();

              let symbolText = '';
              let amountText = '';

              if (assetType === 'gold') {
                symbolText = 'GOLD';
                amountText = modalSubmit.fields.getTextInputValue('amount_input_text');
              } else {
                symbolText = modalSubmit.fields.getTextInputValue('symbol_input_text');
                amountText = modalSubmit.fields.getTextInputValue('amount_input_text');
              }

              assetSymbol = symbolText.toUpperCase();
              let upData = await portData.findOne(query);
              // TODO check inventory
              const money = upData.balance.money.cash;
              const assetArray = upData.balance.assets;

              // ? All assets array
              const stockArray = assetArray.stock;
              const etfArray = assetArray.etf;
              const cryptoArray = assetArray.crypto;
              const goldArray = assetArray.gold;

              const getUniqueSymbols = (dataArray) => {
                const allSymbols = dataArray.map(item => item.symbol);
                return [...new Set(allSymbols)];
              };

              // ! Check Inventory
              if (assetType === 'stock') {
                const stockAmount = getUniqueSymbols(stockArray).length;
                amountInv = stockAmount;

                if (stockAmount >= 10 && !getUniqueSymbols(stockArray).includes(assetSymbol)) {
                  collector.stop('inventory_limit');
                  return;
                }
              } else if (assetType === 'etf') {
                const etfAmount = getUniqueSymbols(etfArray).length;
                amountInv = etfAmount;

                if (etfAmount >= 10 && !getUniqueSymbols(etfArray).includes(assetSymbol)) {
                  collector.stop('inventory_limit');
                  return;
                }
              }

              // console.log(getUniqueSymbols(etfArray));
              // console.log(getUniqueSymbols(cryptoArray));

              // ! Validate Input ----------------------------------------------------------------------------
              // ? Stock/ETF validation
              if (assetType === 'stock' || assetType === 'etf') {
                const quote = await yahooFinance.quote(symbolText.toUpperCase());
                
                // console.log(quote);
                // ? Check if quote exist and listed in US market
                if (!quote) {
                  collector.stop('ticker_invalid');
                  return;
                }
                else if (quote.market !== 'us_market') {
                  collector.stop('not_usa');
                  return;
                }
                
                marketPrice = quote.regularMarketPrice;
                shortName = quote.shortName;
                // * const marketSession = quote.marketState;

                let quoteType1 = quote.quoteType.toUpperCase();
                quoteType1 = quoteType1 === 'EQUITY' ? 'STOCK' : quoteType1; // Normalize to STOCK

                if (quoteType1 !== assetType.toUpperCase()) {
                  if (assetType === 'stock') {
                    collector.stop('is_etf');
                  } else {
                    collector.stop('is_stock');
                  }

                  return;
                }

                // https://img.logo.dev/ticker/voo?token=API_KEY
                logoURL = `https://img.logo.dev/ticker/${assetSymbol}?token=${LOGO_API_KEY}`;
                amount = Number(amountText);
              }
              // ? Crypto validation
              else if (assetType === 'crypto') {
                const allCoinPath = path.join(__dirname, '..', '..', '..', 'allcoin.json');
                /*if (!fs.existsSync(allCoinPath)) {
                  return await interaction.editReply(`❌ ไม่พบไฟล์ allcoin.json ในระบบ กรุณาตรวจสอบพาร์ทไฟล์`);
                }*/
                const allCoin = JSON.parse(fs.readFileSync(allCoinPath, 'utf-8'));
                const coinMatch = allCoin.find(c =>
                  c.name.toUpperCase() === assetSymbol ||
                  c.id.toUpperCase() === assetSymbol ||
                  c.symbol.toUpperCase() === assetSymbol
                );
                if (!coinMatch) {
                  collector.stop('ticker_invalid');
                  return;
                }

                const cryptoAmount = getUniqueSymbols(cryptoArray).length;
                amountInv = cryptoAmount;

                if (cryptoAmount >= 10 && !getUniqueSymbols(cryptoArray).includes(coinMatch.symbol.toUpperCase())) {
                  collector.stop('inventory_limit');
                  return;
                }

                const cryptoResponse = await axios.get(`${COINGECKO_BASE_URL}/coins/${coinMatch.id}`, {
                  headers: { 'x-cg-demo-api-key': COINGECKO_API_KEY }
                });
                const cryptoData = cryptoResponse.data;
                const cryptoMarketData = cryptoData.market_data;
                const imageUrl = cryptoData.image.large;
                const cryptoMarketPrice = cryptoMarketData.current_price.usd;

                // ? Check Stable Coin
                const isStable = cryptoData.categories?.some(cat => cat.toLowerCase().includes('stablecoin'));
                if (isStable) {
                  collector.stop('stable_coin');
                  return;
                }

                logoURL = imageUrl;
                shortName = cryptoData.name;
                amount = Number(amountText);
                marketPrice = cryptoMarketPrice;
                assetSymbol = coinMatch.symbol.toUpperCase();
              }

              // ? Gold validation
              else if (assetType === 'gold') {
                const quote = await yahooFinance.quote("GC=F");
                logoURL = `https://raw.githubusercontent.com/JaKKrit2006/icon/refs/heads/main/pngtree-a-pile-of-gold-bars-png-image_13244472.png`;
                shortName = quote.shortName;
                marketPrice = quote.regularMarketPrice;
                amount = Number(amountText);
                amountInv = '-';
              }

              if (isNaN(amountText)) {
                collector.stop('int_invalid');
              } else if (Number(amountText) < 5 && mode === 'cost') {
                collector.stop('amount_too_low');
              } else if (Number(amountText) < 1 && mode === 'volume') {
                collector.stop('volume_too_low');
              } else {
                collector.stop('done');
              }

            } catch (modalError) {
              console.log(modalError);
            }
          }
        });

        // collector end after 1 min
        collector.on('end', async (collected, reason) => {
          const collectContainer = new ContainerBuilder();
          // console.log(reason); // TODO continue to buy

          let titleText = '';
          let descText = '';
          let gifURL = '';
          let color = 0xDC143C; // crimson

          // ? Continue to buy process here if reason is 'done'
          if (reason === 'done') {
            let textDetail = '';
            let volume = mode === 'cost' ? (amount / marketPrice).toFixed(7) : amount;
            let totalCost = (mode === 'cost') ? amount : (volume * marketPrice).toFixed(2);
            let fee = (totalCost * 0.0025).toFixed(2);
            let totalCostWithFee = (totalCost * 1.0025).toFixed(2);

            color = 0x32CD32; // Lime green

            if (assetType === 'stock') {
              const companyProfile = await promisifiedCompanyProfile({ 'symbol': assetSymbol });
              logoURL = companyProfile.logo || logoURL; // Fallback to constructed URL if Finnhub doesn't return a logo
            }

            if (mode === 'cost' && (assetType === 'stock' || assetType === 'etf')) {
              textDetail = `\n- Amount: **$${amount}**\n- Volume: **${volume}** Shares`;
            }
            else if (mode === 'cost' && assetType === 'crypto') {
              textDetail = `\n- Amount: **$${amount}**\n- Volume: **${volume}** Coins`;
            }
            else if (mode === 'cost' && assetType === 'gold') {
              textDetail = `\n- Amount: **$${amount}**\n- Volume: **${volume}** Oz`;
            }
            else if (mode === 'volume' && (assetType === 'stock' || assetType === 'etf')) {
              textDetail = `\n- Volume: **${amount}** Shares`;
            }
            else if (mode === 'volume' && assetType === 'crypto') {
              textDetail = `\n- Volume: **${amount}** Coins`;
            }
            else if (mode === 'volume' && assetType === 'gold') {
              textDetail = `\n- Volume: **${amount}** Oz`;
            }
            const money = data.balance.money.cash;
            // ! function
            const summary = await createBuyOrder(color, assetType, mode, assetSymbol, marketPrice, shortName,
              logoURL, textDetail, fee, totalCostWithFee, interaction, amountInv, money);
            
            const response = await interaction.editReply({
              components: [summary],
              flags: MessageFlags.IsComponentsV2
            });

            const filter1 = (i) => true;
            const collector1 = response.createMessageComponentCollector({ filter: filter1, time: 60000 });

            collector1.on('collect', async (i) => {
              if (i.user.id !== interaction.user.id) {
                await i.reply({ content: `Sorry, This's not your menu!`, flags: MessageFlags.Ephemeral });
                return;
              }
              
              // ? Confirm Buy
              if (i.customId === 'confirm_purchase') {
                await i.deferUpdate();

                const money = data.balance.money.cash;

                if (money < totalCostWithFee) {
                  collector1.stop('money_limit');
                  return;
                }

                const moneyPayload = {
                  value: money,
                  time: new Date()
                }
                
                const payloadData = {
                  symbol: assetSymbol,
                  volume: Number(volume),
                  cost: Number(totalCostWithFee),
                  date: new Date(), // ? UTC TIME
                  logoURL: logoURL
                };

                const txnData = {
                  symbol: assetSymbol,
                  volume: Number(volume),
                  cost: Number(totalCostWithFee),
                  date: new Date(), // ? UTC TIME
                  logoURL: logoURL,
                  type: 'buy',
                  assetType: assetType,
                };

                await portData.updateOne(query, {
                  $push : {
                  [`balance.assets.${assetType.toLowerCase()}`]: payloadData,
                  ['transaction']: txnData,
                  ['moneytxn']: moneyPayload
                }})
                await portData.updateOne(query, {
                  $set : {
                  'balance.money.cash': parseFloat(money - totalCostWithFee).toFixed(2)
                }})

                collector1.stop('done');
              } 
              
              // ? Cancel Buy
              else if (i.customId === 'cancel_purchase') {
                await i.deferUpdate();
                collector1.stop('cancel');
              }
            });

            collector1.on('end', async (collected, reason) => {
              // TODO Make function to reduce code
              
              if (reason === 'time') {
                titleText = ':receipt: Order Expired!';
                descText = 'You need to confirm within **1 minute**, Please try again';
                gifURL = `https://raw.githubusercontent.com/JaKKrit2006/FinanceBotDiscordRebuild/refs/heads/main/src/bin/yomiGif/yomi_sad1.gif`
              }
              else if (reason === 'cancel') {
                titleText = ':receipt: Cancel Order!';
                descText = `You just **canceled** the Order!`;
                gifURL = `https://raw.githubusercontent.com/JaKKrit2006/FinanceBotDiscordRebuild/refs/heads/main/src/bin/yomiGif/yomi_sad3.gif`
              }
              else if (reason === 'money_limit') {
                titleText = ':receipt: Not Enough Money!';
                descText = `You only have **$${money}** but total cost is **$${totalCostWithFee}**`;
                gifURL = `https://raw.githubusercontent.com/JaKKrit2006/FinanceBotDiscordRebuild/refs/heads/main/src/bin/yomiGif/yomi_sad3.gif`
              }

              if (reason === 'done') {
                const container = new ContainerBuilder()
                  .setAccentColor(0x32CD32)
                  .addSectionComponents(
                    new SectionBuilder()
                      .addTextDisplayComponents( new TextDisplayBuilder().setContent(`## :receipt: Buy Order Placed!\n- Asset: **${assetType.toUpperCase()}**\n- Symbol: **${assetSymbol}**\n- Entry Price: **$${marketPrice}**`
                        + `\n- Volume: **${volume}**\n- Date: **${dayjs().format('hh:mm A, ddd D MMM YYYY')} ICT**\n- Value: :dollar: **__$${totalCostWithFee}__**`))
                      .setThumbnailAccessory( new ThumbnailBuilder().setURL(interaction.user.displayAvatarURL()))
                  )
                  .addSeparatorComponents( new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
                  .addTextDisplayComponents( new TextDisplayBuilder()
                    .setContent(`-# Replied by Yomi`)
                  )

                await interaction.editReply({
                  components: [ container ],
                  flags: MessageFlags.IsComponentsV2
                });
              }

              else {
                // ! crate container when Error or Time out
                collectContainer
                  .setAccentColor(0xDC143C) // default crimson

                  .addSectionComponents(
                    new SectionBuilder()
                      .addTextDisplayComponents( new TextDisplayBuilder()
                        .setContent(`## ${titleText}\n:x: <@${interaction.user.id}> ${descText}\n- Thank you for your attention`)
                      )
                      .setThumbnailAccessory( new ThumbnailBuilder()
                        .setURL(gifURL)
                      )
                  )
                  .addSeparatorComponents( new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
                  .addTextDisplayComponents( new TextDisplayBuilder()
                    .setContent(`-# Replied by Yomi`)  
                  )

                await interaction.editReply({
                  components: [ collectContainer ],
                  flags: MessageFlags.IsComponentsV2
                });
              }
              
            });
          }

          if (reason === 'ticker_invalid') {
            titleText = ':pencil: Type Error!';
            descText = `Ticker **${assetSymbol}** not found! Please check your input`;
            gifURL = 'https://raw.githubusercontent.com/JaKKrit2006/FinanceBotDiscordRebuild/refs/heads/main/src/bin/yomiGif/yomi_blank2.gif';
          }
          
          else if (reason === 'inventory_limit') {
            titleText = ':pencil: Inventory Limit!';
            descText = `**${assetType.toUpperCase()}** inventory is full you need to **sell all/remove** some stock`;
            gifURL = 'https://raw.githubusercontent.com/JaKKrit2006/FinanceBotDiscordRebuild/refs/heads/main/src/bin/yomiGif/yomi_blank2.gif';
          }

          else if (reason === 'stable_coin') {
            titleText = ':pencil: Input Error!';
            descText = `Coin **${assetSymbol}** is a Stable Coin, not allowed in this Order`;
            gifURL = 'https://raw.githubusercontent.com/JaKKrit2006/FinanceBotDiscordRebuild/refs/heads/main/src/bin/yomiGif/yomi_blank2.gif';
          }

          else if (reason === 'not_usa') {
            titleText = ':flag_us: Market Error!';
            descText = `Ticker **${assetSymbol}** is not listed on the US market`;
            gifURL = 'https://raw.githubusercontent.com/JaKKrit2006/FinanceBotDiscordRebuild/refs/heads/main/src/bin/yomiGif/yomi_blank2.gif';
          }

          else if (reason === 'int_invalid') {
            titleText = ':pencil: Type Error!';
            descText = 'Amount input should be an **Integer!**';
            gifURL = 'https://raw.githubusercontent.com/JaKKrit2006/FinanceBotDiscordRebuild/refs/heads/main/src/bin/yomiGif/yomi_blank1.gif';
          }

          else if (reason === 'amount_too_low') {
            titleText = ':pencil: Value Error!';
            descText = 'Amount Mode must be at least **5$**';
            gifURL = 'https://raw.githubusercontent.com/JaKKrit2006/FinanceBotDiscordRebuild/refs/heads/main/src/bin/yomiGif/yomi_blank1.gif';
          }

          else if (reason === 'volume_too_low') {
            titleText = ':pencil: Value Error!';
            descText = 'Volume Mode must be at least **1 Share/Coin/Oz**';
            gifURL = 'https://raw.githubusercontent.com/JaKKrit2006/FinanceBotDiscordRebuild/refs/heads/main/src/bin/yomiGif/yomi_blank1.gif';
          }

          else if (reason === 'is_etf') {
            color = 0xF4BB44; // mango
            titleText = ':pencil: Input Error!';
            descText = `Ticker **${assetSymbol}** is an ETF, not a stock`;
            gifURL = 'https://raw.githubusercontent.com/JaKKrit2006/FinanceBotDiscordRebuild/refs/heads/main/src/bin/yomiGif/yomi_blank2.gif';
          }
          
          else if (reason === 'is_stock') {
            color = 0xF4BB44; // mango
            titleText = ':pencil: Input Error!';
            descText = `Ticker **${assetSymbol}** is a stock, not an ETF`;
            gifURL = 'https://raw.githubusercontent.com/JaKKrit2006/FinanceBotDiscordRebuild/refs/heads/main/src/bin/yomiGif/yomi_blank1.gif';
          }

          else if (reason === 'time') {
            const randomIndex = Math.floor(Math.random() * 3) + 1 // 1-3
            titleText = ':receipt: Order Expired!';
            descText = 'You need to fill in all information within **1 minute**';
            gifURL = `https://raw.githubusercontent.com/JaKKrit2006/FinanceBotDiscordRebuild/refs/heads/main/src/bin/yomiGif/yomi_sad${randomIndex}.gif`;
          }

          if (reason !== 'done') {
            // ! crate container when Error or Time out
            collectContainer
              .setAccentColor(color)

              .addSectionComponents(
                new SectionBuilder()
                  .addTextDisplayComponents( new TextDisplayBuilder()
                    .setContent(`## ${titleText}\n:x: <@${interaction.user.id}> ${descText}, Please try again\n- Thank you for your attention`)
                  )
                  .setThumbnailAccessory( new ThumbnailBuilder()
                    .setURL(gifURL || 'https://raw.githubusercontent.com/JaKKrit2006/FinanceBotDiscordRebuild/refs/heads/main/src/bin/yomiGif/yomi_idle1.gif')
                  )
              )
              .addSeparatorComponents( new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
              .addTextDisplayComponents( new TextDisplayBuilder()
                .setContent(`-# Replied by Yomi`)  
              )

            await interaction.editReply({
              components: [ collectContainer ],
              flags: MessageFlags.IsComponentsV2
            });
          }
          
        });
    }

    catch (error) {
      console.log(error);
      await interaction.editReply(`Error Code: ${error}`);
      return;
    }
  }
}