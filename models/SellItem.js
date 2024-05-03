// models/SellItem.js
const mongoose = require('mongoose');

const SellItemSchema = new mongoose.Schema({
    name: String,
    price: Number,
    quantity: Number,
    createdAt: { type: Date, default: Date.now }
});

const SellItem = mongoose.model('SellItem', SellItemSchema);
module.exports = SellItem;

