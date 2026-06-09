const {
  ApplicationCommandOptionType,
  ContainerBuilder, TextDisplayBuilder, SeparatorBuilder,
  ButtonBuilder, ButtonStyle, SectionBuilder,
  MessageFlags, SeparatorSpacingSize,
  ActionRowBuilder, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  ThumbnailBuilder,
} = require('discord.js');

const axios    = require('axios');
const util     = require('util');
const dayjs    = require('dayjs');
const fs       = require('fs');
const path     = require('path');
const finnhub  = require('finnhub');

// Database
const portData = require('../../models/portfolioUserData');

// Yahoo Finance
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// Finnhub
const finnhubClient = new finnhub.DefaultApi(process.env.FINNHUB_API);
const getCompanyProfile = util.promisify(finnhubClient.companyProfile2).bind(finnhubClient);

// Env vars
const LOGO_API_KEY      = process.env.LOGO_API_KEY;
const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const COINGECKO_BASE    = 'https://api.coingecko.com/api/v3';

// GIF base URL shorthand
const GIF = 'https://raw.githubusercontent.com/JaKKrit2006/FinanceBotDiscordRebuild/refs/heads/main/src/bin/yomiGif';

// ─── Helpers ────────────────────────────────────────────────────────────────

const footer  = () => new TextDisplayBuilder().setContent('-# Replied by Yomi');
const sep     = (size = SeparatorSpacingSize.Small) => new SeparatorBuilder().setSpacing(size);
const text    = (content) => new TextDisplayBuilder().setContent(content);
const thumb   = (url) => new ThumbnailBuilder().setURL(url);

function getUniqueSymbols(arr) {
  return [...new Set(arr.map(item => item.symbol))];
}

// ─── UI Builders ────────────────────────────────────────────────────────────

function buildOrderForm(username) {
  const select = new StringSelectMenuBuilder()
    .setCustomId('assets_select')
    .setPlaceholder('Select assets type...')
    .addOptions([
      { label: 'Stock',  description: 'USA Stock',                  value: 'stock',  emoji: '📈' },
      { label: 'ETF',    description: 'ETF in USA market',          value: 'etf',    emoji: '🏦' },
      { label: 'Crypto', description: "There's only Top 50 coins",  value: 'crypto', emoji: '💎' },
      { label: 'Gold',   description: 'Gold future only',           value: 'gold',   emoji: '🪙' },
    ]);

  const selectMode = new StringSelectMenuBuilder()
    .setCustomId('mode_select')
    .setPlaceholder('Select Mode...')
    .addOptions([
      { label: 'Cost',   description: 'Amount of money (At least 5$)',               value: 'cost',   emoji: '💰' },
      { label: 'Volume', description: 'Share quantity (At least 1 Share/Coin/Oz)',   value: 'volume', emoji: '⚖️' },
    ]);

  const openModalBtn = new ButtonBuilder()
    .setCustomId('open_modal_btn')
    .setLabel('Fill in Information!')
    .setStyle(ButtonStyle.Primary)
    .setEmoji('📝');

  return new ContainerBuilder()
    .setAccentColor(0x32CD32)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(text(
          '## :receipt: Order Buying Assets!\nSelect an asset type and mode, then fill in your Order details below'
          + '\n- **This message will appear for 1 minute!**'
        ))
        .setThumbnailAccessory(thumb(`${GIF}/yomi_happy1.gif`))
    )
    .addSeparatorComponents(sep(SeparatorSpacingSize.Large))
    .addTextDisplayComponents(text('## :bar_chart: Assets'))
    .addActionRowComponents(new ActionRowBuilder().addComponents(select))
    .addTextDisplayComponents(text('## :shopping_cart: Mode'))
    .addActionRowComponents(new ActionRowBuilder().addComponents(selectMode))
    .addTextDisplayComponents(text('-# Please select both options above before continuing!\n'))
    .addActionRowComponents(new ActionRowBuilder().addComponents(openModalBtn))
    .addSeparatorComponents(sep())
    .addTextDisplayComponents(text(`-# Request by ${username}`));
}

