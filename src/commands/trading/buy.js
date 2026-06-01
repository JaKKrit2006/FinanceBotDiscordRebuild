const { ApplicationCommandOptionType, EmbedBuilder, EmbedAssertions,ContainerBuilder,
  TextDisplayBuilder, SeparatorBuilder, ButtonBuilder, ButtonStyle, SectionBuilder,
  MessageFlags, SeparatorSpacingSize, AttachmentBuilder, FileBuilder, MediaGalleryBuilder,
  MediaGalleryItemBuilder, ThumbnailBuilder,  ActionRowBuilder, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
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
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";

module.exports = {
  name: 'buy',
  description: 'Buy assets (stock, crypto, gold) with market price.',
  // devOnly: Boolean,
  // testOnly: true,
  deleted: false,

  callback: async(client, interaction) => {
    await interaction.deferReply(/*{ flags: MessageFlags.Ephemeral }*/);

    let assetType = '';
    let mode = '';
    let assetSymbol = '';
    let amount = '';
    
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
          { label: 'Cost',   description: 'Amount of money',   value: 'cost',    emoji: '💰'},
          { label: 'Volume', description: 'Share quantity',    value: 'volume',  emoji: '⚖️'},
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
              .setContent(`## :receipt: Contract Buying Assets!\nSelect an asset type and mode, then fill in your contract details below`
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

            await i.reply({
              content: `you chose: **${selectedValue}**`,
              flags: MessageFlags.Ephemeral
            });
          }

          // ? Mode Select Menu
          if (i.customId === 'mode_select') {
            const selectedValue = i.values[0];
            mode = selectedValue;
            
            await i.reply({
              content: `you chose: **${selectedValue}**`,
              flags: MessageFlags.Ephemeral
            });
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
                .setPlaceholder('Number only!...')
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
                .setPlaceholder('Number only!...')
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

              let symbolText = '';
              let amountText = '';

              if (assetType === 'gold') {
                symbolText = 'GOLD';
                amountText = modalSubmit.fields.getTextInputValue('amount_input_text');
              } else {
                symbolText = modalSubmit.fields.getTextInputValue('symbol_input_text');
                amountText = modalSubmit.fields.getTextInputValue('amount_input_text');
              }

              await modalSubmit.reply({
                content: `${symbolText}, ${amountText}`,
                flags: MessageFlags.Ephemeral
              });

              if (assetType === 'stock' || assetType === 'etf') {
                const quote = await yahooFinance.quote(symbolText.toUpperCase());
                console.log(quote);
                // ? Check if quote exist and listed in US market
                if (!quote) {
                  assetSymbol = symbolText.toUpperCase();
                  collector.stop('ticker_invalid');
                  return;
                }
                else if (quote.market !== 'us_market') {
                  assetSymbol = symbolText.toUpperCase();
                  collector.stop('not_usa');
                  return;
                }

                let quoteType1 = quote.quoteType.toUpperCase();
                quoteType1 = quoteType1 === 'EQUITY' ? 'STOCK' : quoteType1; // Normalize to STOCK

                if (quoteType1 !== assetType.toUpperCase()) {
                  assetSymbol = symbolText.toUpperCase();
                  if (assetType === 'stock') {
                    collector.stop('is_etf');
                  } else {
                    collector.stop('is_stock');
                  }

                  return;
                }
                
                assetSymbol = symbolText.toUpperCase();
                amount = amountText;
              }

              if (isNaN(amountText)) {
                collector.stop('int_invalid');
              } else {
                collector.stop('done');
              }

            } catch (modalError) {
              console.log('Modal timeout หรือถูกปิดไปโดยไม่ได้ส่งข้อมูล');
            }
          }
        });

        // collector end after 1 min
        collector.on('end', async (collected, reason) => {
          const collectContainer = new ContainerBuilder();
          console.log(reason); // TODO continue to buy

          let titleText = '';
          let descText = '';
          let gifURL = '';
          let color = 0xDC143C; // default crimson

          if (reason === 'ticker_invalid') {
            titleText = ':pencil: Type Error!';
            descText = `Ticker **${assetSymbol}** not found! Please check your input`;
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
            titleText = ':receipt: Contract Expired!';
            descText = 'You need to fill in all information within **1 minute**';
            gifURL = `https://raw.githubusercontent.com/JaKKrit2006/FinanceBotDiscordRebuild/refs/heads/main/src/bin/yomiGif/yomi_sad${randomIndex}.gif`;
          }

          // ! crate container
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
          
        });

      /*
      // user id
      const query = { userId: interaction.user.id }
      const data = await portData.findOne(query);

      // if no data
      if (!data) {
        await interaction.editReply(`<@${interaction.user.id}> Sorry, You need to create portfolio first.`);
        return;
      }

      const userMoney = data.balance.money.cash;
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
      */
    }

    catch (error) {
      console.log(error);
      await interaction.editReply(`Error Code: ${error}`);
      return;
    }
  }
}