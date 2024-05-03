// controllers/saleController.js
const SellItem = require('../models/SellItem');

exports.createSellItem = async (req, res) => {
    try {
        const { name, price, quantity } = req.body;
        const sellItem = new SellItem({ name, price, quantity });
        await sellItem.save();
        res.status(201).json(sellItem);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
