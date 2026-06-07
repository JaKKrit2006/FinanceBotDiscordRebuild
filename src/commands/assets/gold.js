const { ApplicationCommandOptionType, EmbedBuilder, EmbedAssertions,ContainerBuilder,
  TextDisplayBuilder, SeparatorBuilder, ButtonBuilder, ButtonStyle, SectionBuilder,
  MessageFlags, SeparatorSpacingSize, AttachmentBuilder, FileBuilder, MediaGalleryBuilder,
  MediaGalleryItemBuilder, ThumbnailBuilder,  ActionRowBuilder, StringSelectMenuBuilder,
 } = require('discord.js');
const axios = require('axios');
const { generateChartBuffer } = require('../../misc/chartCapture');

// yahoo
const YahooFinance = require('yahoo-finance2').default;
const yahooFinance = new YahooFinance({ suppressNotices: ['yahooSurvey'] });

module.exports = {
  name: 'gold',
  description: 'Get gold spot price (XAU/USD)',

  callback: async (client, interaction) => {
    await interaction.deferReply();

    try {
      const quote = await yahooFinance.quote('GC=F');
      const marketStatus = quote.marketState;

      let marketSessionText = 'Opening';
      let emojiIcon = ':white_check_mark:';

      if (marketStatus !== 'REGULAR') {
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
            .setURL('https://raw.githubusercontent.com/JaKKrit2006/icon/refs/heads/main/Wallpaper/discord-error.png')
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
        // files: [attachment]
      });

    } catch (error) {
      console.error(error);
      await interaction.editReply(`❌ Error: ${error.message || error}`);
    }
  }
};