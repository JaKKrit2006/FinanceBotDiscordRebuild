const { Client, Interaction, ApplicationCommandOptionType, EmbedBuilder } = require('discord.js');

// yahoo
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

// finnhub
const util = require('util');
const finnhub = require('finnhub');
const finnhubClient = new finnhub.DefaultApi(process.env.FINNHUB_API) // Replace this
// Promisify Finnhub methods
const promisifiedCompanyProfile = util.promisify(finnhubClient.companyProfile2).bind(finnhubClient);

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

  return `${timeStr}, ${dateStrFormatted}`;
}

function limitText(str, maxLength = 30) {
  return str.length > maxLength ? str.slice(0, maxLength) + '...' : str;
}



module.exports = {

  // deleted: true,
  name: 'news',
  description: 'Get a News of stock you choose.',
  // devOnly: Boolean,
  // testOnly: Boolean,

  options: [
    {
      name: 'ticker',
      description: 'A stock symbol you want to get News. (example: NVDA, AAPL, META)',
      required: true,
      type: ApplicationCommandOptionType.String,
    }
  ],

  callback: async(client, interaction) => {
    await interaction.deferReply();

    try {
      // stock symbol, ticker
      const symbol = await interaction.options.getString('ticker').toUpperCase(); 

      // Promisify
      const companyProfile = await promisifiedCompanyProfile({ 'symbol': symbol });
      const NewsCount = 10; // Don't set on 0

      const data = await yahooFinance.search(symbol, {
        newsCount: NewsCount,
        quotesCount: 1,
      });

      // news data
      let news = data.news;
      news = news.sort((a, b) => new Date(b.providerPublishTime) - new Date(a.providerPublishTime)); // sort latest news to top  
      news = news.filter(i => i.relatedTickers); // filter object has to have 'relatedTickers'
      news = news.filter(i => i.relatedTickers.includes(symbol));// filter news has to relate symbol
      
      // debug
      // console.log(data.news);

      // quote for stock data
      const quote = data.quotes.find(i => i.symbol === symbol);
      
      // news text
      let previousNews = ``;
      let countNews = 0;
      const limitNews = 3;

      news.forEach(item => {
        if (countNews >= limitNews) {
          return
        }
        countNews += 1;

        if (item.uuid === news[0].uuid) {
          return;
        }

        const newsText = limitText(item.title, 128);
        const text = `[${newsText}](${item.link})\n**(${item.publisher})** - ${formatToGMT7(item.providerPublishTime)}\n\n`;
        previousNews += text;
      })

      // get imageUrl
      const imageUrl = news.filter(i => i.thumbnail)[0].thumbnail.resolutions.find(i => i.tag === 'original').url;


      const newsEmbed = new EmbedBuilder()
        .setAuthor({
          name: `Request by ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTitle(`${limitText(news[0].title, 128) || 'No News yet.'}`)
        .setURL(news[0].link || null)
        .setDescription(`Updated at ${formatToGMT7(news[0].providerPublishTime) || `Time error.`}`)
        .setImage(imageUrl || null)
        .setColor('Blue')
        .setThumbnail(companyProfile.logo || null)
        .setFooter({
          text: `🗓️ ${new Date().toLocaleString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric'
            })}, ${new Date().toLocaleString('en-US',
            { hour12: true , timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }
          )} (GMT+7)`
        })
        .setFields(
          {
            name: `:classical_building: Company`,
            value: `${quote.shortname || 'N/A'} (${quote.symbol || 'N/A'})`,
          },
          {
            name: `:newspaper: Publisher`,
            value: `${news[0].publisher || 'N/A'}`,
            inline: true
          },
          {
            name: `:earth_americas: Time Zone`,
            value: `Asia/Bangkok (GMT+7)`,
            inline: true
          },
          {
            name: ':newspaper2: Previous News',
            value: `${previousNews || 'N/A'}`
          },
          {
            name: `:bar_chart: Relate Ticker`,
            value: `${news[0].relatedTickers.join(', ')}`
          }
        )

      feelingEmojiList = [
        ':wink:', ':yum:', ':relaxed:', ':smiling_face_with_3_hearts:', ':blush:'
      ];

      contentList = [
        `ได้แล้วค่ะ ข่าวของ **${symbol}** ยินดีที่ได้บริการค่ะ.`,
        `ข่าววันนี้ของ **${symbol}** ค่ะ มีอะไรให้ฉันช่วยเหลืออีกมั้ยคะ?`
      ]


      await interaction.editReply({
        content: `${contentList[Math.floor(Math.random() * (contentList.length - 0.1))]} ${feelingEmojiList[Math.floor(Math.random() * (feelingEmojiList.length - 0.1))]}`,
        embeds: [ newsEmbed ]
      });
    } 

    catch (error) {
      console.log(error);
      await interaction.editReply(`Error code: ${error}`)
    }
  }
  
};
