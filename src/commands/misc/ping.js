module.exports = {
  name: 'ping',
  description: 'Pong!',
  devOnly: true,
  testOnly: true,
  // options: Object[],
  // deleted: Boolean,

  callback: async (client, interaction) => {
    await interaction.deferReply();

    const reply = await interaction.fetchReply();
    const ping = reply.createdTimestamp - interaction.createdTimestamp;

    interaction.editReply(`Pong! 🏓\nLatency is ${ping}ms. | Websocket ${client.ws.ping}ms`);
  },
};
