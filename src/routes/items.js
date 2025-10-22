const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const itemController = require('../controllers/itemController');
const upload = require('../middleware/upload'); // ⬅️ add multer middleware

// Create new item (with optional image upload)
router.post('/', auth, upload.single('image'), itemController.createItem);

// Get all items
router.get('/', auth, itemController.getItems);

// Get items uploaded by current user
router.get('/me', auth, itemController.getUserItems);

// Get one item by id
router.get('/:id', auth, itemController.getItem);

// Update item (with optional new image upload)
router.put('/:id', auth, upload.single('image'), itemController.updateItem);

// Delete item
router.delete('/:id', auth, itemController.deleteItem);

module.exports = router;
