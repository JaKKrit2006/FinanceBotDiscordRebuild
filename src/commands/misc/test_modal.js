const {
  ContainerBuilder, TextDisplayBuilder,
  SeparatorBuilder, ButtonBuilder, ButtonStyle,
  MessageFlags, SeparatorSpacingSize,
  ActionRowBuilder, StringSelectMenuBuilder,
  ModalBuilder, TextInputBuilder, TextInputStyle,
} = require('discord.js');

module.exports = {
  name: 'testmodal',
  description: 'test only',
  devOnly: true,
  testOnly: true,

  callback: async (client, interaction) => {
    try {
      // ── 1. สร้าง Components V2 ──────────────────────────
      const select = new StringSelectMenuBuilder()
        .setCustomId('test_select')
        .setPlaceholder('เลือกตัวเลือก...')
        .addOptions([
          { label: 'ตัวเลือก A', description: 'รายละเอียด A', value: 'option_a', emoji: '🅰️' },
          { label: 'ตัวเลือก B', description: 'รายละเอียด B', value: 'option_b', emoji: '🅱️' },
          { label: 'ตัวเลือก C', description: 'รายละเอียด C', value: 'option_c', emoji: '🆑' },
        ]);

      const openModalBtn = new ButtonBuilder()
        .setCustomId('open_modal_btn')
        .setLabel('เปิด Modal')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📝');

      const container = new ContainerBuilder()
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent('## 🧪 Test Components V2\nเลือกตัวเลือกด้านล่าง หรือกดปุ่มเพื่อเปิด Modal')
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        )
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(select)
        )
        .addSeparatorComponents(
          new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
        )
        .addActionRowComponents(
          new ActionRowBuilder().addComponents(openModalBtn)
        );

      // ส่งข้อความเริ่มต้นออกไป
      const replyMessage = await interaction.reply({
        components: [container],
        flags: MessageFlags.IsComponentsV2,
        fetchReply: true, // จำเป็นต้องใช้เพื่อดักจับปุ่ม/เมนูที่ตอบกลับมา
      });

      // ── 2. สร้าง Collector สำหรับดักฟังปุ่ม และ Select Menu ──────────────────────────
      // กำหนด Filter ให้เฉพาะคนที่กดใช้คำสั่งเท่านั้นที่สามารถกดปุ่มเล่นได้
      const filter = (i) => i.user.id === interaction.user.id;
      
      // ตัว Collector จะทำงานเป็นเวลา 5 นาที
      const collector = replyMessage.createMessageComponentCollector({ filter, time: 300000 });

      collector.on('collect', async (i) => {
        
        // กรณีที่ 1: ผู้ใช้กดเลือก Select Menu
        if (i.customId === 'test_select') {
          const selectedValue = i.values[0];
          await i.reply({
            content: `คุณได้เลือกตัวเลือก: **${selectedValue}**`,
            ephemeral: true
          });
        }

        // กรณีที่ 2: ผู้ใช้กดปุ่ม "เปิด Modal"
        if (i.customId === 'open_modal_btn') {
          // สร้าง Modal และ Input ของแบบฟอร์ม
          const modal = new ModalBuilder()
            .setCustomId('test_modal_form')
            .setTitle('ฟอร์มทดสอบ Components V2');

          const textInput = new TextInputBuilder()
            .setCustomId('modal_input_text')
            .setLabel('กรุณากรอกข้อความของคุณ')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('พิมพ์ที่นี่...')
            .setRequired(true);

          // โน้ต: การเปิด Modal ใน Discord.js ยังคงต้องใช้ ActionRowBuilder แบบปกติห่อหุ้ม TextInput
          const firstActionRow = new ActionRowBuilder().addComponents(textInput);
          modal.addComponents(firstActionRow);

          // ส่ง Modal ให้ผู้ใช้แสดงผลบนหน้าจอ
          await i.showModal(modal);

          // ── 3. ดักฟังคำตอบจาก Modal (Submit) ──────────────────────────
          try {
            const modalSubmit = await i.awaitModalSubmit({
              filter: (m) => m.customId === 'test_modal_form' && m.user.id === interaction.user.id,
              time: 60000, // ให้เวลาพิมพ์ 1 นาที
            });

            // ดึงค่าที่ผู้ใช้กรอกออกมา
            const submittedText = modalSubmit.fields.getTextInputValue('modal_input_text');

            // ตอบกลับผลลัพธ์ของ Modal
            await modalSubmit.reply({
              content: `ได้รับข้อมูลจาก Modal แล้ว! ข้อความของคุณคือ: \`${submittedText}\``,
              ephemeral: true
            });

          } catch (modalError) {
            // จะเข้าทำงานตรงนี้ถ้าผู้ใช้กดปิด Modal หรือพิมพ์ไม่เสร็จภายในเวลาที่กำหนด
            console.log('Modal timeout หรือถูกปิดไปโดยไม่ได้ส่งข้อมูล');
          }
        }
      });

      // เมื่อ Collector หมดเวลา (ครบ 10 นาที)
      collector.on('end', () => {
        console.log('หมดเวลาการใช้งาน Components สำหรับข้อความนี้');
      });

    } catch (error) {
      console.error(error);
      if (!interaction.replied) {
        await interaction.reply({ content: `Error: ${error.message}`, ephemeral: true });
      }
    }
  },
};