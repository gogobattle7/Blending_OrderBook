// routes/saleRoutes.js
const express = require('express');
const router = express.Router();
const sellController = require('../controllers/sellController');

router.post('/sell', sellController.createSellItem);

module.exports = router;
