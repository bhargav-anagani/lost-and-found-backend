const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { Resend } = require('resend');
const User = require('../models/User');

const resend = new Resend(process.env.RESEND_API_KEY);
const emailRegex = /^[a-zA-Z0-9._%+-]+@vitapstudent\.ac\.in$/;

// ===========================================
// REGISTER
// ===========================================
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!emailRegex.test(email)) {
      return res.status(400).json({ msg: 'Only VIT college email is allowed' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ msg: 'User already exists' });

    const user = new User({ name, email, password });
    await user.save();

    const payload = { user: { id: user._id, email: user.email } };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
      if (err) throw err;
      res.json({
        token,
        user: { _id: user._id, name: user.name, email: user.email }
      });
    });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

// ===========================================
// LOGIN
// ===========================================
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    const payload = { user: { id: user._id, email: user.email } };
    jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' }, (err, token) => {
      if (err) throw err;
      res.json({
        token,
        user: { _id: user._id, name: user.name, email: user.email }
      });
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
};

// ===========================================
// FORGOT PASSWORD
// ===========================================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 mins
    await user.save();

    const resetURL = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

    await resend.emails.send({
      from: process.env.EMAIL_FROM,
      to: user.email,
      subject: 'Password Reset Request',
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.5;">
          <h2>Reset Your Password</h2>
          <p>Hello ${user.name},</p>
          <p>You requested a password reset for your Lost & Found account.</p>
          <p>Click the link below to reset your password (valid for 15 minutes):</p>
          <a href="${resetURL}" 
             style="display:inline-block;padding:10px 15px;background-color:#007BFF;color:white;text-decoration:none;border-radius:5px;">
             Reset Password
          </a>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      `,
    });

    res.status(200).json({ msg: 'Password reset link sent to email' });
  } catch (err) {
    console.error('Forgot password error:', err);
    res.status(500).json({ msg: 'Error sending reset link', error: err.message });
  }
};

// ===========================================
// RESET PASSWORD
// ===========================================
exports.resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) return res.status(400).json({ msg: 'Invalid or expired token' });

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ msg: 'Password reset successful. Please log in.' });
  } catch (err) {
    console.error('Reset password error:', err.message);
    res.status(500).json({ msg: 'Server error resetting password' });
  }
};
