/*
  Updated to Web API with local allcoin.json
*/

const { ApplicationCommandOptionType, EmbedBuilder, EmbedAssertions,ContainerBuilder,
  TextDisplayBuilder, SeparatorBuilder, ButtonBuilder, ButtonStyle, SectionBuilder,
  MessageFlags, SeparatorSpacingSize, AttachmentBuilder, FileBuilder, MediaGalleryBuilder,
  MediaGalleryItemBuilder, ThumbnailBuilder,  ActionRowBuilder, StringSelectMenuBuilder,
 } = require('discord.js');
const { Vibrant } = require("node-vibrant/node");
const { generateChartBuffer } = require('../../misc/chartCapture');

const axios = require('axios');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const COINGECKO_API_KEY = process.env.COINGECKO_API_KEY;
const BASE_URL = "https://api.coingecko.com/api/v3";


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

      const cryptoData = response.data;
      const cryptoSymbol = cryptoData.symbol.toUpperCase();
      const cryptoMarketData = cryptoData.market_data;

      console.log(cryptoData);

      const chartBuffer = await generateChartBuffer(`COINBASE:${cryptoSymbol}USD`);
      const attachment = new AttachmentBuilder(chartBuffer, { name: 'chart.png' });

      // create componentV2
      const cryptoContainer = new ContainerBuilder();

      // add banner to the top of container
      const banner1 = new MediaGalleryItemBuilder()
        .setURL("https://raw.githubusercontent.com/JaKKrit2006/FinanceBotDiscordRebuild/refs/heads/main/src/bin/Banner/default/COINBASE.png");
      const topBanner = new MediaGalleryBuilder()
        .addItems(banner1);
      cryptoContainer.addMediaGalleryComponents(topBanner);

      const textHead = new TextDisplayBuilder()
        .setContent(`## Asset Info!\n:bar_chart: **${cryptoSymbol} - ${cryptoData.name}  (Rank #${cryptoMarketData.market_cap_rank})**\n\n`
          + `**Source**\n- :link: [TradingView](https://www.tradingview.com/)`);
      cryptoContainer.addTextDisplayComponents(textHead);

      const separator1 = new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small);
      cryptoContainer.addSeparatorComponents(separator1);

      const media1 = new MediaGalleryBuilder()
        .addItems(
          new MediaGalleryItemBuilder()
            .setURL('attachment://chart.png')
        );
      cryptoContainer.addMediaGalleryComponents(media1);

      const footerText = new TextDisplayBuilder()
        .setContent(`\n:white_check_mark: **Opening** | 🗓️ ${new Date().toLocaleString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric'
            })}, ${new Date().toLocaleString('en-US',
            { hour12: true , timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }
          )} (GMT+7)`);
      cryptoContainer.addTextDisplayComponents(footerText);
      
      const separator2 = new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small);
      cryptoContainer.addSeparatorComponents(separator2);

      const requestText = new TextDisplayBuilder()
        .setContent(`-# Request by ${interaction.user.username}`)
      const button1 = new ButtonBuilder()
				.setLabel('View on TradingView')
				.setStyle(ButtonStyle.Link)
				.setURL(`https://www.tradingview.com/symbols/${cryptoSymbol}USD?exchange=COINBASE`);
      const bottomSection = new SectionBuilder()
        .addTextDisplayComponents(requestText)
        .setButtonAccessory(button1);
      cryptoContainer.addSectionComponents(bottomSection);

      await interaction.editReply({
        components: [ cryptoContainer ],
        flags: MessageFlags.IsComponentsV2,
        files: [attachment]
      });

    } catch (error) {
      console.error(error);
      await interaction.editReply(`Error code: ${error.message || error}`);
    }
  }
};