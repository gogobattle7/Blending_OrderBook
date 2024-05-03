// routes/buyRoutes.js
const express = require('express');
const router = express.Router();
const buyController = require('../controllers/buyController');

router.post('/buy', buyController.createBuyItem);

module.exports = router;