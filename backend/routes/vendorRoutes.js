
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/vendorController');

router.post('/login', ctrl.loginVendor);
router.post('/register', ctrl.registerVendor);
router.get('/dashboard', ctrl.getVendorDashboard);
router.get('/rooms/:id', ctrl.getRoomDetails);

module.exports = router;
