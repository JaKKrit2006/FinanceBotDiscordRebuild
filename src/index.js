require('dotenv').config();

const { Client, IntentsBitField, GatewayIntentBits } = require('discord.js');

const mongoose = require('mongoose');
const eventHandler = require('./handlers/eventHandler');

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildPresences,
    IntentsBitField.Flags.GuildVoiceStates
  ],
});

(async () => {
  try {

    mongoose.set('strictQuery', false);
    await mongoose.connect(process.env.DB_URI, { keepAliveInitialDelay: true})
    
    // debug
    console.log(`🟢 Connected to mongoDB.`)


    eventHandler(client);
    client.login(process.env.TOKEN);
  }

  catch (error) {
    console.log(error); // error handle
  }
  
})();

