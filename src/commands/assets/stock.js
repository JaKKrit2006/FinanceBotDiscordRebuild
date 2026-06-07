/*
  It took me 3 Days to make this fucking noob things - fetch Stock data and Earning data Nov/5/2025 - Nov/7/2025
*/

const { ApplicationCommandOptionType, EmbedBuilder, EmbedAssertions,ContainerBuilder,
  TextDisplayBuilder, SeparatorBuilder, ButtonBuilder, ButtonStyle, SectionBuilder,
  MessageFlags, SeparatorSpacingSize, AttachmentBuilder, FileBuilder, MediaGalleryBuilder,
  MediaGalleryItemBuilder, ThumbnailBuilder,  ActionRowBuilder, StringSelectMenuBuilder,
 } = require('discord.js');

const { allFields } = require('../../misc/allQuoteFields');
const { generateChartBuffer } = require('../../misc/chartCapture');
const { Vibrant } = require("node-vibrant/node");

const portData = require('../../models/portfolioUserData');

/*
const finnhub = require('finnhub');
const axios = require('axios');

const util = require('util');
*/
const fs = require('fs');
const sharp = require('sharp');

// yahoo
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

//const finnhubClient = new finnhub.DefaultApi(process.env.FINNHUB_API)

// Promisify Finnhub methods
//const promisifiedCompanyProfile = util.promisify(finnhubClient.companyProfile2).bind(finnhubClient);

// start module
module.exports = {
  name: 'stock',
  description: 'Get (US) stock info for a given ticker symbol. (ETF can use but may lead you to error)',
  // devOnly: Boolean,
  // testOnly: true,
  // options: Object[],
  // deleted: Boolean,

  options: [
    {
      name: 'ticker',
      description: `The ticker symbol of the stock to get info. (example: NVDA, META, AAPL)`,
      type: ApplicationCommandOptionType.String,
      required: true,
    }
  ],

  callback: async (client, interaction) => {
    await interaction.deferReply();

    const ticker = interaction.options.getString('ticker').toUpperCase();

    try {
      // Fetch stock price data
      const quote = await yahooFinance.quote(ticker, {
        fields: allFields.fields
      });
      /*
      const sumQuote = await yahooFinance.quoteSummary(ticker, {
        modules: ['price', 'summaryProfile', 'assetProfile', 'summaryDetail', 'defaultKeyStatistics', 'calendarEvents', 'earnings', 'financialData', 'indexTrend', 'upgradeDowngradeHistory']
      });

      const result = await yahooFinance.chart(ticker, {
        period1: '2026-06-05',
        // period2: '2026-06-06',
        interval: '5m'  // 1m, 5m, 15m, 1h, 1d, 1wk, 1mo
      });

      console.log(result);
      // console.log(sumQuote);
      */
      if (!quote) {
        return await interaction.editReply(`:x: There was no TICKER:**${ticker}** in the data system.`);
      }

      let xpText = '';
      const query = { userId: interaction.user.id }
      let data = await portData.findOne(query);
      if (!data) {
        xpText = `You don't have a **Portfolio**`;
      }
      else {
        const randomXp = Math.floor((Math.random() + 0.5) * 20);
        xpText = `You got **${randomXp}XP**`;

        await portData.updateOne(query, { $inc: {xp: randomXp} });
        
        data = await portData.findOne(query);
        let lv = data.level;
        let xp = data.xp;
        const rankUpXp = Math.floor(50 * (1.2 * lv) * (1.005 ** lv));

        if (xp >= rankUpXp) {
          xp -= rankUpXp;
          lv += 1;

          await portData.updateOne(query, { $set: {xp: xp, level: lv} });
        }
      }

      const marketSession = quote.marketState;
      let prePostEmoji = '';
      let marketSessionText = '';

      // Icon for footer
      if (marketSession === 'PRE') {
        prePostEmoji = ':sunny:'
        marketSessionText = 'Pre-Market';
      } else if (marketSession === 'POST') {
        prePostEmoji = ':last_quarter_moon_with_face:'
        marketSessionText = 'Post-Market';
      } else if (marketSession === 'REGULAR') {
        prePostEmoji = ':white_check_mark:'
        marketSessionText = 'Opening';
      } else {
        prePostEmoji = ':x:'
        marketSessionText = 'Closed';
      }

      //NasdaqGS NasdaqCM NasdaqGM
      //NYSE
      //NYSEArca

      let bannerExchange = '';
      if (quote.fullExchangeName === 'NasdaqGS' || quote.fullExchangeName === 'NasdaqCM' || quote.fullExchangeName === 'NasdaqGM') {
        bannerExchange = 'https://raw.githubusercontent.com/JaKKrit2006/FinanceBotDiscordRebuild/refs/heads/main/src/bin/Banner/default/NASDAQ_1.png';
      } else {
        bannerExchange = 'https://raw.githubusercontent.com/JaKKrit2006/FinanceBotDiscordRebuild/refs/heads/main/src/bin/Banner/default/NYSE.png'
      }

      // create chart buffer
      let tickerForChart = ticker;
      if (ticker.includes('-')) {
        tickerForChart = ticker.replace('-', '.'); // for yahoo finance, example: BRK-B → BRK.B
      }
      
      const chartBuffer = await generateChartBuffer(tickerForChart);
      const attachment = new AttachmentBuilder(chartBuffer, { name: 'chart.png' });

      // create componentV2
      const stockContainer = new ContainerBuilder();

      // add banner to the top of container
      const banner1 = new MediaGalleryItemBuilder()
        .setURL(bannerExchange);
      const topBanner = new MediaGalleryBuilder()
        .addItems(banner1);
      stockContainer.addMediaGalleryComponents(topBanner);

      const textHead = new TextDisplayBuilder()
        .setContent(`## Asset Info!\n:bar_chart: **${ticker} - ${quote.longName}**\n\n`
          + `**Source**\n- :link: [TradingView](https://www.tradingview.com/)\n- :tada: ${xpText}`);
      stockContainer.addTextDisplayComponents(textHead);

      const separator1 = new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small);
      stockContainer.addSeparatorComponents(separator1);

      const media1 = new MediaGalleryBuilder()
        .addItems(
          new MediaGalleryItemBuilder()
            .setURL('https://raw.githubusercontent.com/JaKKrit2006/icon/refs/heads/main/Wallpaper/discord-error.png')
        );
      stockContainer.addMediaGalleryComponents(media1);

      const footerText = new TextDisplayBuilder()
        .setContent(`\n${prePostEmoji} **${marketSessionText}** | 🗓️ ${new Date().toLocaleString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric'
            })}, ${new Date().toLocaleString('en-US',
            { hour12: true , timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }
          )} (GMT+7)`);
      stockContainer.addTextDisplayComponents(footerText);
      
      const separator2 = new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small);
      stockContainer.addSeparatorComponents(separator2);

      const requestText = new TextDisplayBuilder()
        .setContent(`-# Request by ${interaction.user.username}`)
      const button1 = new ButtonBuilder()
				.setLabel('View on TradingView')
				.setStyle(ButtonStyle.Link)
				.setURL(`https://www.tradingview.com/symbols/${tickerForChart}/`);
      const bottomSection = new SectionBuilder()
        .addTextDisplayComponents(requestText)
        .setButtonAccessory(button1);
      stockContainer.addSectionComponents(bottomSection);

      await interaction.editReply({
        components: [stockContainer],
        flags: MessageFlags.IsComponentsV2,
        // files: [attachment]
      });

    }
    
    // Error handling
    catch (error) {
      console.error(error);
      await interaction.editReply(`Error code: ${error}`);
    }
  }
};
