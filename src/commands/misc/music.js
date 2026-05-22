const { joinVoiceChannel, createAudioPlayer, createAudioResource, getVoiceConnection, NoSubscriberBehavior, AudioPlayerStatus } = require('@discordjs/voice');
const { ApplicationCommandOptionType, EmbedBuilder, MessageFlags } = require('discord.js');
const path = require('path');
const play = require('play-dl');
const axios = require('axios');
const sharp = require('sharp');
const { Vibrant } = require("node-vibrant/node");

play.setToken({
  soundcloud: {
    client_id: process.env.SOUNDCLOUD_AUR
  }
})

// test
const AUDIO_FILE_PATH = path.join(__dirname, '..', '..', '..', 'music', 'test_song1.mp3');
const LEAVE_SOUND_PATH = path.join(__dirname, '..', '..', '..', 'music', 'bye.mp3');
const JOIN_SOUND_PATH = path.join(__dirname, '..', '..', '..', 'music', 'greeting.mp3');


async function getColorImage(imageUrl) {
  try {
    // load image to buffer
    const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });

    // convert PNG buffer before feed to Vibrant
    const pngBuffer = await sharp(response.data).png().toBuffer();
    const palette = await Vibrant.from(pngBuffer).getPalette();

    // debug
    //console.log(palette);

    const rgb = palette.LightVibrant._rgb;
    const hex = '#' + rgb.map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
    
    return hex || "#000000";
    
  } catch (err) {
    console.error(err);
    return "#000000";
  }
}