function buildModalForm(assetType, mode) {
  const amountLabel = mode === 'volume' ? 'Quantity' : 'Amount';

  const amountInput = new TextInputBuilder()
    .setCustomId('amount_input_text')
    .setLabel(amountLabel)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Number only...')
    .setRequired(true);

  const modal = new ModalBuilder()
    .setCustomId('modal_form')
    .setTitle("Asset's details");

  if (assetType === 'gold') {
    modal.addComponents(new ActionRowBuilder().addComponents(amountInput));
  } else {
    const symbolInput = new TextInputBuilder()
      .setCustomId('symbol_input_text')
      .setLabel('Ticker or Symbol of Asset')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Ex. NVDA, META, BTC, ETH...')
      .setRequired(true);

    modal.addComponents(
      new ActionRowBuilder().addComponents(symbolInput),
      new ActionRowBuilder().addComponents(amountInput),
    );
  }

  return modal;
}

function buildBuyOrderSummary({ color, assetType, mode, assetSymbol, marketPrice, shortName, logoURL, textDetail, fee, totalCostWithFee, interaction, amountInv, money }) {
  const avatarURL = interaction.user.displayAvatarURL({ extension: 'png', size: 512 });

  return new ContainerBuilder()
    .setAccentColor(color)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(text(
          `## :white_check_mark: Order Verified!\nAsset: **${assetType.toUpperCase()}** Mode: **${mode.toUpperCase()}**`
        ))
        .setThumbnailAccessory(thumb(logoURL))
    )
    .addSeparatorComponents(sep())
    .addTextDisplayComponents(text(
      `## :page_facing_up: Details\n- Name: **${shortName}**\n- Symbol: **${assetSymbol}**\n- Price: **${marketPrice}$**${textDetail}\n`
    ))
    .addTextDisplayComponents(text(
      `## :shopping_cart: Total Cost\n- Fee: **${fee}** (0.25%)\n- :dollar: **__${totalCostWithFee}$__** (Including Fee)`
    ))
    .addSeparatorComponents(sep())
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(text(
          `## :identification_card: User's Profile\n- Wallet: **${money}$**\n- Inventory: **${amountInv}/10**`
        ))
        .setThumbnailAccessory(thumb(avatarURL))
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setStyle(ButtonStyle.Primary)
          .setLabel(`Buy ${totalCostWithFee}$`)
          .setCustomId('confirm_purchase'),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Secondary)
          .setLabel('Cancel')
          .setCustomId('cancel_purchase'),
      )
    )
    .addTextDisplayComponents(text('-# Please confirm your purchase within 1 minute!'))
    .addSeparatorComponents(sep())
    .addTextDisplayComponents(footer());
}

function buildErrorContainer(collectContainer, { color, titleText, descText, gifURL, userId }) {
  return collectContainer
    .setAccentColor(color)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(text(
          `## ${titleText}\n:x: <@${userId}> ${descText}, Please try again\n- Thank you for your attention`
        ))
        .setThumbnailAccessory(thumb(gifURL || `${GIF}/yomi_idle1.gif`))
    )
    .addSeparatorComponents(sep())
    .addTextDisplayComponents(footer());
}

function buildSuccessContainer({ assetType, assetSymbol, marketPrice, volume, totalCostWithFee, interaction }) {
  const avatarURL = interaction.user.displayAvatarURL({ extension: 'png', size: 512 });
  const dateStr   = dayjs().format('hh:mm A, ddd D MMM YYYY');

  return new ContainerBuilder()
    .setAccentColor(0x32CD32)
    .addSectionComponents(
      new SectionBuilder()
        .addTextDisplayComponents(text(
          `## :receipt: Order Placed!\n- Asset: **${assetType.toUpperCase()}**\n- Symbol: **${assetSymbol}**\n- Entry Price: **${marketPrice}$**`
          + `\n- Volume: **${volume}**\n- Date: **${dateStr} (GMT+7)**\n- Value: :dollar: **__${totalCostWithFee}$__**`
        ))
        .setThumbnailAccessory(thumb(avatarURL))
    )
    .addSeparatorComponents(sep())
    .addTextDisplayComponents(footer());
}

// ─── Asset Fetchers ──────────────────────────────────────────────────────────

async function fetchStockOrEtf(symbol) {
  const quote = await yahooFinance.quote(symbol);
  if (!quote)                    return { error: 'ticker_invalid' };
  if (quote.market !== 'us_market') return { error: 'not_usa' };

  const quoteType = quote.quoteType.toUpperCase() === 'EQUITY' ? 'STOCK' : quote.quoteType.toUpperCase();
  return { quote, quoteType };
}

