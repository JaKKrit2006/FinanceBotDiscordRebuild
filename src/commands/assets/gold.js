const { EmbedBuilder, AttachmentBuilder } = require('discord.js');
const axios = require('axios');
const { generateChartBuffer } = require('../../misc/chartCapture');

const GOLD_API_KEY = process.env.GOLD_API;
const THAI_GOLD_API = 'https://api.chnwt.dev/thai-gold-api/latest';
const SPOT_GOLD_API = 'https://www.goldapi.io/api/XAU/USD';
const goldImageUrl = 'https://raw.githubusercontent.com/JaKKrit2006/icon/refs/heads/main/gold.gif';

module.exports = {
  name: 'gold',
  description: 'Get gold spot price (XAU/USD) and Thai gold price.',

  callback: async (client, interaction) => {
    await interaction.deferReply();

    try {
      const [spotRes, thaiRes] = await Promise.all([
        axios.get(SPOT_GOLD_API, {
          headers: {
            'x-access-token': GOLD_API_KEY,
            'Content-Type': 'application/json'
          }
        }),
        axios.get(THAI_GOLD_API)
      ]);

      // ── Spot Gold (XAU/USD) ──────────────────────────────
      const spot = spotRes.data;
      const spotPrice       = spot.price;
      const spotPrevClose   = spot.prev_close_price || spotPrice;
      const spotChange      = spot.ch ?? (spotPrice - spotPrevClose);
      const spotChangePct   = spot.chp ?? ((spotChange / spotPrevClose) * 100);
      const spotHigh        = spot.high_price || spotPrice;
      const spotLow         = spot.low_price  || spotPrice;
      const spotOpen        = spot.open_price || spotPrice;

      // ── Thai Gold (สมาคมค้าทองคำ) ───────────────────────
      const thai = thaiRes.data.response;
      const thaiUpdateDate  = thai.update_date  || 'N/A';
      const thaiUpdateTime  = thai.update_time  || 'N/A';

      // ราคาทองแท่ง (gold_bar) และทองรูปพรรณ (gold)
      const barBuy   = thai.price.gold_bar?.buy  || 'N/A';
      const barSell  = thai.price.gold_bar?.sell || 'N/A';
      const ornBuy   = thai.price.gold?.buy      || 'N/A';
      const ornSell  = thai.price.gold?.sell     || 'N/A';

      // ── Market Status ────────────────────────────────────
      const now  = new Date();
      const day  = now.getUTCDay();
      const hour = now.getUTCHours();

      let marketSessionText = 'Opening';
      let iconURL = 'https://raw.githubusercontent.com/JaKKrit2006/icon/refs/heads/main/open-market.png';

      if (day === 0 || day === 6 || (day === 5 && hour >= 21) || (day === 1 && hour < 22)) {
        marketSessionText = 'Closed';
        iconURL = 'https://raw.githubusercontent.com/JaKKrit2006/icon/refs/heads/main/close-market.png';
      }

      const dateStr = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const timeStr = new Date().toLocaleString('en-US', { hour12: true, timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });

      const chartBuffer = await generateChartBuffer(`OANDA:XAUUSD`);
      const attachment = new AttachmentBuilder(chartBuffer, { name: 'chart.png' });

      // ── Build Embed ──────────────────────────────────────
      const goldEmbed = new EmbedBuilder()
        .setAuthor({
          name: `Request by ${interaction.user.username}`,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTitle('🌟 Gold Price Dashboard')
        .setColor('Gold')
        .setThumbnail(goldImageUrl)
        .setImage('attachment://chart.png')
        .setFooter({
          text: `${marketSessionText} | 🗓️ ${dateStr}, ${timeStr} (GMT+7)`,
          iconURL: iconURL || null
        })

        // ─── Section: Spot Gold ───
        .addFields(
          {
            name: '──────────────────────',
            value: '🌐 **Gold Spot (XAU/USD)**',
            inline: false
          },
          {
            name: ':moneybag: Current Price',
            value: `$${spotPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            inline: true
          },
          {
            name: ':chart_with_upwards_trend: Open Price',
            value: `$${spotOpen.toFixed(2)}`,
            inline: true
          },
          {
            name: `${spotChange >= 0 ? ':small_red_triangle:' : ':small_red_triangle_down:'} Change (1D)`,
            value: `${spotChange >= 0 ? '+' : ''}${spotChange.toFixed(2)} (${spotChange >= 0 ? '+' : ''}${spotChangePct.toFixed(2)}%)`,
            inline: true
          },
          {
            name: ':bar_chart: High / Low (1D)',
            value: `$${spotHigh.toFixed(2)} / $${spotLow.toFixed(2)}`,
            inline: true
          },
          {
            name: ':link: Source',
            value: '[GoldAPI.io](https://www.goldapi.io/)',
            inline: true
          },

          // ─── Section: Thai Gold ───
          {
            name: '──────────────────────',
            value: '🇹🇭 **ราคาทองไทย (สมาคมค้าทองคำ)**',
            inline: false
          },
          {
            name: ':date: อัปเดตล่าสุด',
            value: `${thaiUpdateDate}\n${thaiUpdateTime}`,
            inline: false
          },
          {
            name: '🪙 ทองแท่ง 96.5%',
            value: `ซื้อ: ฿${barBuy}\nขาย: ฿${barSell}`,
            inline: true
          },
          {
            name: '💍 ทองรูปพรรณ',
            value: `ซื้อ: ฿${ornBuy}\nขาย: ฿${ornSell}`,
            inline: true
          },
          {
            name: ':link: Source',
            value: '[goldtraders.or.th](https://www.goldtraders.or.th/)',
            inline: false
          }
        );

      await interaction.editReply({ embeds: [goldEmbed], files: [attachment] });

    } catch (error) {
      console.error(error);
      await interaction.editReply(`❌ Error: ${error.message || error}`);
    }
  }
};