const { Schema, model } = require('mongoose');

const portfolioData = new Schema({
  userName: {
    type: String,
    require: true
  },

  userId: {
    type: String,
    require: true
  },

  userAvatarUrl: {
    type: String,
    default: null
  },
  
  ranks: {
    type: String,
    default: 'Newbie'
  },

  time: {
    type: Date,
    default: Date.now
  },

  xp: {
    type: Number,
    default: 0
  },

  wealth: {
    type: Number,
    default: 1000
  },

  balance: {
    
    money: {
      cash: {
        type: Number,
        default: 1000
      }
    },

    assets: {
      stock: {
        type: Array,
        default: []
      },

      crypto: {
        type: Array,
        default: []
      },

      gold: {
        type: Array,
        default: []
      }
    }
  }
})

module.exports = model('balance', portfolioData);