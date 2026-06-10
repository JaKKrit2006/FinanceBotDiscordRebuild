const { ApplicationCommandOptionType, EmbedBuilder, EmbedAssertions,ContainerBuilder,
  TextDisplayBuilder, SeparatorBuilder, ButtonBuilder, ButtonStyle, SectionBuilder,
  MessageFlags, SeparatorSpacingSize, AttachmentBuilder, FileBuilder, MediaGalleryBuilder,
  MediaGalleryItemBuilder, ThumbnailBuilder,  ActionRowBuilder, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
 } = require('discord.js');
const dayjs = require('dayjs');

// database
const portData = require('../../models/portfolioUserData');

// yahoo
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// Coingecko Web API
const fs = require('fs');
const path = require('path');
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const COINGECKO_BASE_URL = "https://api.coingecko.com/api/v3";


function sellByVolume_FIFO(array, targetSymbol, volumeToRemove) {
  let remainingVolumeTarget = volumeToRemove;

  array.sort((a, b) => new Date(a.date) - new Date(b.date));

  for (let i = 0; i < array.length; i++) {
    if (remainingVolumeTarget <= 0) break;

    if (array[i].symbol === targetSymbol) {
      let currentLotVolume = array[i].volume;
      let currentLotCost = array[i].cost;

      if (remainingVolumeTarget >= currentLotVolume) {
        remainingVolumeTarget = parseFloat((remainingVolumeTarget - currentLotVolume).toFixed(7));
        array[i].volume = 0;
        array[i].cost = 0;
      } else {
        let costToRemove = currentLotCost * (remainingVolumeTarget / currentLotVolume);

        array[i].volume = parseFloat((currentLotVolume - remainingVolumeTarget).toFixed(7));
        array[i].cost = parseFloat((currentLotCost - costToRemove).toFixed(4));

        remainingVolumeTarget = 0;
      }
    }
  }

  return array.filter(item => item.volume > 0);
}

async function getPriceOrName({symbol, assetType, fecthName=false}) {
  let price = 0;
  let shortName = '';
  
  if (assetType === 'stock' || assetType === 'etf') {
    const quote = await yahooFinance.quote(symbol);
    price = quote.regularMarketPrice;
    shortName = quote.shortName;
  }
  
  else if (assetType === 'crypto') {
    const quote = await yahooFinance.quote(`${symbol}-USD`);
    price = quote.regularMarketPrice;
    shortName = quote.shortName;
  }

  else {
    const quote = await yahooFinance.quote(`GC=F`);
    price = quote.regularMarketPrice;
    shortName = quote.shortName;
  }

  if (fecthName) return shortName;
  return price;
}