async function fetchCrypto(assetSymbol) {
  const allCoinPath = path.join(__dirname, '..', '..', '..', 'allcoin.json');
  const allCoin     = JSON.parse(fs.readFileSync(allCoinPath, 'utf-8'));

  const coinMatch = allCoin.find(c =>
    c.name.toUpperCase()   === assetSymbol ||
    c.id.toUpperCase()     === assetSymbol ||
    c.symbol.toUpperCase() === assetSymbol
  );
  if (!coinMatch) return { error: 'ticker_invalid' };

  const { data } = await axios.get(`${COINGECKO_BASE}/coins/${coinMatch.id}`, {
    headers: { 'x-cg-demo-api-key': COINGECKO_API_KEY },
  });

  const isStable = data.categories?.some(cat => cat.toLowerCase().includes('stablecoin'));
  if (isStable) return { error: 'stable_coin' };

  return { coinData: data, coinMatch };
}

// ─── Text Detail Builder ─────────────────────────────────────────────────────

function buildTextDetail(mode, assetType, amount, volume) {
  const unitMap = {
    stock: 'Shares', etf: 'Shares',
    crypto: 'Coins', gold: 'Oz',
  };
  const unit = unitMap[assetType] || '';

  if (mode === 'cost') {
    return `\n- Amount: **${amount}$**\n- Volume: **${volume}** ${unit}`;
  }
  return `\n- Volume: **${amount}** ${unit}`;
}

// ─── Error Map ───────────────────────────────────────────────────────────────

function getErrorInfo(reason, assetSymbol, assetType, money, totalCostWithFee) {
  const blank1 = `${GIF}/yomi_blank1.gif`;
  const blank2 = `${GIF}/yomi_blank2.gif`;

  const errorMap = {
    ticker_invalid:   { title: ':pencil: Type Error!',        desc: `Ticker **${assetSymbol}** not found! Please check your input`,                                  gif: blank2 },
    inventory_limit:  { title: ':pencil: Inventory Limit!',   desc: `**${assetType.toUpperCase()}** inventory is full — sell or remove some assets`,                 gif: blank2 },
    stable_coin:      { title: ':pencil: Input Error!',       desc: `Coin **${assetSymbol}** is a Stable Coin, not allowed in this Order`,                           gif: blank2 },
    not_usa:          { title: ':flag_us: Market Error!',     desc: `Ticker **${assetSymbol}** is not listed on the US market`,                                      gif: blank2 },
    int_invalid:      { title: ':pencil: Type Error!',        desc: 'Amount input should be an **Integer!**',                                                        gif: blank1 },
    amount_too_low:   { title: ':pencil: Value Error!',       desc: 'Amount Mode must be at least **5$**',                                                           gif: blank1 },
    volume_too_low:   { title: ':pencil: Value Error!',       desc: 'Volume Mode must be at least **1 Share/Coin/Oz**',                                              gif: blank1 },
    is_etf:           { title: ':pencil: Input Error!',       desc: `Ticker **${assetSymbol}** is an ETF, not a stock`,                                             gif: blank2, color: 0xF4BB44 },
    is_stock:         { title: ':pencil: Input Error!',       desc: `Ticker **${assetSymbol}** is a stock, not an ETF`,                                             gif: blank1, color: 0xF4BB44 },
    negative_money:   { title: ':receipt: Negative Money!',   desc: `Your money **($${money})** is not enough to buy **${assetSymbol} ($${totalCostWithFee})**`,     gif: `${GIF}/yomi_sad2.gif` },
    cancel:           { title: ':receipt: Cancel Order!',     desc: 'You just **canceled** the Order!',                                                              gif: `${GIF}/yomi_sad3.gif` },
    time:             { title: ':receipt: Order Expired!',    desc: 'You need to confirm within **1 minute**, Please try again',                                     gif: `${GIF}/yomi_sad1.gif` },
  };

  if (reason === 'time' && !errorMap.time.gif.includes('sad')) {
    const rand = Math.floor(Math.random() * 3) + 1;
    errorMap.time.gif = `${GIF}/yomi_sad${rand}.gif`;
  }

  return errorMap[reason] || null;
}

// ─── Main Command ────────────────────────────────────────────────────────────

