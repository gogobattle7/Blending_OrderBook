
// controllers/buyController.js
const BuyItem = require('../models/BuyItem');

exports.createBuyItem = async (req, res) => {
    try {
        console.log("controller입장");
        const { name, price, quantity } = req.body;
        const buyItem = new BuyItem({ name, price, quantity });
        await buyItem.save();
        res.status(201).json(buyItem);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};
