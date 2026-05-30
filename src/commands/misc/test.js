const {
  ContainerBuilder, TextDisplayBuilder,
  SeparatorBuilder, ButtonBuilder, ButtonStyle,
  SectionBuilder, MessageFlags, SeparatorSpacingSize,
  AttachmentBuilder, FileBuilder,
  MediaGalleryBuilder, MediaGalleryItemBuilder,
	ThumbnailBuilder,  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require('discord.js');

const path = require('path');
const fs = require('fs');

module.exports = {
  name: 'test',
  description: 'test only',
  devOnly: true,
  testOnly: true,

  callback: async (client, interaction) => {

		try {
			const container = new ContainerBuilder()
				.setAccentColor(0x5865F2);

			// ✅ MediaGallery 1
			const media1 = new MediaGalleryBuilder()
				.addItems(
					new MediaGalleryItemBuilder()
						.setURL('https://s7.ezgif.com/tmp/ezgif-7ceb0e9b424de487.gif')
				);
			container.addMediaGalleryComponents(media1);

			// Text
			const textTop = new TextDisplayBuilder()
				.setContent(`## Introduce Something!\nThis is a text component\n\nYou can use **Markdown** in this component!\n- This is a list\n- You can use emojis! :smile:\n\n> This is a quote block\n[google](https://www.google.com)`);
			container.addTextDisplayComponents(textTop);

			// ✅ MediaGallery 2
			const media2 = new MediaGalleryBuilder()
				.addItems(
					new MediaGalleryItemBuilder()
						.setURL('https://raw.githubusercontent.com/JaKKrit2006/FinanceBotDiscordRebuild/refs/heads/main/src/bin/yomiGif/yomi_idle2.gif'),
					new MediaGalleryItemBuilder()
						.setURL('https://github.com/JaKKrit2006/FinanceBotDiscordRebuild/blob/main/src/bin/yomiGif/yomi_sad3.gif?raw=true')
				);
			container.addMediaGalleryComponents(media2);

			// ✅ Section 1 — Interactive button (customId เท่านั้น)
			const text1 = new TextDisplayBuilder().setContent('Test1');
			const button1 = new ButtonBuilder()
				.setLabel('Overview')
				.setStyle(ButtonStyle.Primary)
				.setCustomId('overview');
			const section1 = new SectionBuilder()
				.addTextDisplayComponents(text1)
				.setButtonAccessory(button1);
				/* .setThumbnailAccessory(
					new ThumbnailBuilder()
						.setURL(interaction.user.displayAvatarURL({ extension: 'png', size: 512 }))
				);*/
			container.addSectionComponents(section1);

			// ✅ Section 2 — Link button (URL เท่านั้น)
			const text2 = new TextDisplayBuilder().setContent('Test2');
			const button2 = new ButtonBuilder()
				.setLabel('Details')
				.setStyle(ButtonStyle.Link)
				.setURL('https://www.google.com');
			const section2 = new SectionBuilder()
				.addTextDisplayComponents(text2)
				.setButtonAccessory(button2);
			container.addSectionComponents(section2);

			// Separator
			const separator = new SeparatorBuilder()
				.setSpacing(SeparatorSpacingSize.Large);
			container.addSeparatorComponents(separator);

			// Footer text
			const text3 = new TextDisplayBuilder()
				.setContent('-# This is the end of the test component!');
			container.addTextDisplayComponents(text3);

			const filePath = path.join('allcoin.json');
			const fileContent = await fs.promises.readFile(filePath, 'utf-8');
			const attachment = new AttachmentBuilder(
				Buffer.from(fileContent),
				{ name: 'allcoin.json' }
			);
			const file = new FileBuilder().setURL('attachment://allcoin.json');
			container.addFileComponents(file);

			const selectRow = new ActionRowBuilder().addComponents(
				new StringSelectMenuBuilder()
					.setCustomId('stock_select')
					.setPlaceholder('เลือกหุ้น...')
					.addOptions([
						{
							label: 'Micron Technology',
							value: 'MU',
							description: 'NASDAQ: MU',
							emoji: { name: '📈' },
							default: false,
						},
						{
							label: 'Apple',
							value: 'AAPL',
							description: 'NASDAQ: AAPL',
							emoji: { name: '🍎' },
						},
						{
							label: 'NVIDIA',
							value: 'NVDA',
							description: 'NASDAQ: NVDA',
							emoji: { name: '🎮' },
						},
					])
			);

			container.addActionRowComponents(selectRow);

			const text4 = new TextDisplayBuilder()
				.setContent('This is a something');
			const section3 = new SectionBuilder()
				.addTextDisplayComponents(text4)
				.setThumbnailAccessory(
					new ThumbnailBuilder()
						.setURL('https://raw.githubusercontent.com/JaKKrit2006/FinanceBotDiscordRebuild/refs/heads/main/src/bin/yomiGif/yomi_happy1.gif')
				);
			container.addSectionComponents(section3);

			await interaction.reply({
				components: [container],
				flags: MessageFlags.IsComponentsV2,
				files: [attachment]
			});
		}

		catch (error) {
			console.error(error);
			await interaction.reply(`Error Code: ${error}`);
			return;
		}
    
  },
};