/*
  1 Day to finish Nov/9/2025 - Updated to Stable Currency API (Fixed Yahoo Finance 429 & Crumb Error)
*/
const { ApplicationCommandOptionType, EmbedBuilder, AttachmentBuilder } = require('discord.js');
const axios = require('axios');
const { generateChartBuffer } = require('../../misc/chartCapture');

const currencyDetails = {
  USD: { name: 'US Dollar', flag: '🇺🇸' },
  EUR: { name: 'Euro', flag: '🇪🇺' },
  JPY: { name: 'Japanese Yen', flag: '🇯🇵' },
  GBP: { name: 'British Pound', flag: '🇬🇧' },
  CNY: { name: 'Chinese Yuan', flag: '🇨🇳' },
  CHF: { name: 'Swiss Franc', flag: '🇨🇭' },
  AUD: { name: 'Australian Dollar', flag: '🇦🇺' },
  CAD: { name: 'Canadian Dollar', flag: '🇨🇦' },
  HKD: { name: 'Hong Kong Dollar', flag: '🇭🇰' },
  SGD: { name: 'Singapore Dollar', flag: '🇸🇬' },
  THB: { name: 'Thai Baht', flag: '🇹🇭' }
};

module.exports = {
  name: 'currency',
  description: 'Get (Currency pair) info for a given 2 currencies.',

  options: [
    {
      name: 'list',
      description: 'Compare your currency with Top 10 currencies.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'symbol',
          description: 'Currency symbol, e.g., THB, USD, JPY',
          type: ApplicationCommandOptionType.String,
          required: true,
        }
      ],
    },
    {
      name: 'pair',
      description: 'Compare two currency that you give.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [
        {
          name: 'main',
          description: 'Currency symbol, e.g., THB, USD, JPY (Base Currency)',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
        {
          name: 'sub',
          description: 'Currency symbol, e.g., THB, USD, JPY (Target Currency)',
          type: ApplicationCommandOptionType.String,
          required: true,
        },
      ],
    }
  ],

  callback: async(client, interaction) => {
    await interaction.deferReply();

    try {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'list') {
        const symbol = interaction.options.getString('symbol').toUpperCase();

        const targetCurrencies = ['USD', 'EUR', 'JPY', 'GBP', 'CNY', 'CHF', 'AUD', 'CAD', 'HKD', 'SGD'];

        const response = await axios.get(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${symbol.toLowerCase()}.json`)
          .catch(() => null);

        if (!response || !response.data || !response.data[symbol.toLowerCase()]) {
          return await interaction.editReply(`❌ ไม่พบข้อมูลสกุลเงิน **"${symbol}"** ในระบบ หรือ API ขัดข้อง กรุณาตรวจสอบและลองใหม่อีกครั้งค่ะ`);
        }

        const rates = response.data[symbol.toLowerCase()];
        const updateDate = response.data.date;

        let currencyListText = ``;
        let marketPriceListText = ``;

        const now = new Date();
        const day = now.getUTCDay();
        const hour = now.getUTCHours();
        
        let marketSessionText = 'Opening';
        let iconURL = 'https://raw.githubusercontent.com/JaKKrit2006/icon/refs/heads/main/open-market.png';

        if (day === 0 || day === 6 || (day === 5 && hour >= 21) || (day === 1 && hour < 22)) {
          marketSessionText = 'Closed';
          iconURL = 'https://raw.githubusercontent.com/JaKKrit2006/icon/refs/heads/main/close-market.png';
        }

        targetCurrencies.forEach((target) => {
          const finalTarget = (target === symbol) ? 'THB' : target;
          const rateValue = rates[finalTarget.toLowerCase()];

          if (rateValue) {
            const invertedRate = 1 / rateValue;
            
            const mainFlag = currencyDetails[symbol]?.flag || '🏳️';
            const targetFlag = currencyDetails[finalTarget]?.flag || '🏳️';

            currencyListText += `${targetFlag} 1 ${finalTarget} → ${symbol}\n`;
            marketPriceListText += `**${invertedRate.toFixed(4)}** ${mainFlag}\n`;
          }
        });

        const currecncyEmbed = new EmbedBuilder()
          .setAuthor({
            name: `Request by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          })
          .setTitle(`🌍 Top 10 Currency Pairs Compared with (${symbol})`)
          .setColor('Blue')
          .setDescription(`อัตราแลกเปลี่ยนอัปเดต ณ วันที่: \`${updateDate}\``)
          .setFooter({
            text: `${marketSessionText} | 🗓️ ${new Date().toLocaleString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric'
              })}, ${new Date().toLocaleString('en-US',
              { hour12: true , timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }
            )} (GMT+7)`,
            iconURL: iconURL || null,
          })
          .setFields(
            {
              name: `:dollar: Pairs`,
              value: `${currencyListText}`,
              inline: true
            },
            {
              name: `Exchange Rate`,
              value: `${marketPriceListText}`,
              inline: true
            },
            {
              name: `Source`,
              value: `:link: [Currency API](https://github.com/fawazahmed0/currency-api)`,
              inline: true
            }
          );

        const feelingEmojiList = [':wink:', ':yum:', ':relaxed:', ':smiling_face_with_3_hearts:', ':blush:'];
        const contentList = [`ข้อมูล คู่เงิน 10 อันดับของโลกเทียบกับ **${symbol}** ของคุณค่ะ` ];

        await interaction.editReply({
          content: `${contentList[Math.floor(Math.random() * contentList.length)]} ${feelingEmojiList[Math.floor(Math.random() * feelingEmojiList.length)]}`,
          embeds: [ currecncyEmbed ]
        });
      }

      if (subcommand === 'pair') {
        const mainPair = interaction.options.getString('main').toUpperCase();
        const subPair = interaction.options.getString('sub').toUpperCase();

        if (mainPair === subPair) {
          return await interaction.editReply(`Sorry, main and sub are the same pair please try again.`);
        }
        const response = await axios.get(`https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/${mainPair.toLowerCase()}.json`)
          .catch(() => null);

        if (!response || !response.data || !response.data[mainPair.toLowerCase()]) {
          return await interaction.editReply(`❌ ไม่พบข้อมูลสกุลเงิน **"${mainPair}"** ในระบบ กรุณาตรวจสอบอีกครั้งค่ะ`);
        }

        const rates = response.data[mainPair.toLowerCase()];
        const exchangeRate = rates[subPair.toLowerCase()];
        const updateDate = response.data.date;

        if (!exchangeRate) {
          return await interaction.editReply(`❌ ไม่พบข้อมูลสกุลเงินย่อย **"${subPair}"** ในระบบ กรุณาตรวจสอบอีกครั้งค่ะ`);
        }

        const mainFlag = currencyDetails[mainPair]?.flag || '🏳️';
        const subFlag = currencyDetails[subPair]?.flag || '🏳️';
        const iconURL = 'https://raw.githubusercontent.com/JaKKrit2006/icon/refs/heads/main/open-market.png';

        const chartBuffer = await generateChartBuffer(`OANDA:${mainPair}${subPair}`);
        const attachment = new AttachmentBuilder(chartBuffer, { name: 'chart.png' });

        const currecncyEmbed = new EmbedBuilder()
          .setAuthor({
            name: `Request by ${interaction.user.username}`,
            iconURL: interaction.user.displayAvatarURL(),
          })
          .setTitle(`💱 Currency Pair: ${mainPair} / ${subPair}`)
          .setColor('Blue')
          .setDescription(`อัตราแลกเปลี่ยนอัปเดต ณ วันที่: \`${updateDate}\``)
          .setImage('attachment://chart.png')
          .setFooter({
            text: `Currency Market | 🗓️ ${new Date().toLocaleString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric'
              })}, ${new Date().toLocaleString('en-US',
              { hour12: true , timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }
            )} (GMT+7)`,
            iconURL: iconURL || null,
          })
          .setFields(
            {
              name: `:dollar: Base Rate`,
              value: `${mainFlag} 1 ${mainPair}`,
              inline: true
            },
            {
              name: `📊 Exchange Rate`,
              value: `**${exchangeRate.toFixed(4)}** ${subPair} ${subFlag}`,
              inline: true
            },
            {
              name: `Source`,
              value: `:link: [Currency API](https://github.com/fawazahmed0/currency-api)`,
              inline: true
            }
          );

        const feelingEmojiList = [':wink:', ':yum:', ':relaxed:', ':smiling_face_with_3_hearts:', ':blush:'];
        const contentList = [`ข้อมูล คู่เงิน **${mainPair}/${subPair}** ของคุณอยู่ตรงนี้แล้วค่ะ...` ];
        
        await interaction.editReply({
          content: `${contentList[Math.floor(Math.random() * contentList.length)]} ${feelingEmojiList[Math.floor(Math.random() * feelingEmojiList.length)]}`,
          embeds: [ currecncyEmbed ],
          files: [attachment]
        });
      }
    }
    catch (error) {
      console.error(error);
      await interaction.editReply(`❌ Error code: ${error.message || error}`);
    }
  }
}