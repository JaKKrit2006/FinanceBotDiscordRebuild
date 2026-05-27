/*
  It took me 3 Days to make this fucking noob things - fetch Stock data and Earning data Nov/5/2025 - Nov/7/2025
*/

const { ApplicationCommandOptionType, EmbedBuilder, EmbedAssertions, AttachmentBuilder } = require('discord.js');
const { allFields } = require('../../misc/allQuoteFields');
const { drawCandlestickChart } = require('../../misc/drawGraph');
const { Vibrant } = require("node-vibrant/node");

const { subDays, format } = require('date-fns');
const { createCanvas, loadImage } = require('canvas');
const finnhub = require('finnhub');
const axios = require('axios');
const sharp = require('sharp');
const util = require('util');

// yahoo
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

const finnhubClient = new finnhub.DefaultApi(process.env.FINNHUB_API)

// Promisify Finnhub methods
const promisifiedCompanyProfile = util.promisify(finnhubClient.companyProfile2).bind(finnhubClient);

// function zone
function formatNumber(num) {
  if (num >= 1e12) return (num / 1e12).toFixed(2) + "T"; // ล้านล้าน
  if (num >= 1e9)  return (num / 1e9).toFixed(2) + "B";  // พันล้าน
  if (num >= 1e6)  return (num / 1e6).toFixed(2) + "M";  // ล้าน
  if (num >= 1e3)  return (num / 1e3).toFixed(2) + "K";  // พัน
  return num.toString();
}

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


