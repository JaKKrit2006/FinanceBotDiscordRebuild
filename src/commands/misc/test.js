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
  testOnly: false,

  callback: async (client, interaction) => {

		try {
			const container = new ContainerBuilder()
				.setAccentColor(0x1A3A6B);

			// ✅ MediaGallery 1
			const media1 = new MediaGalleryBuilder()
				.addItems(
					new MediaGalleryItemBuilder()
						.setURL('https://scontent.fbkk22-8.fna.fbcdn.net/v/t39.30808-6/711048483_1585623972920488_6351317353412825242_n.jpg?_nc_cat=1&ccb=1-7&_nc_sid=cc71e4&_nc_eui2=AeHlIot3covjd2-JocDi8NTDb7DQtcB--UNvsNC1wH75Qz6WNa_6ORvzbOeHuE9v11aHLBSsDaDxyeeGrKU8wpuF&_nc_ohc=s9dlPKMsaPcQ7kNvwFEvGu2&_nc_oc=AdqJMYWiadCHakQJV6SHL_Lt7FPtT2CZYb3emLZs-k36ZORXMs_Iy-wfAn05h2rQwfjN_INOx3bnXxC3wDjPfmAj&_nc_zt=23&_nc_ht=scontent.fbkk22-8.fna&_nc_gid=EgSUxYyhKVa-DAPign9KTA&_nc_ss=7b2a8&oh=00_Af84LYnmoAopqjQVaNv976oHuXZF8eNWvAKTGb1EaZA8uQ&oe=6A217C0D')
				);
			container.addMediaGalleryComponents(media1);

			// Text
			const textTop = new TextDisplayBuilder()
				.setContent(`## ถ้วยพร้อมทิ้ง สลิ้งพร้อมแตก PSG คว้าแชมป์ UCL อีกสมัย!!🏆🏆\nหลังพี่เตต้ายอมเป็นยามเฝ้าถ้วยให้\n## จบด้วยคะแนน :soccer: PSG 1-1 :kite: ARSENAL PEN(4-3)!\nทำให้ PSG ได้แชมป์ **สองสมัยติดต่อกัน** เป็นทีมที่ 2 ที่ได้แชมป์ UCL ติดต่อกันเหมือน Real Madrid\n- 2025 UEFA Champions League ✅\n- 2026 UEFA Champions League ✅\n[@psg](https://www.instagram.com/psg/)`);
			container.addTextDisplayComponents(textTop);

			// ✅ MediaGallery 2
			const media2 = new MediaGalleryBuilder()
				.addItems(
					new MediaGalleryItemBuilder()
						.setURL('https://pbs.twimg.com/media/HJmjT1bXcAEdFfN?format=jpg&name=4096x4096'),
					new MediaGalleryItemBuilder()
						.setURL('https://pbs.twimg.com/media/HJlt71vWYAMJMwX?format=jpg&name=medium'),
					new MediaGalleryItemBuilder()
						.setURL('https://pbs.twimg.com/media/HJnB9Q8XMAIuq5i?format=jpg&name=large')
				);
			container.addMediaGalleryComponents(media2);
			/*
			// ✅ Section 1 — Interactive button (customId เท่านั้น)
			const text1 = new TextDisplayBuilder().setContent('Test1');
			const button1 = new ButtonBuilder()
				.setLabel('Overview')
				.setStyle(ButtonStyle.Primary)
				.setCustomId('overview');
			const section1 = new SectionBuilder()
				.addTextDisplayComponents(text1)
				.setButtonAccessory(button1);
				.setThumbnailAccessory(
					new ThumbnailBuilder()
						.setURL(interaction.user.displayAvatarURL({ extension: 'png', size: 512 }))
				);
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
			*/

			const separatorImg = new SeparatorBuilder()
				.setSpacing(SeparatorSpacingSize.Large);
			container.addSeparatorComponents(separatorImg);

			const chelseaText = new TextDisplayBuilder()
				.setContent(`## Come and visit London’s Home of Trophies. 🏆⭐️⭐️\nมาดูถ้วยที่บ้านพี่มั้ยน้อง?`);
			const media3 = new MediaGalleryBuilder()
				.addItems(
					new MediaGalleryItemBuilder()
						.setURL("https://pbs.twimg.com/media/HJajmsbXsAYjEl5?format=jpg&name=large")
				);
			container.addTextDisplayComponents(chelseaText);
			container.addMediaGalleryComponents(media3);

			// Separator
			const separator = new SeparatorBuilder()
				.setSpacing(SeparatorSpacingSize.Large);
			container.addSeparatorComponents(separator);

			// Footer text
			const text3 = new TextDisplayBuilder()
				.setContent('-# เจอกันปีหน้าที่ PSG ไม่ได้บอก');
			container.addTextDisplayComponents(text3);
			
			/*
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
			*/
			/*
			const text4 = new TextDisplayBuilder()
				.setContent('This is a something');
			const text5 = new TextDisplayBuilder()
				.setContent('This is a something');
			const text6 = new TextDisplayBuilder()
				.setContent('This is a something');
			const section3 = new SectionBuilder()
				.addTextDisplayComponents(text4)
				.addTextDisplayComponents(text5)
				.addTextDisplayComponents(text6)
				.setThumbnailAccessory(
					new ThumbnailBuilder()
						.setURL(interaction.user.displayAvatarURL({ extension: 'png', size: 512 }))
				);
			container.addSectionComponents(section3);
			*/
			await interaction.reply({
				components: [container],
				flags: MessageFlags.IsComponentsV2,
				// files: [attachment]
			});
			
		}

		catch (error) {
			console.error(error);
			await interaction.reply(`Error Code: ${error}`);
			return;
		}
    
  },
};