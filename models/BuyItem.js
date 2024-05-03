const mongoose = require('mongoose');

const BuyItemSchema = new mongoose.Schema({
    name: String,
    price: Number,
    quantity: Number,
    createdAt: { type: Date, default: Date.now }
});

const BuyItem = mongoose.model('BuyItem', BuyItemSchema);
module.exports = BuyItem;