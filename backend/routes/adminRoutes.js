
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/adminController');
const { upload } = require('../config/cloudinary');

router.post('/login', ctrl.loginAdmin);
router.post('/change-password', ctrl.changePassword);

router.get('/vendors', ctrl.getVendors);
router.post('/vendors', upload.array('documents', 10), ctrl.createVendor);
router.put('/vendors/:id', upload.array('documents', 10), ctrl.updateVendor);
router.delete('/vendors/:id', ctrl.deleteVendor);
router.put('/vendors/:id/approve', ctrl.approveVendor);

router.post('/rooms', upload.array('documents', 10), ctrl.createRoom);
router.get('/rooms', ctrl.getRooms);
router.get('/rooms/:id', ctrl.getRoomById);
router.delete('/rooms/:id', ctrl.deleteRoom);

router.post('/rooms/:id/end', async (req, res) => {
  try {
    const BidRoom = require('../models/BidRoom');
    const room = await BidRoom.findById(req.params.id);
    if (!room) return res.status(404).json({ message: 'Room not found' });
    room.status = 'completed';
    room.endTime = new Date();
    await room.save();
    res.json({ message: 'Auction ended', room });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get('/reports', ctrl.getReports);

module.exports = router;
