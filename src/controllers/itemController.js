const Item = require('../models/Item');
const User = require('../models/User');
const cloudinary = require('../config/cloudinary');
const streamifier = require('streamifier');
const sharp = require('sharp');

/* ---------------------- Helper: Upload Buffer to Cloudinary ---------------------- */
function uploadBufferToCloudinary(buffer, folder = 'lost_and_found') {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        transformation: [{ quality: 'auto' }, { fetch_format: 'auto' }]
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

/* ---------------------- ✅ Create Item (Lost or Found) ---------------------- */
exports.createItem = async (req, res) => {
  try {
    const {
      itemName,
      type, // Lost or Found
      foundLocation,
      foundDateTime,
      currentHolder,
      lostLocation,
      lostDateTime,
      contact
    } = req.body;

    const uploadedBy = req.user.id;
    const user = await User.findById(uploadedBy);

    let imageUrl = null, imagePublicId = null;

    if (req.file) {
      // Compress / resize before upload
      const processed = await sharp(req.file.buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

      const result = await uploadBufferToCloudinary(processed);
      imageUrl = result.secure_url;
      imagePublicId = result.public_id;
    }

    const item = new Item({
      itemName,
      type,
      // Conditional fields
      foundLocation: type === 'Found' ? foundLocation : null,
      foundDateTime: type === 'Found' ? new Date(foundDateTime) : null,
      currentHolder: type === 'Found' ? currentHolder : null,
      lostLocation: type === 'Lost' ? lostLocation : null,
      lostDateTime: type === 'Lost' ? new Date(lostDateTime) : null,
      contact: type === 'Lost' ? contact : null,
      uploadedBy,
      uploadedByEmail: user.email,
      imageUrl,
      imagePublicId,
      changeLog: [{ message: `Item created (${type})`, by: user.email }]
    });

    await item.save();
    res.json(item);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

/* ---------------------- ✅ Get All Items ---------------------- */
exports.getItems = async (req, res) => {
  try {
    const { q } = req.query;
    const filter = {};
    if (q) filter.itemName = { $regex: q, $options: 'i' };
    const items = await Item.find(filter).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

/* ---------------------- ✅ Get One Item ---------------------- */
exports.getItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ msg: 'Item not found' });
    res.json(item);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};

/* ---------------------- ✅ Update Item (Uploader Only) ---------------------- */
exports.updateItem = async (req, res) => {
  try {
    const item = await Item.findById(req.params.id);
    if (!item) return res.status(404).json({ msg: 'Item not found' });

    // 🧩 Ownership check
    if (item.uploadedBy.toString() !== req.user.id) {
      return res.status(403).json({ msg: 'You are not authorised to update this item' });
    }

    const userEmail = req.user.email;

    // Allowed fields to update
    const fields = [
      'itemName',
      'foundLocation',
      'foundDateTime',
      'currentHolder',
      'lostLocation',
      'lostDateTime',
      'contact',
      'status'
    ];

    fields.forEach((f) => {
      if (req.body[f] !== undefined) item[f] = req.body[f];
    });

    // Handle new image upload if provided
    if (req.file) {
      if (item.imagePublicId) {
        try {
          await cloudinary.uploader.destroy(item.imagePublicId);
        } catch (e) {
          console.warn('Failed to delete old image:', e);
        }
      }

      const processed = await sharp(req.file.buffer)
        .resize({ width: 1200, withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();

      const result = await uploadBufferToCloudinary(processed);
      item.imageUrl = result.secure_url;
      item.imagePublicId = result.public_id;
    }

    // Log the update
    item.changeLog.push({ message: `Updated: ${JSON.stringify(req.body)}`, by: userEmail });

    await item.save();
    res.json(item);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error ' + err);
  }
};

/* ---------------------- ✅ Delete Item ---------------------- */
exports.deleteItem = async (req, res) => {
  try {
    console.log("DELETE route hit with id:", req.params.id, "by user:", req.user?.id);

    const item = await Item.findById(req.params.id);
    if (!item) {
      console.log("Item not found in DB");
      return res.status(404).json({ message: 'Item not found' });
    }

    // Check if current user is the uploader
    if (item.uploadedBy.toString() !== req.user.id) {
      console.log("User is not the uploader");
      return res.status(403).json({ message: 'You cannot delete this item' });
    }

    // Allow deletion only if status is Returned or Recovered
    const deletableStatus = ['Returned', 'Recovered'];
    const itemStatusNormalized = item.status?.trim().toLowerCase();
    if (!deletableStatus.map(s => s.toLowerCase()).includes(itemStatusNormalized)) {
      console.log("Item status not deletable:", item.status);
      return res.status(400).json({ message: "Item is not closed yet. Cannot delete." });
    }

    // Delete image from Cloudinary if exists
    if (item.imagePublicId) {
      try {
        await cloudinary.uploader.destroy(item.imagePublicId);
        console.log("Deleted image from Cloudinary:", item.imagePublicId);
      } catch (e) {
        console.warn('Failed to delete image from Cloudinary:', e);
      }
    }

    await item.deleteOne();
    console.log("Item deleted successfully:", item._id);
    res.json({ message: 'Item deleted successfully' });

  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ message: 'Server error' });
  }
};

/* ---------------------- ✅ Get Items Uploaded by Current User ---------------------- */
exports.getUserItems = async (req, res) => {
  try {
    const items = await Item.find({ uploadedBy: req.user.id }).sort({ createdAt: -1 });
    res.json(items);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
};
