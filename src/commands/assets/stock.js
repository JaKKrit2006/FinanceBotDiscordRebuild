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

const finnhub = require('finnhub');
const axios = require('axios');
const sharp = require('sharp');
const util = require('util');

// yahoo
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

//const finnhubClient = new finnhub.DefaultApi(process.env.FINNHUB_API)

// Promisify Finnhub methods
//const promisifiedCompanyProfile = util.promisify(finnhubClient.companyProfile2).bind(finnhubClient);

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
      // console.log("Debug quote:");
      console.log(quote);
      if (!quote) {
        return await interaction.editReply(`:x: There was no TICKER:**${ticker}** in the data system.`);
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

      //NasdaqGS
      //NYSE
      //NYSEArca

      let bannerExchange = '';
      if (quote.fullExchangeName === 'NasdaqGS') {
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
          + `**Source**\n- :link: [TradingView](https://www.tradingview.com/)`);
      stockContainer.addTextDisplayComponents(textHead);

      const separator1 = new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small);
      stockContainer.addSeparatorComponents(separator1);

      const media1 = new MediaGalleryBuilder()
        .addItems(
          new MediaGalleryItemBuilder()
            .setURL('attachment://chart.png')
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

      /*
      feelingEmojiList = [
        ':wink:', ':yum:', ':relaxed:', ':smiling_face_with_3_hearts:', ':blush:'
      ];

      contentList = [
        `ได้แล้วค่ะ ข้อมูลของหุ้น **${ticker}** ยินดีที่ได้บริการค่ะ.`,
        `นี่ค่ะ… ข้อมูลหุ้น **${ticker}** ที่คุณขอ ฉันเก็บไว้ให้อย่างดีเลย :heart: อย่าลืมพักผ่อนบ้างนะคะ…`,
        `ได้แล้วนะคะ… ข้อมูลหุ้น **${ticker}** พร้อมส่งมอบให้คุณแล้วค่ะ หวังว่าจะช่วยให้วันนี้ของคุณงดงามยิ่งขึ้นนะ…`,
        `หุ้น **${ticker}** อยู่ตรงนี้แล้วค่ะ… 🌸 ขอให้คุณเจอแต่โอกาสที่สวยงามนะคะ…`,
      ]*/


      await interaction.editReply({
        // content: `${contentList[Math.floor(Math.random() * (contentList.length - 0.1))]} ${feelingEmojiList[Math.floor(Math.random() * (feelingEmojiList.length - 0.1))]}`,
        components: [stockContainer],
        flags: MessageFlags.IsComponentsV2,
        files: [ attachment ]
      });
    }
    
    // Error handling
    catch (error) {
      console.error(error);
      await interaction.editReply(`Error code: ${error}`);
    }
  }
};
