/*
  Updated to Web API with local allcoin.json
*/

const { ApplicationCommandOptionType, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const { Vibrant } = require("node-vibrant/node");
const { drawCandlestickChart } = require('../../misc/drawGraph');

const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const BASE_URL = "https://api.coingecko.com/api/v3";

function formatNumber(num) {
  if (num === null || num === undefined) return "N/A";
  num = Math.floor(num);

  if (num >= 1e12) return (num / 1e12).toFixed(2) + "T"; // ล้านล้าน
  if (num >= 1e9)  return (num / 1e9).toFixed(2) + "B";  // พันล้าน
  if (num >= 1e6)  return (num / 1e6).toFixed(2) + "M";  // ล้าน
  if (num >= 1e3)  return (num / 1e3).toFixed(2) + "K";  // พัน
  return num.toString();
}

async function getColorImage(imageUrl) {
  try {
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
    const pngBuffer = await sharp(response.data).png().toBuffer();
    const palette = await Vibrant.from(pngBuffer).getPalette();

    const rgb = palette.LightVibrant._rgb;
    const hex = '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
    
    return hex || "#000000";
  } catch (err) {
    console.error(err);
    return "#000000";
  }
}

module.exports = {
  name: 'crypto',
  description: 'Get (Crypto) info for a given coin name',

  options: [
    {
      name: 'symbol',
      description: `The symbol or name of the cryptocurrency (example: BTC, ETH, USDT, Bitcoin, Ethereum, Tether)`,
      type: ApplicationCommandOptionType.String,
      required: true,
    }
  ],

  callback: async(client, interaction) => {
    await interaction.deferReply();

    try {
      const nameInput = interaction.options.getString('symbol');

      const allCoinPath = path.join(__dirname, '..', '..', '..', 'allcoin.json');
      if (!fs.existsSync(allCoinPath)) {
        return await interaction.editReply("❌ ไม่พบไฟล์ allcoin.json ในระบบ กรุณาตรวจสอบพาร์ทไฟล์");
      }
      
      const allCoin = JSON.parse(fs.readFileSync(allCoinPath, 'utf-8'));

      // find coinId by symbol
      const coinMatch = allCoin.find(c => c.symbol.toUpperCase() === nameInput.toUpperCase() || c.id.toUpperCase() === nameInput.toUpperCase() || c.name.toUpperCase() === nameInput.toUpperCase());
      
      if (!coinMatch) {
        return await interaction.editReply(`❌ ไม่พบข้อมูลเหรียญชื่อ **${nameInput}** ในไฟล์ระบบ ลองตรวจสอบอีกครั้ง หรือ โปรดเช็คในนี้ค่ะ [link](https://github.com/JaKKrit2006/FinanceBotDiscordRebuild/blob/main/allcoin.json)`);
      }

      const response = await axios.get(`${BASE_URL}/coins/${coinMatch.id}`, {
        headers: {
          'x-cg-demo-api-key': COINGECKO_API_KEY
        }
      });

      const chartResponse = await axios.get(`${BASE_URL}/coins/${coinMatch.id}/ohlc`, {
        headers: {
          'x-cg-demo-api-key': COINGECKO_API_KEY
        },
        params: {
          vs_currency: 'usd',
          days: 30
        }
      });
      //console.log(chartResponse);
      const chartData = chartResponse.data;
      const result = chartData.map(item => {
        const date1 = new Date(item[0]);
        return {
          date:  date1.toISOString(),
          open: item[1],
          high: item[2],
          low: item[3],
          close: item[4]
        };
      });

      //console.log(result);

      const cryptoData = response.data;
      const cryptoSymbol = cryptoData.symbol.toUpperCase();
      const cryptoMarketData = cryptoData.market_data;

      const pngBuffer = await drawCandlestickChart(result, {
        symbol   : coinMatch.id,
        timeframe: "4H",
        url_image: cryptoData.image.large,
      });

      const attachment = new AttachmentBuilder(pngBuffer, { name: 'image.png' });

      const iconURL = `https://raw.githubusercontent.com/JaKKrit2006/icon/refs/heads/main/open-market.png`;
      const colors = await getColorImage(cryptoData.image.large) || '#000000';

      const cryptoEmbed = new EmbedBuilder()
        .setAuthor({
          name: `Request by ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTitle(cryptoSymbol)
        .setColor(colors)
        .setThumbnail(cryptoData.image.large)
        .setImage('attachment://image.png')
        .setFooter({
          text: `Opening | 🗓️ ${new Date().toLocaleString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric'
            })}, ${new Date().toLocaleString('en-US',
            { hour12: true , timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }
          )} (GMT+7)`,
          iconURL: iconURL || null,
        })
        .setFields(
          {
            name: ':coin: Coin',
            value: `${cryptoData.name}`,
            inline: true
          },
          {
            name: 'Stable Coin',
            value: `${cryptoData.categories && cryptoData.categories[0] === 'Stablecoins' ? 'Yes' : 'No'}`,
            inline: true
          },
          {
            name: ':medal: Rank',
            value: `#${cryptoMarketData.market_cap_rank || 'N/A'}`,
            inline: true
          },
          {
            name: `${cryptoMarketData.price_change_24h > 0 ? ':small_red_triangle:' : ':small_red_triangle_down:'} Market Price`,
            value: `${cryptoMarketData.current_price.usd?.toLocaleString() || 'N/A'}`,
            inline: true
          },
          {
            name: 'Change (1D)',
            value: `${cryptoMarketData.price_change_24h > 0 ? '+' : ''}${cryptoMarketData.price_change_24h?.toFixed(2)} (${cryptoMarketData.price_change_percentage_24h?.toFixed(2)}%)`,
            inline: true
          },
          {
            name: 'High/Low (1D)',
            value: `${cryptoMarketData.high_24h.usd?.toLocaleString() || 'N/A'}/${cryptoMarketData.low_24h.usd?.toLocaleString() || 'N/A'}`,
            inline: true
          },
          {
            name: 'Volume',
            value: `${formatNumber(cryptoMarketData.total_volume.usd) || 'N/A'}`,
            inline: true
          },
          {
            name: 'Market Cap',
            value: `${formatNumber(cryptoMarketData.market_cap.usd) || 'N/A'}`,
            inline: true
          },
          {
            name: 'Supply',
            value: `${formatNumber(cryptoMarketData.circulating_supply) || 'N/A'}/${cryptoMarketData.max_supply_infinite ? '∞' : formatNumber(cryptoMarketData.max_supply)}`,
            inline: true
          },
          {
            name: ':gear: Misc',
            value: `ATH: ${cryptoMarketData.ath.usd?.toLocaleString()} | HomePage: [link](${cryptoData.links.homepage[0]})`
          },
          {
            name: 'Currency',
            value: `:flag_us: USD`,
            inline: true
          },
          {
            name: 'Source',
            value: `[CoinGecko](https://www.coingecko.com/en/coins/${coinMatch.id})`,
            inline: true
          }
        );

      const feelingEmojiList = [':wink:', ':yum:', ':relaxed:', ':smiling_face_with_3_hearts:', ':blush:'];
      const contentList = [
        `ได้แล้วค่ะ ข้อมูลเหรียญ **${cryptoSymbol}** ยินดีที่ได้บริการค่ะ.`,
        `นี่ค่ะ… ข้อมูลเหรียญ **${cryptoSymbol}** ที่คุณขอ เป็นอย่างไรบ้างคะ? :heart: ดูดีเลยใช่มั้ยคะ?`,
        `ได้แล้วนะคะ… ข้อมูลเหรียญ **${cryptoSymbol}** พร้อมส่งมอบให้คุณแล้วค่ะ หวังว่าวันนี้พอร์ตของคุณจะไม่แดงนะคะ`,
        `ข้อมูลเหรียญของ **${cryptoSymbol}** อยู่ตรงนี้แล้วค่ะ… 🌸 ขอให้คุณเจอแต่โอกาสที่สวยงามนะคะ`,
        `เหรียญ **${cryptoSymbol}** ที่คุณต้องการอยู่นี้แล้วค่าาา... ต้องการเหรียญไหนเพิ่มอีกมั้ยคะ?`
      ];

      await interaction.editReply({
        content: `${contentList[Math.floor(Math.random() * contentList.length)]} ${feelingEmojiList[Math.floor(Math.random() * feelingEmojiList.length)]}`,
        embeds: [ cryptoEmbed ],
        files: [attachment]
      });

    } catch (error) {
      console.error(error);
      await interaction.editReply(`Error code: ${error.message || error}`);
    }
  }
};