async function playMusic(connection, query, interaction) {

  try {
    let stream;
    let title = 'Unknown Song';
    let artist = 'Unknown Artist';
    let uploader = 'Unknown Uploader';
    let url = query;
    let thumbnailUrl = '';
    let duration = 0;

    // ตรวจสอบว่าเป็น URL หรือคำค้นหา
    const validation = await play.validate(query);

    if (validation === false || validation === 'search') {
      await interaction.editReply(`🔍 กำลังค้นหา: **${query}**...`);
      
      const searchResults = await play.search(query, {
        limit: 1,
        source: {
          soundcloud: "tracks" // ["albums", "tracks", "playlists"]
        }
      });

      if (!searchResults || searchResults.length === 0) {
        return interaction.editReply('❌ ไม่พบเพลงที่ค้นหา กรุณาลองใหม่อีกครั้ง');
      }

      // ใช้ผลลัพธ์แรก
      console.log(searchResults);

      const song = searchResults[0];
      title = song.name;
      artist = song.publisher?.name || 'Unknown Artist';
      url = song.permalink;
      uploader = song.user.name || 'Unknown Uploader';
      thumbnailUrl = song.thumbnail;
      duration = song.durationInSec;
      
      // ดึง Stream จากผลลัพธ์
      stream = await play.stream(url);
    }
    // ---------------------------------------------------------
    // ถ้าเป็น SoundCloud URL
    // ---------------------------------------------------------
    else if (validation === 'so_track') {
      const info = await play.soundcloud(url);

      console.log(info);
      title = info.name;
      artist = info.publisher?.artist || 'Unknown Artist';
      uploader = info.user.name || 'Unknown Uploader';
      thumbnailUrl = info.thumbnail;
      duration = info.durationInSec;
      stream = await play.stream_from_info(info);
    }
    else {
      return interaction.editReply('❌ รองรับเฉพาะ SoundCloud เท่านั้น');
    }
    
    // ---------------------------------------------------------
    // ส่วนการเล่นเสียง
    // ---------------------------------------------------------

    const resource = createAudioResource(stream.stream, {
      inputType: stream.type,
      inlineVolume: true 
    });
    
    resource.volume.setVolume(0.5); 

    const player = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play,
      },
    });
    
    player.play(resource);
    connection.subscribe(player);

    const min_duration = Math.floor(duration / 60);
    let sec_duration = duration % 60;

    if (sec_duration < 10) {
      sec_duration = `0${sec_duration}`;
    }

    const musicEmbed = new EmbedBuilder()
      .setAuthor({
        name: `Request by ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL(),
      })
      .setTitle(title)
      .setURL(url)
      .setThumbnail(thumbnailUrl)
      .setFooter({
        text: `🗓️ ${new Date().toLocaleString('en-GB', {
            day: 'numeric', month: 'short', year: 'numeric'
          })}, ${new Date().toLocaleString('en-US',
          { hour12: true , timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }
        )} (GMT+7)`
      })
      .setColor(await getColorImage(thumbnailUrl) || null)
      .setFields(
        {
          name: 'Artist',
          value: `:microphone2: ${artist}`,
          inline: true
        },
        {
          name: 'Uploader',
          value: uploader,
          inline: true
        },
        {
          name: 'Duration',
          value: `:hourglass: ${min_duration}:${sec_duration}`,
          inline: true
        }
      )

    await interaction.editReply({
      embeds: [ musicEmbed ]
    });

    player.on(AudioPlayerStatus.Idle, () => {
      player.stop();
      // TODO: ใส่ Logic เล่นเพลงถัดไปในคิวตรงนี้
    });

    player.on('error', error => {
      console.error(`Error playing audio: ${error.message}`);
      if(!interaction.replied) {
        interaction.followUp(`❌ เกิดข้อผิดพลาดขณะเล่นเพลง: ${error.message}`);
      } else {
        console.log('Player error occurred but message already sent.');
      }
    });
    
    return player;

  } catch (error) {
    console.error(`Error processing query or streaming: ${error.message}`);
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(`❌ ไม่สามารถเล่นเพลงได้: ${error.message}`);
    } else {
      await interaction.reply(`❌ ไม่สามารถเล่นเพลงได้: ${error.message}`);
    }
    return null;
  }
}


function playSound(connection, soundPath) {
  const player = createAudioPlayer();
  const resource = createAudioResource(soundPath);
  
  // บอทเริ่มเล่นเสียง
  player.play(resource);
  connection.subscribe(player);

  // เมื่อเล่นจบแล้ว ให้หยุดเล่นและทำลาย player
  player.on(AudioPlayerStatus.Idle, () => {
    player.stop();
  });

  player.on('error', error => {
    console.error(`Error playing sound: ${error.message}`);
  });
}


module.exports = {
  name: 'music',
  description: 'Play a music',
  devOnly: true,
  // testOnly: true,
  // options: Object[],
  // deleted: Boolean,
  
  options: [
    {
      name: 'play',
      description: 'play a music in given url.',
      type: ApplicationCommandOptionType.Subcommand,

      options: [
        {
          name: 'url',
          description: 'url of your music.',
          type: ApplicationCommandOptionType.String,
          require: true
        }
      ]
    },
    {
      name: 'leave',
      description: 'kick a bot out',
      type: ApplicationCommandOptionType.Subcommand
    }
  ],

  callback: async (client, interaction) => {
    await interaction.deferReply(/*{ flags: MessageFlags.Ephemeral }*/);

    const sub = interaction.options.getSubcommand(); // leave, play
    const member = interaction.member;

    try {
      if (sub === 'leave') {
        const connection = getVoiceConnection(interaction.guildId);
        const voiceChannel = member.voice.channel;
        
        if (!connection) {
          return interaction.editReply('❌ Bot is not in voice channel yet.');
        }
        
        if (!voiceChannel) {
          return interaction.editReply('❌ You must be in the voice channel first.');
        }

        playSound(connection, LEAVE_SOUND_PATH);
        interaction.editReply('👋 Leaving the voice channel...');
        setTimeout(() => {
            connection.destroy();
            console.log('Bot disconnected after playing leave sound.');
            interaction.editReply(':zzz: Leaved');
        }, 2000);
        
        return;
      }

      if (!member.voice.channel) {
        return interaction.editReply('❌ You must be in the voice channel first.');
      }

      const voiceChannel = member.voice.channel;
      let connection = getVoiceConnection(interaction.guildId);

      // ถ้าบอทยังไม่ได้เชื่อมต่อ ให้เชื่อมต่อก่อน
      if (!connection || connection.state.status === 'destroyed') {
        connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: interaction.guildId,
            adapterCreator: interaction.guild.voiceAdapterCreator,
        });

        playSound(connection, JOIN_SOUND_PATH); // เล่นเสียงทักทายเมื่อเชื่อมต่อใหม่
      }

      // ดึง URL จาก option
      const url = interaction.options.getString('url');

      // 💡 เรียกใช้ฟังก์ชันเล่นเพลงที่รองรับ URL (SoundCloud)
      await playMusic(connection, url, interaction);
    }

    catch (error) {
      console.log(error);
      await interaction.editReply(`Error Code: ${error}`);
      return;
    }
    
  },
};
