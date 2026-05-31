const { ApplicationCommandOptionType, EmbedBuilder, EmbedAssertions,ContainerBuilder,
  TextDisplayBuilder, SeparatorBuilder, ButtonBuilder, ButtonStyle, SectionBuilder,
  MessageFlags, SeparatorSpacingSize, AttachmentBuilder, FileBuilder, MediaGalleryBuilder,
  MediaGalleryItemBuilder, ThumbnailBuilder,  ActionRowBuilder, StringSelectMenuBuilder,
 } = require('discord.js');
const axios = require('axios');
const { generateChartBuffer } = require('../../misc/chartCapture');

const GOLD_API_KEY = process.env.GOLD_API;
const THAI_GOLD_API = 'https://api.chnwt.dev/thai-gold-api/latest';
const SPOT_GOLD_API = 'https://www.goldapi.io/api/XAU/USD';
const goldImageUrl = 'https://raw.githubusercontent.com/JaKKrit2006/icon/refs/heads/main/gold.gif';

module.exports = {
  name: 'gold',
  description: 'Get gold spot price (XAU/USD)',

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
      let emojiIcon = ':white_check_mark:';

      if (day === 0 || day === 6 || (day === 5 && hour >= 21) || (day === 1 && hour < 22)) {
        marketSessionText = 'Closed';
        emojiIcon = ':x:';
      }

      const dateStr = new Date().toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
      const timeStr = new Date().toLocaleString('en-US', { hour12: true, timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' });

      const chartBuffer = await generateChartBuffer(`OANDA:XAUUSD`);
      const attachment = new AttachmentBuilder(chartBuffer, { name: 'chart.png' });

      // create componentV2
      const goldContainer = new ContainerBuilder();

      // add banner to the top of container
      const banner1 = new MediaGalleryItemBuilder()
        .setURL("https://raw.githubusercontent.com/JaKKrit2006/FinanceBotDiscordRebuild/refs/heads/main/src/bin/Banner/default/GOLD.png");
      const topBanner = new MediaGalleryBuilder()
        .addItems(banner1);
      goldContainer.addMediaGalleryComponents(topBanner);

      const textHead = new TextDisplayBuilder()
        .setContent(`## Asset Info!\n:bar_chart: **XAUUSD - Gold Spot**\n\n`
          + `**Source**\n- :link: [TradingView](https://www.tradingview.com/)`);
      goldContainer.addTextDisplayComponents(textHead);

      const separator1 = new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small);
      goldContainer.addSeparatorComponents(separator1);

      const media1 = new MediaGalleryBuilder()
        .addItems(
          new MediaGalleryItemBuilder()
            .setURL('attachment://chart.png')
        );
      goldContainer.addMediaGalleryComponents(media1);

      const footerText = new TextDisplayBuilder()
        .setContent(`\n${emojiIcon} **${marketSessionText}** | 🗓️ ${new Date().toLocaleString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric'
            })}, ${new Date().toLocaleString('en-US',
            { hour12: true , timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }
          )} (GMT+7)`);
      goldContainer.addTextDisplayComponents(footerText);
      
      const separator2 = new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small);
      goldContainer.addSeparatorComponents(separator2);

      const requestText = new TextDisplayBuilder()
        .setContent(`-# Request by ${interaction.user.username}`)
      const button1 = new ButtonBuilder()
				.setLabel('View on TradingView')
				.setStyle(ButtonStyle.Link)
				.setURL(`https://www.tradingview.com/symbols/XAUUSD/?exchange=OANDA`);
      const bottomSection = new SectionBuilder()
        .addTextDisplayComponents(requestText)
        .setButtonAccessory(button1);
      goldContainer.addSectionComponents(bottomSection);

      await interaction.editReply({
        components: [ goldContainer ],
        flags: MessageFlags.IsComponentsV2,
        files: [attachment]
      });

    } catch (error) {
      console.error(error);
      await interaction.editReply(`❌ Error: ${error.message || error}`);
    }
  }
};