// start module
module.exports = {
  name: 'stock',
  description: 'Get (US) stock info/earning for a given ticker symbol. (ETF can use but may lead you to error)',
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
    },
    {
      name: 'earning',
      description: 'Get earning information for the stock. (True/False)',
      type: ApplicationCommandOptionType.Boolean,
      required: false,
    }
  ],

  callback: async (client, interaction) => {
    await interaction.deferReply();

    const ticker = interaction.options.getString('ticker').toUpperCase();
    const isEarning = interaction.options.getBoolean('earning') || false;

    try {
      // Promisify
      const companyProfile = await promisifiedCompanyProfile({ 'symbol': ticker }) || null;
      // Get colors embed
      const embedColors = await getColorImage(companyProfile.logo);

      // Earning Data
      if (isEarning) {

        const quote2 = await yahooFinance.quoteSummary(ticker, {
          modules: ['price', 'financialData', 'earnings', 'calendarEvents', 'incomeStatementHistoryQuarterly',
            'earningsTrend'
          ]
        });

        // debug
        // console.log(quote2.earningsTrend.trend) // est eps/revenue for 1 year
        // console.log(quote2.incomeStatementHistoryQuarterly.incomeStatementHistory); // revenue
        // console.log(quote2.earnings.financialsChart); // eps
        // console.log(quote2.earnings.earningsChart);
        // console.log(quote2.calendarEvents);

        const financialsChart = quote2.earnings.financialsChart;
        const earningsChart = quote2.earnings.earningsChart;
        const calendarEvents = quote2.calendarEvents;
        const incomeQuarterly = quote2.incomeStatementHistoryQuarterly.incomeStatementHistory;
        const estTrend = quote2.earningsTrend.trend;

        const currentQuaterEarning = financialsChart.quarterly.at(-1) || financialsChart.quarterly[financialsChart.quarterly.length - 1];
        const nextQuaterEarning = `${earningsChart.currentQuarterEstimateDate} ${earningsChart.currentQuarterEstimateYear}`;
        const currentEps = earningsChart.quarterly.at(-1) || earningsChart.quarterly[earningsChart.quarterly.length - 1];
        const estAllYear = estTrend.find(item => item.period === '0y');

        const previousEpsQuater1 = earningsChart.quarterly.at(-2) || earningsChart.quarterly[earningsChart.quarterly - 2];
        const previousEpsQuater2 = earningsChart.quarterly.at(-3) || earningsChart.quarterly[earningsChart.quarterly - 3];
        const previousRevQuater1 = financialsChart.quarterly.at(-2) || financialsChart.quarterly[financialsChart.quarterly - 2];
        const previousRevQuater2 = financialsChart.quarterly.at(-3) || financialsChart.quarterly[financialsChart.quarterly - 3];

        const nextQuaterDate = formatToGMT7(earningsChart.earningsDate) || `No Deadline Yet.`;
        const currentQuaterDate = formatToGMT7(incomeQuarterly[0].endDate) || `No Deadline Yet.`;

        const earningEmbed = new EmbedBuilder()
          .setAuthor({
            name: `Request by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          })
          .setTitle(`Earning of ${ticker}`)
          .setThumbnail(companyProfile.logo || null)
          .setColor(embedColors)
          .setFooter({
            text: `🗓️ ${new Date().toLocaleString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric'
              })}, ${new Date().toLocaleString('en-US',
              { hour12: true , timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }
            )} (GMT+7)`
          })
          .setFields(
            {
              name: `Next (${nextQuaterEarning})`,
              value: `:calendar_spiral: ${nextQuaterDate}`,
            },
            {
              name: `EPS Est.`,
              value: `${calendarEvents.earnings.earningsAverage.toFixed(2) || `N/A`}\n≈ ${estAllYear.earningsEstimate.avg.toFixed(2) || `N/A`} (Ann. ${new Date().getFullYear()})`,
              inline: true
            },
            {
              name: `Revenue Est.`,
              value: `${formatNumber(calendarEvents.earnings.revenueAverage) || `N/A`}\n≈ ${formatNumber(estAllYear.revenueEstimate.avg) || `N/A`} (Ann. ${new Date().getFullYear()})`,
              inline: true
            },
            {
              name: `Current (${currentQuaterEarning.date.slice(0, 2)} ${currentQuaterEarning.date.slice(2)})`, // example: '3Q 2025'
              value: `:calendar_spiral: ≈ ${currentQuaterDate.slice(10)}`,
            },
            {
              name: `EPS Act.`,
              value: `${currentEps.actual.toFixed(2) || `N/A`} (est. ${currentEps.estimate.toFixed(2) || `N/A`})`,
              inline: true
            },
            {
              name: `Revenue Act.`,
              value: `${formatNumber(currentQuaterEarning.revenue) || `N/A`}`,
              inline: true
            },
            {
              name: `Surprise (EPS)`,
              value: `${Number(currentEps.surprisePct) >= 0 ? `:small_red_triangle:` : `:small_red_triangle_down:`} ${currentEps.surprisePct || `N/A`}%`,
              inline: true
            },
            {
              name: `:leftwards_arrow_with_hook: Previous`,
              value: `(${previousEpsQuater1.date.slice(0, 2)} ${previousEpsQuater1.date.slice(2)}) eps: ${previousEpsQuater1.actual || `N/A`} revenue: ${formatNumber(previousRevQuater1.revenue || `N/A`)}\n(${previousEpsQuater2.date.slice(0, 2)} ${previousEpsQuater2.date.slice(2)}) eps: ${previousEpsQuater2.actual || `N/A`} revenue: ${formatNumber(previousRevQuater2.revenue || `N/A`)}`,
            },
            {
              name: `Currency`,
              value: `:flag_us: ${quote2.price.currency || `N/A`}`,
              inline: true
            },
            {
            name: `Source`,
            value: `:link: [__YahooFinance__](https://finance.yahoo.com/quote/${ticker}/)`,
            inline: true
          }
          );

        feelingEmojiList = [
        ':wink:', ':yum:', ':relaxed:', ':smiling_face_with_3_hearts:', ':blush:'
        ];

        contentList = [
          `ได้แล้วค่ะ ข้อมูลผลประกอบการของหุ้น **${ticker}** ยินดีที่ได้บริการค่ะ.`,
          `นี่ค่ะ… ข้อมูลผลประกอบการหุ้น **${ticker}** ที่คุณขอ เป็นอย่างไรบ้างคะ? :heart: ผลประกอบการดีมั้ยคะ?…`,
          `ได้แล้วนะคะ… ข้อมูลผลประกอบการหุ้น **${ticker}** พร้อมส่งมอบให้คุณแล้วค่ะ หวังว่าจะเป็นวันนี้ที่ดีของคุณนะ…`,
          `ผลประกอบการของ **${ticker}** อยู่ตรงนี้แล้วค่ะ… 🌸 ขอให้คุณเจอแต่โอกาสที่สวยงามนะคะ…`,
        ]


        await interaction.editReply({
          content: `${contentList[Math.floor(Math.random() * (contentList.length - 0.1))]} ${feelingEmojiList[Math.floor(Math.random() * (feelingEmojiList.length - 0.1))]}`,
          embeds: [ earningEmbed ]
        });

        return;
      }

      // ------------------------------------------------------------------------------------------------------------

      // Fetch stock price data
      const quote = await yahooFinance.quote(ticker, {
        fields: allFields.fields
      });

      const today = new Date();
      const pastDate = subDays(today, 90);
      const formattedDate = format(pastDate, 'yyyy-MM-dd');

      const queryOptions = {
        period1: formattedDate, // YYYY-MM-DD
        interval: '1d',
      };
      const chartResult = await yahooFinance.chart(ticker, queryOptions);
      const chartData = chartResult.quotes;
      //console.log(chartData);

      const pngBuffer = await drawCandlestickChart(chartData, {
        symbol   : ticker,
        timeframe: "1D",
        url_image: companyProfile.logo,
      });

      const attachment = new AttachmentBuilder(pngBuffer, { name: 'image.png' });

      // debug
      //console.log(quote);
      //console.log(companyProfile);

      // Stock Data 
      const emojiList = {
        bull: ':small_red_triangle:',
        bear: ':small_red_triangle_down:',
        equal: ':heavy_equals_sign:',
      }

      // Change emoji compare price change
      let marketEmoji = '';
      if (quote.regularMarketChange > 0) {
        marketEmoji = emojiList['bull'];
      } else if (quote.regularMarketChange < 0) {
        marketEmoji = emojiList['bear']; 
      } else {
        marketEmoji = emojiList['equal'];
      }

      // Make it to function soon...
      const marketSession = quote.marketState;
      let prePostEmoji = '';
      let prePostPriceText = '';
      let prePostChangeText = '';
      let iconURL = '';
      let marketSessionText = '';

      if (quote.hasPrePostMarketData) {
        if (marketSession === 'POST') {
          if (!quote.postMarketPrice) {
            prePostEmoji = ':crescent_moon:';
            prePostPriceText = `\n${prePostEmoji} N/A`;
            prePostChangeText = `\nN/A`;
          } else {
            prePostEmoji = ':crescent_moon:';
            prePostPriceText = `\n${prePostEmoji} ${quote.postMarketPrice.toFixed(2)}`;
            prePostChangeText = `\n${quote.postMarketChange > 0 ? '+' : ''}${quote.postMarketChange.toFixed(2)} (${quote.postMarketChangePercent.toFixed(2)}%)`;
          }
        } else if (marketSession === 'PRE') {
          if (!quote.preMarketPrice) {
            prePostEmoji = ':sunny:';
            prePostPriceText = `\n${prePostEmoji} N/A`;
            prePostChangeText = `\nN/A`;
          } else {
            prePostEmoji = ':sunny:';
            prePostPriceText = `\n${prePostEmoji} ${quote.preMarketPrice.toFixed(2)}`;
            prePostChangeText = `\n${quote.preMarketChange > 0 ? '+' : ''}${quote.preMarketChange.toFixed(2)} (${quote.preMarketChangePercent.toFixed(2)}%)`;
          }
        }
      } else {
        prePostEmoji = '';
        prePostPriceText = '';
        prePostChangeText = '';
      }

      // Icon for footer
      if (marketSession === 'PRE') {
        iconURL = 'https://raw.githubusercontent.com/JaKKrit2006/icon/refs/heads/main/pre-market.png'; // Pre-market icon
        marketSessionText = 'Pre-Market';
      } else if (marketSession === 'POST') {
        iconURL = 'https://raw.githubusercontent.com/JaKKrit2006/icon/refs/heads/main/post-market.png'; // Post-market icon
        marketSessionText = 'Post-Market';
      } else if (marketSession === 'REGULAR') {
        iconURL = 'https://raw.githubusercontent.com/JaKKrit2006/icon/refs/heads/main/open-market.png'; // Open-Market icon
        marketSessionText = 'Opening';
      } else {
        iconURL = 'https://raw.githubusercontent.com/JaKKrit2006/icon/refs/heads/main/close-market.png'; // Closed-Market icon
        marketSessionText = 'Closed';
      }

      // Create embed message
      const stockEmbed = new EmbedBuilder()
        .setAuthor({
          name: `Request by ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTitle(`**${ticker}**`)
        .setColor(embedColors)
        .setThumbnail(companyProfile.logo || null)
        .setImage('attachment://image.png')
        // .setURL(`https://finance.yahoo.com/quote/${ticker}/`)
        .setFooter({
          text: `${marketSessionText || 'Closed'} | 🗓️ ${new Date().toLocaleString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric'
            })}, ${new Date().toLocaleString('en-US',
            { hour12: true , timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }
          )} (GMT+7)`,
          iconURL: iconURL || null,
        })
        .setFields(
          {
            name: `:classical_building: Company`,
            value: `${quote.shortName || 'N/A'}`,
          },
          {
            name: `${marketEmoji} Market Price`,
            value: `${quote.regularMarketPrice.toFixed(2)}${prePostPriceText}`,
            inline: true
          },
          {
            name: `Change`,
            value: `${quote.regularMarketChange > 0 ? '+' : ''}${quote.regularMarketChange.toFixed(2)} (${quote.regularMarketChangePercent.toFixed(2)}%)${prePostChangeText}`,
            inline: true,
          },
          {
            name: `High/Low`,
            value: `${quote.regularMarketDayHigh.toFixed(2)}/${quote.regularMarketDayLow.toFixed(2)}`,
            inline: true,
          },
          {
            name: `Volume`,
            value: `${formatNumber(quote.regularMarketVolume)}`,
            inline: true,
          },
          {
            name: `Marketcap`,
            value: `${formatNumber(quote.marketCap)}`,
            inline: true,
          },
          {
            name: `Dividend Yield`,
            value: `${quote.dividendYield ? `${quote.dividendYield}%` : 'No pay dividend.'}`,
            inline: true,
          },
          {
            name: `Valuation`,
            value: `P/E: ${quote.trailingPE ? quote.trailingPE.toFixed(2) : '-'} | P/B: ${quote.priceToBook.toFixed(2) || '-'} | BVPS: ${quote.bookValue.toFixed(2) || '-'}`,
          },
          {
            name: `Currency`,
            value: `:flag_${quote.region.toLowerCase()}: ${quote.currency}`,
            inline: true
          },
          {
            name: `Source`,
            value: `:link: [__YahooFinance__](https://finance.yahoo.com/quote/${ticker}/)`,
            inline: true
          }
        )

      feelingEmojiList = [
        ':wink:', ':yum:', ':relaxed:', ':smiling_face_with_3_hearts:', ':blush:'
      ];

      contentList = [
        `ได้แล้วค่ะ ข้อมูลของหุ้น **${ticker}** ยินดีที่ได้บริการค่ะ.`,
        `นี่ค่ะ… ข้อมูลหุ้น **${ticker}** ที่คุณขอ ฉันเก็บไว้ให้อย่างดีเลย :heart: อย่าลืมพักผ่อนบ้างนะคะ…`,
        `ได้แล้วนะคะ… ข้อมูลหุ้น **${ticker}** พร้อมส่งมอบให้คุณแล้วค่ะ หวังว่าจะช่วยให้วันนี้ของคุณงดงามยิ่งขึ้นนะ…`,
        `หุ้น **${ticker}** อยู่ตรงนี้แล้วค่ะ… 🌸 ขอให้คุณเจอแต่โอกาสที่สวยงามนะคะ…`,
      ]


      await interaction.editReply({
        content: `${contentList[Math.floor(Math.random() * (contentList.length - 0.1))]} ${feelingEmojiList[Math.floor(Math.random() * (feelingEmojiList.length - 0.1))]}`,
        embeds: [ stockEmbed ],
        files: [attachment]
      });
    }
    
    // Error handling
    catch (error) {
      console.error(error);
      await interaction.editReply(`Error code: ${error}`);
    }
  }
};
