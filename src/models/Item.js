const mongoose = require('mongoose');

const ChangeLogSchema = new mongoose.Schema({
  message: String,
  by: String,
  at: { type: Date, default: Date.now }
});

const ItemSchema = new mongoose.Schema({
  itemName: { type: String, required: true },

  // 🔹 NEW field to differentiate Lost vs Found
  type: { 
    type: String, 
    enum: ['Lost', 'Found'], 
    required: true 
  },

  // Found-specific fields
  foundLocation: { type: String },
  foundDateTime: { type: Date },
  currentHolder: { type: String },

  // Lost-specific fields
  lostLocation: { type: String },
  lostDateTime: { type: Date },
  contact: { type: String }, // person who lost the item

  // Status handling based on type
  status: { 
    type: String, 
    enum: ['In possession', 'Returned', 'Still lost', 'Recovered'], 
    default: function () {
      return this.type === 'Lost' ? 'Still lost' : 'In possession';
    }
  },

  uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  uploadedByEmail: { type: String },

  // Cloudinary image fields
  imageUrl: { type: String },        // Cloudinary secure URL
  imagePublicId: { type: String },   // Cloudinary public_id

  createdAt: { type: Date, default: Date.now },
  changeLog: [ChangeLogSchema]
});

module.exports = mongoose.model('Item', ItemSchema);