async function createErrorContainer({ interaction, titleText, descText }) {
  const container = new ContainerBuilder()
    .setAccentColor(0xDC143C) // Crimson
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents( new TextDisplayBuilder()
          .setContent(`## ${titleText}\n:x: <@${interaction.user.id}> ${descText}\n- Thank you for your attention`)
        )
        .setThumbnailAccessory( new ThumbnailBuilder()
          .setURL('https://raw.githubusercontent.com/JaKKrit2006/FinanceBotDiscordRebuild/refs/heads/main/src/bin/yomiGif/yomi_sad1.gif')
        )
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



module.exports = {
  name: 'sell',
  description: 'Sell assets with market price.',
  // devOnly: Boolean,
  // testOnly: true,
  deleted: false,

  callback: async(client, interaction) => {
    await interaction.deferReply();

    // ? Global variable
    let assetType = '';
    let assetSymbol = '';
    let mode = '';

    // ? Asset Data
    let shortName = '';
    let marketPrice = 0;
    let sellVolume = 0;
    let sellCost = 0;
    let sellAll = false;
    let fee = 0;
    let logoURL = '';

    // ! Database declare ------------------------------------------------------------------------------
    const query = { userId: interaction.user.id }
    let data = await portData.findOne(query);

    if (!data) {
      return await interaction.editReply(`<@${interaction.user.id}> Sorry, You need to create portfolio first.`);
    }

    const assetObject  = data.balance.assets;
    const isAllEmpty   = Object.values(assetObject).every(arr => arr.length === 0);
    const activeAssets = Object.keys(assetObject).filter(key => assetObject[key].length > 0);
    
    if (isAllEmpty) {
      return await interaction.editReply(`<@${interaction.user.id}> Sorry, You don't have any assets.`);
    }
    
    let selectAsset = []; // [ {label:, description:, value:, emoji:} ]
    for (const item of activeAssets) {
      let arrayObj = {};

      if (item === 'stock') {
        arrayObj = { label:'Stock', description: 'USA Stock', value: 'stock',  emoji: '📈'};
        selectAsset.push(arrayObj);
      } else if (item === 'etf') {
        arrayObj = { label:'ETF', description: 'ETF in USA market', value: 'etf',  emoji: '🏦'};
        selectAsset.push(arrayObj);
      } else if (item === 'crypto') {
        arrayObj = { label: 'Crypto', description: `There's only Top 50 coins`, value: 'crypto', emoji: '💎'};
        selectAsset.push(arrayObj);
      } else {
        arrayObj = { label: 'Gold',   description: 'Gold future only',          value: 'gold',   emoji: '🪙'};
        selectAsset.push(arrayObj);
      }
    }
    // ! -----------------------------------------------------------------------------------------------

    try {

      // ? First Container ------------------------------------------------------
      const selectRow1 = new StringSelectMenuBuilder()
        .setCustomId('assets_select')
        .setPlaceholder('Select assets type...')
        .addOptions(selectAsset);

      const containerMain = new ContainerBuilder()
        .setAccentColor(0xD2042D)
        .addSectionComponents(
          new SectionBuilder()
            .addTextDisplayComponents( new TextDisplayBuilder()
              .setContent(`## :receipt: Order Selling Assets!\nSelect an assets type and what asset you want to sell`
                + `\n- **This message will appear for 1 minute!**`
              )
            )
            .setThumbnailAccessory( new ThumbnailBuilder()
              .setURL('https://raw.githubusercontent.com/JaKKrit2006/FinanceBotDiscordRebuild/refs/heads/main/src/bin/yomiGif/yomi_happy1.gif')
            )
        )
        .addSeparatorComponents( new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))

        .addTextDisplayComponents( new TextDisplayBuilder().setContent(`## :bar_chart: Assets Type`))
        .addActionRowComponents( new ActionRowBuilder().addComponents(selectRow1))

        .addTextDisplayComponents( new TextDisplayBuilder().setContent(`-# Please select options above to continue\n`))

        .addSeparatorComponents( new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
          .addTextDisplayComponents( new TextDisplayBuilder()
            .setContent(`-# Request by ${interaction.user.username}`)
        )
      // ? -----------------------------------------------------------------------

      const menu1 = await interaction.editReply({
        components: [ containerMain ],
        flags: MessageFlags.IsComponentsV2
      });

      // ! collector zone
      const filter = (i) => true; //i.user.id === interaction.user.id;
      const collector = menu1.createMessageComponentCollector({ filter, time: 60000 });

      collector.on('collect', async (i) => {
        if (i.user.id !== interaction.user.id) {
          await i.reply({ content: `Sorry, This's not your menu!`, flags: MessageFlags.Ephemeral });
          return;
        }

        // ! Select Menu
        // ? Assets Select Menu
        if (i.customId === 'assets_select') {
          assetType = i.values[0];
          await i.deferUpdate();

          collector.stop('done');
        }
      });

      collector.on('end', async (collected, reason) => {
        if (reason === 'time') {
          createErrorContainer({
            interaction: interaction,
            titleText: `📄 Order Expired!`,
            descText: `You need to fill up all info in **1 minute**`
          });
        }

        let symbolOptions = [];
        const assetArray = assetObject[assetType];

        const mergeArray = Object.values(assetArray.reduce((acc, item) => {
          const key = item.symbol;

          if (!acc[key]) {
            acc[key] = {
              symbol: item.symbol,
              volume: 0,
              cost: 0,
              logoURL: item.logoURL
            };
          }
          acc[key].volume += item.volume;
          acc[key].cost += item.cost;

          return acc;
        }, {}));

        for (const item of mergeArray) {
          const obj = { label: item.symbol, description: `Cost: $${item.cost.toFixed(2)}, Volume: ${item.volume.toFixed(7)}`, value: item.symbol};
          symbolOptions.push(obj);
        }


        // ? Second Container ------------------------------------------------------------
        const selectRow1 = new StringSelectMenuBuilder()
          .setCustomId('symbol_select')
          .setPlaceholder('Select asset...')
          .addOptions(symbolOptions);

        const selectMode = new StringSelectMenuBuilder()
          .setCustomId('mode_select')
          .setPlaceholder('Select Mode...')
          .addOptions([
            { label: 'Cost',   description: 'Amount of money (At least $5/All)', value: 'cost', emoji: '💰' },
            { label: 'Volume', description: 'Share quantity (Manual/All)', value: 'volume', emoji: '⚖️' },
          ]);

        const openModalBtn = new ButtonBuilder()
          .setCustomId('open_modal_btn')
          .setLabel('Fill in Information!')
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📝');

        const containerSub = new ContainerBuilder()
          .setAccentColor(0xD2042D)
          .addSectionComponents(
            new SectionBuilder()
              .addTextDisplayComponents( new TextDisplayBuilder()
                .setContent(`## :receipt: Selling ${assetType.toUpperCase()}!\nSelect what asset you want to sell`
                  + `\n- **This message will appear for 1 minute!**`
                )
              )
              .setThumbnailAccessory( new ThumbnailBuilder()
                .setURL('https://raw.githubusercontent.com/JaKKrit2006/FinanceBotDiscordRebuild/refs/heads/main/src/bin/yomiGif/yomi_happy2.gif')
              )
          )
          .addSeparatorComponents( new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Large))

          .addTextDisplayComponents( new TextDisplayBuilder().setContent(`## :bar_chart: Assets in your inventory`))
          .addActionRowComponents( new ActionRowBuilder().addComponents(selectRow1))
          .addTextDisplayComponents( new TextDisplayBuilder().setContent(`## :shopping_cart: Mode`))
          .addActionRowComponents( new ActionRowBuilder().addComponents(selectMode))
          .addTextDisplayComponents( new TextDisplayBuilder().setContent(`-# Please select options above to continue\n`))
          .addActionRowComponents(new ActionRowBuilder().addComponents(openModalBtn))

          .addSeparatorComponents( new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
            .addTextDisplayComponents( new TextDisplayBuilder()
              .setContent(`-# Replied by Yomi`)
          )
        // ? ---------------------------------------------------------------------------

        const menu2 = await interaction.editReply({
          components: [ containerSub ],
          flags: MessageFlags.IsComponentsV2
        });

        // ! collector zone
        const filter1 = (i) => true; //i.user.id === interaction.user.id;
        const collector1 = menu2.createMessageComponentCollector({ filter: filter1, time: 60000 });

        collector1.on('collect', async (i) => {
          if (i.user.id !== interaction.user.id) {
            await i.reply({ content: `Sorry, This's not your menu!`, flags: MessageFlags.Ephemeral });
            return;
          }

          // ! Select Menu
          if (i.customId === 'symbol_select') {
            assetSymbol = i.values[0];
            await i.deferUpdate();
          }
          if (i.customId === 'mode_select') {
            mode = i.values[0];
            await i.deferUpdate();
          }

          // ! Modal
          if (i.customId === 'open_modal_btn') {
            if (!assetType || !mode) {
              await i.reply({ content: 'Please select both options first!', flags: MessageFlags.Ephemeral });
              return;
            }

            const amountInput = new TextInputBuilder()
              .setCustomId('amount_input_text')
              .setLabel(`Amount`)
              .setStyle(TextInputStyle.Short)
              .setPlaceholder(`Number or Type All`)
              .setRequired(true);

            const modal = new ModalBuilder()
              .setCustomId('modal_form')
              .setTitle("Asset's details");

            const createdModal = modal.addComponents(new ActionRowBuilder().addComponents(amountInput));

            await i.showModal(createdModal);

            try {
              const modalSubmit = await i.awaitModalSubmit({
                filter: (m) => m.customId === 'modal_form' && m.user.id === interaction.user.id,
                time: 60000,
              });
              await modalSubmit.deferUpdate();

              // Code Here
              let amountText = modalSubmit.fields.getTextInputValue('amount_input_text');
              
              if (amountText.toUpperCase() === 'ALL') {
                sellAll = true;
              }
              else if (isNaN(amountText)) {
                return collector1.stop('integer_invalid');
              }
              else if (amountText < 5 && mode === 'cost') {
                return collector1.stop('limit');
              }
              else if (amountText < 1 && mode === 'volume') {
                return collector1.stop('limit');
              }

              amountText = Number(amountText);
              marketPrice = await getPriceOrName({symbol: assetSymbol, assetType: assetType});
              shortName = await getPriceOrName({symbol: assetSymbol, assetType: assetType, fecthName: true});

              const symbolArray = assetObject[assetType];
              const filtered = symbolArray.filter(item => item.symbol === assetSymbol);
              const choosenObj = filtered.reduce((acc, item) => {
                return {
                  symbol: assetSymbol,
                  volume: acc.volume + item.volume,
                  cost: acc.cost + item.cost
                };
              }, { volume: 0, cost: 0 });

              if (mode === 'cost') {
                sellVolume = parseFloat((amountText / marketPrice).toFixed(7));
                sellCost = Math.round(amountText * 100) / 100;

                if (sellVolume > choosenObj.volume || sellAll) {
                  sellAll = true;
                  sellCost = Math.round(marketPrice * choosenObj.volume * 100) / 100;
                  sellVolume = choosenObj.volume;
                }
              }
              
              else {
                sellCost = Math.round(marketPrice * amountText * 100) / 100;
                sellVolume = parseFloat(amountText.toFixed(7));

                if (amountText > choosenObj.volume || sellAll) {
                  sellAll = true;
                  sellVolume = choosenObj.volume;
                  sellCost = Math.round(marketPrice * choosenObj.volume * 100) / 100;
                }
              }

              fee = Math.round(sellCost * 0.0025 * 100) / 100;
              sellCost = Math.round((sellCost - fee) * 100) / 100;
              collector1.stop('done');
            }
            catch (error) {
              console.log(`Modal did not receive any thing or it error ${error}`);
            }
          }

        });

        collector1.on('end', async (collected, reason) => {
          if (reason === 'time') {
            return createErrorContainer({
              interaction: interaction,
              titleText: `📄 Order Expired!`,
              descText: `You need to fill up all info in **1 minute**`
            });
          } else if (reason === 'integer_invalid') {
            return createErrorContainer({
              interaction: interaction,
              titleText: `📄 Integer Invalid!`,
              descText: `Amount should be an **Integer** or **'All'**`
            });
          } else if (reason === 'limit') {
            return createErrorContainer({
              interaction: interaction,
              titleText: `📄 Type Error!`,
              descText: `Amount should at least **$5 or 1 Shares/Coin/Oz** if you want to sell less than this use **'ALL'**`
            });
          }

          const filtered = assetObject[assetType].filter(item => item.symbol === assetSymbol);
          logoURL = filtered[0].logoURL;
          const money = data.balance.money.cash;

          const summary = new ContainerBuilder()
            .setAccentColor(0xD2042D)
            .addSectionComponents(
              new SectionBuilder()
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(`## :white_check_mark: Order Verified! -> (Sell)\nAsset: **${assetType.toUpperCase()}** Mode: **${mode.toUpperCase()}**`)
                )
                .setThumbnailAccessory(
                  new ThumbnailBuilder().setURL(logoURL)
                )
            )
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`## :page_facing_up: Details\n- Name: **${shortName}**\n- Symbol: **${assetSymbol}**\n- Price: **$${marketPrice}**\n- Volume: **${sellVolume}** ${sellAll ? '**__(All)__**' : ''}`)
            )
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(`## :shopping_cart: You get\n- Fee: **${fee}** (0.25%)\n- :dollar: **__$${sellCost}__** (Including Fee)`)
            )
            .addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small))
            .addSectionComponents(
              new SectionBuilder()
                .addTextDisplayComponents(
                  new TextDisplayBuilder().setContent(`## :identification_card: User's Profile\n- Wallet: **$${money.toFixed(2)}**`)
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
                    .setLabel(`Sell $${sellCost}`)
                    .setCustomId('confirm_sell')
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
          
          const menu3 = await interaction.editReply({
            components: [ summary ],
            flags: MessageFlags.IsComponentsV2
          });

          // ! collector zone
          const filter2 = (i) => true; //i.user.id === interaction.user.id;
          const collector2 = menu3.createMessageComponentCollector({ filter: filter2, time: 60000 });

          collector2.on('collect', async (i) => {
            if (i.user.id !== interaction.user.id) {
              await i.reply({ content: `Sorry, This's not your menu!`, flags: MessageFlags.Ephemeral });
              return;
            }

            // ! Select Menu
            if (i.customId === 'confirm_sell') {
              await i.deferUpdate();

              const payloadData = sellByVolume_FIFO(assetObject[assetType], assetSymbol, sellVolume);
              const money = data.balance.money.cash;

              const txnData = {
                symbol: assetSymbol,
                volume: Number(sellVolume),
                cost: Number(sellCost),
                date: new Date(), // ? UTC TIME
                logoURL: logoURL,
                type: 'sell',
                assetType: assetType,
              };

              await portData.updateOne(query, {
                $push : {
                ['transaction']: txnData
              }})
              await portData.updateOne(query, {
                $set : {
                [`balance.assets.${assetType.toLowerCase()}`]: payloadData,
                'balance.money.cash': Math.round((money + sellCost) * 100) / 100
              }})

              collector2.stop('done');
            }
            if (i.customId === 'cancel_purchase') {
              await i.deferUpdate();
              collector2.stop('cancel');
            }
          });

          collector2.on('end', async (collected, reason) => {
            if (reason === 'time') {
              return createErrorContainer({
                interaction: interaction,
                titleText: `📄 Order Expired!`,
                descText: `You need to fill up all info in **1 minute**`
              });
            } else if (reason === 'cancel') {
              return createErrorContainer({
                interaction: interaction,
                titleText: `📄 Canceled Order!`,
                descText: `You just **canceled** the order`
              });
            }

            const container = new ContainerBuilder()
              .setAccentColor(0xD2042D)
              .addSectionComponents(
                new SectionBuilder()
                  .addTextDisplayComponents( new TextDisplayBuilder().setContent(`## :receipt: Sell Order Placed!\n- Asset: **${assetType.toUpperCase()}**\n- Symbol: **${assetSymbol}**\n- Sell Price: **$${marketPrice}**`
                    + `\n- Volume: **${sellVolume}**\n- Date: **${dayjs().format('hh:mm A, ddd D MMM YYYY')} ICT**\n- Value: :dollar: **__$${sellCost}__**`))
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

          });
        });
      });
    }

    catch (error) {
      await interaction.editReply(`Error code: ${error}`);
      console.log(error);
      return;
    }

  }
}