module.exports = {
  name: 'buy',
  description: 'Buy assets (stock, crypto, gold) with market price.',
  deleted: false,

  callback: async (client, interaction) => {
    await interaction.deferReply();

    const query = { userId: interaction.user.id };
    const data  = await portData.findOne(query);
    if (!data) {
      await interaction.editReply(`<@${interaction.user.id}> Sorry, you need to create a portfolio first.`);
      return;
    }

    // State variables
    let assetType  = '';
    let mode       = '';
    let assetSymbol = '';
    let amount     = '';
    let amountInv  = 0;
    let marketPrice = '';
    let shortName  = '';
    let logoURL    = '';

    try {
      // ── Step 1: Show order form ──────────────────────────────────────────
      const orderForm = buildOrderForm(interaction.user.username);
      const replyForm = await interaction.editReply({
        components: [orderForm],
        flags: MessageFlags.IsComponentsV2,
      });

      const collector = replyForm.createMessageComponentCollector({
        filter: () => true,
        time: 60000,
      });

      collector.on('collect', async (i) => {
        if (i.user.id !== interaction.user.id) {
          await i.reply({ content: "Sorry, this isn't your menu!", flags: MessageFlags.Ephemeral });
          return;
        }

        if (i.customId === 'assets_select') {
          assetType = i.values[0];
          await i.deferUpdate();
          return;
        }

        if (i.customId === 'mode_select') {
          mode = i.values[0];
          await i.deferUpdate();
          return;
        }

        // ── Step 2: Open modal ─────────────────────────────────────────────
        if (i.customId === 'open_modal_btn') {
          if (!assetType || !mode) {
            await i.reply({ content: 'Please select both options first!', flags: MessageFlags.Ephemeral });
            return;
          }

          await i.showModal(buildModalForm(assetType, mode));

          try {
            const modalSubmit = await i.awaitModalSubmit({
              filter: (m) => m.customId === 'modal_form' && m.user.id === interaction.user.id,
              time: 60000,
            });
            await modalSubmit.deferUpdate();

            // Parse modal inputs
            const symbolText = assetType === 'gold'
              ? 'GOLD'
              : modalSubmit.fields.getTextInputValue('symbol_input_text');
            const amountText = modalSubmit.fields.getTextInputValue('amount_input_text');

            assetSymbol = symbolText.toUpperCase();

            // Reload user data
            const upData     = await portData.findOne(query);
            const assetArray = upData.balance.assets;
            const money_cash = upData.balance.money.cash;

            // ── Step 3: Validate inventory ───────────────────────────────────
            const inventoryTypeMap = {
              stock: assetArray.stock,
              etf:   assetArray.etf,
            };

            if (inventoryTypeMap[assetType]) {
              const unique = getUniqueSymbols(inventoryTypeMap[assetType]);
              amountInv = unique.length;
              if (unique.length >= 10 && !unique.includes(assetSymbol)) {
                collector.stop('inventory_limit');
                return;
              }
            }

            // ── Step 4: Fetch asset data ─────────────────────────────────────
            if (assetType === 'stock' || assetType === 'etf') {
              const result = await fetchStockOrEtf(symbolText);
              if (result.error) { collector.stop(result.error); return; }

              const { quote, quoteType } = result;

              if (quoteType !== assetType.toUpperCase()) {
                collector.stop(assetType === 'stock' ? 'is_etf' : 'is_stock');
                return;
              }

              marketPrice = quote.regularMarketPrice;
              shortName   = quote.shortName;
              logoURL     = `https://img.logo.dev/ticker/${assetSymbol}?token=${LOGO_API_KEY}&retina=true`;
              amount      = Number(amountText);

            } else if (assetType === 'crypto') {
              const result = await fetchCrypto(assetSymbol);
              if (result.error) { collector.stop(result.error); return; }

              const { coinData, coinMatch } = result;
              const unique = getUniqueSymbols(assetArray.crypto);
              amountInv   = unique.length;

              if (unique.length >= 10 && !unique.includes(coinMatch.symbol.toUpperCase())) {
                collector.stop('inventory_limit');
                return;
              }

              assetSymbol = coinMatch.symbol.toUpperCase();
              shortName   = coinData.name;
              marketPrice = coinData.market_data.current_price.usd;
              logoURL     = coinData.image.large;
              amount      = Number(amountText);

            } else if (assetType === 'gold') {
              const quote = await yahooFinance.quote('GC=F');
              shortName   = quote.shortName;
              marketPrice = quote.regularMarketPrice;
              logoURL     = 'https://raw.githubusercontent.com/JaKKrit2006/icon/refs/heads/main/pngtree-a-pile-of-gold-bars-png-image_13244472.png';
              amount      = Number(amountText);
              amountInv   = '-';
            }

            // ── Step 5: Validate amount ──────────────────────────────────────
            if      (isNaN(amountText))                              collector.stop('int_invalid');
            else if (Number(amountText) < 5  && mode === 'cost')     collector.stop('amount_too_low');
            else if (Number(amountText) < 1  && mode === 'volume')   collector.stop('volume_too_low');
            else                                                      collector.stop('done');

          } catch (modalError) {
            console.log(modalError);
          }
        }
      });

      // ── Step 6: Handle collector end ────────────────────────────────────
      collector.on('end', async (collected, reason) => {
        const collectContainer = new ContainerBuilder();

        if (reason === 'done') {
          const volume          = mode === 'cost' ? (amount / marketPrice).toFixed(7) : amount;
          const totalCost       = mode === 'cost' ? amount : (volume * marketPrice).toFixed(2);
          const fee             = (totalCost * 0.0025).toFixed(2);
          const totalCostWithFee = (totalCost * 1.0025).toFixed(2);
          const money           = data.balance.money.cash;
          const color           = 0x32CD32;

          if (assetType === 'stock') {
            const profile = await getCompanyProfile({ symbol: assetSymbol });
            logoURL = profile.logo || logoURL;
          }

          const textDetail = buildTextDetail(mode, assetType, amount, volume);
          const summary    = buildBuyOrderSummary({
            color, assetType, mode, assetSymbol, marketPrice, shortName,
            logoURL, textDetail, fee, totalCostWithFee, interaction, amountInv, money,
          });

          const response   = await interaction.editReply({ components: [summary], flags: MessageFlags.IsComponentsV2 });
          const collector1 = response.createMessageComponentCollector({ filter: () => true, time: 60000 });

          collector1.on('collect', async (i) => {
            if (i.user.id !== interaction.user.id) {
              await i.reply({ content: "Sorry, this isn't your menu!", flags: MessageFlags.Ephemeral });
              return;
            }

            await i.deferUpdate();

            if (i.customId === 'confirm_purchase') {
              const currentMoney = data.balance.money.cash;
              if (currentMoney - totalCostWithFee < 0) {
                collector1.stop('negative_money');
                return;
              }

              const payloadData = { symbol: assetSymbol, volume: Number(volume), cost: Number(totalCostWithFee), date: new Date(), logoURL };
              const txnData     = { ...payloadData, type: 'buy', assetType };

              await portData.updateOne(query, { $push: {
                [`balance.assets.${assetType.toLowerCase()}`]: payloadData,
                transaction: txnData,
              }});
              await portData.updateOne(query, { $set: { 'balance.money.cash': Math.round((currentMoney - totalCostWithFee) * 100) / 100 } });

              collector1.stop('done');

            } else if (i.customId === 'cancel_purchase') {
              await i.deferUpdate();
              collector1.stop('cancel');
            }
          });

          collector1.on('end', async (collected, reason) => {
            if (reason === 'done') {
              const successContainer = buildSuccessContainer({ assetType, assetSymbol, marketPrice, volume: mode === 'cost' ? (amount / marketPrice).toFixed(7) : amount, totalCostWithFee, interaction });
              await interaction.editReply({ components: [successContainer], flags: MessageFlags.IsComponentsV2 });
              return;
            }

            const errInfo = getErrorInfo(reason, assetSymbol, assetType, data.balance.money.cash, totalCostWithFee);
            if (!errInfo) return;

            const errContainer = buildErrorContainer(new ContainerBuilder(), {
              color:     errInfo.color || 0xDC143C,
              titleText: errInfo.title,
              descText:  errInfo.desc,
              gifURL:    errInfo.gif,
              userId:    interaction.user.id,
            });

            await interaction.editReply({ components: [errContainer], flags: MessageFlags.IsComponentsV2 });
          });

        } else {
          // Error / timeout on the first collector
          const errInfo = getErrorInfo(reason, assetSymbol, assetType, data.balance.money.cash, null);
          if (!errInfo) return;

          const errContainer = buildErrorContainer(collectContainer, {
            color:     errInfo.color || 0xDC143C,
            titleText: errInfo.title,
            descText:  errInfo.desc,
            gifURL:    errInfo.gif,
            userId:    interaction.user.id,
          });

          await interaction.editReply({ components: [errContainer], flags: MessageFlags.IsComponentsV2 });
        }
      });

    } catch (error) {
      console.log(error);
      await interaction.editReply(`Error Code: ${error}`);
    }
  },
};