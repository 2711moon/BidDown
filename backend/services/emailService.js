
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.zoho.in',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: false,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  tls: { rejectUnauthorized: false }
});

const send = async (to, subject, html) => {
  try {
    const fromAddr = process.env.EMAIL_FROM || process.env.EMAIL_USER;
    await transporter.sendMail({ from: '"BID ON" <' + fromAddr + '>', to, subject, html });
    console.log('[Email] Sent to ' + to + ': ' + subject);
  } catch (err) {
    console.error('[Email] Failed to ' + to + ':', err.message);
  }
};

const fmt = (d) => new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', dateStyle: 'medium', timeStyle: 'short' });
const dur = (s, e) => { const ms = new Date(e)-new Date(s); const h=Math.floor(ms/3600000),m=Math.floor((ms%3600000)/60000); return h>0?h+'h '+m+'m':m+' minutes'; };
const money = (n) => 'Rs. ' + Number(n).toLocaleString('en-IN');

exports.sendAuctionInvite = async ({ vendor, room, product, accessPassword, loginUrl }) => {
  const html = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif">'
    + '<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">'
    + '<div style="background:#111827;padding:28px 32px"><h1 style="color:#fff;margin:0;font-size:22px;font-weight:900">BID ON — Auction Invitation</h1></div>'
    + '<div style="padding:32px">'
    + '<p style="color:#374151;font-size:15px">Dear <strong>' + vendor.contactPerson + '</strong>,</p>'
    + '<p style="color:#374151;font-size:15px">You have been invited to a reverse auction to supply a total quantity of <strong>' + room.quantity + ' ' + product + '(s)</strong>.</p>'
    + '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:20px 0">'
    + '<h2 style="margin:0 0 14px;font-size:15px;color:#111">Auction Details</h2>'
    + '<table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse">'
    + '<tr><td style="padding:5px 0;font-weight:700;width:140px">Product</td><td>' + product + '</td></tr>'
    + '<tr><td style="padding:5px 0;font-weight:700">Start Time</td><td>' + fmt(room.startTime) + '</td></tr>'
    + '<tr><td style="padding:5px 0;font-weight:700">End Time</td><td>' + fmt(room.endTime) + '</td></tr>'
    + '<tr><td style="padding:5px 0;font-weight:700">Duration</td><td>' + dur(room.startTime, room.endTime) + '</td></tr>'
    + '<tr><td style="padding:5px 0;font-weight:700">Quantity</td><td>' + room.quantity + '</td></tr>'
    + '<tr><td style="padding:5px 0;font-weight:700">Base Price (Unit)</td><td>' + money(room.basePrice) + '</td></tr>'
    + '<tr><td style="padding:5px 0;font-weight:900;color:#111">Total Contract Value</td><td style="font-weight:900;color:#111">' + money(room.basePrice * room.quantity) + '</td></tr>'
    + '</table></div>'
    + '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:20px 0">'
    + '<h2 style="margin:0 0 14px;font-size:15px;color:#166534">Your Login Credentials</h2>'
    + '<table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse">'
    + '<tr><td style="padding:5px 0;font-weight:700;width:140px">Company</td><td>' + vendor.companyName + '</td></tr>'
    + '<tr><td style="padding:5px 0;font-weight:700">Contact Person</td><td>' + vendor.contactPerson + '</td></tr>'
    + '<tr><td style="padding:5px 0;font-weight:700">Email</td><td>' + vendor.email + '</td></tr>'
    + '<tr><td style="padding:5px 0;font-weight:700">Phone</td><td>' + vendor.phone + '</td></tr>'
    + '<tr><td style="padding:5px 0;font-weight:700">Password</td><td><span style="font-family:monospace;font-size:22px;font-weight:900;color:#166534;letter-spacing:5px;background:#dcfce7;padding:4px 12px;border-radius:4px">' + accessPassword + '</span></td></tr>'
    + '</table></div>'
    + '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;margin:20px 0;font-size:13px;color:#92400e">'
    + '<strong>Important:</strong> Login is only available within <strong>5 minutes before the auction starts</strong>. These credentials are unique to this auction.'
    + '</div>'
    + '<a href="' + loginUrl + '" style="display:inline-block;background:#111827;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px">Access Auction Portal</a>'
    + '<hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0">'
    + '<p style="color:#6b7280;font-size:13px;margin:0">Regards,<br><strong>BID ON Procurement Team</strong></p>'
    + '</div></div></body></html>';
  await send(vendor.email, 'Auction Invitation - ' + product, html);
};

exports.sendAuctionReminder = async ({ vendor, room, product, accessPassword, loginUrl }) => {
  const html = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif">'
    + '<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">'
    + '<div style="background:#dc2626;padding:28px 32px"><h1 style="color:#fff;margin:0;font-size:22px;font-weight:900">ACTION REQUIRED — Auction Starting</h1></div>'
    + '<div style="padding:32px">'
    + '<p style="color:#374151;font-size:15px">Dear <strong>' + vendor.contactPerson + '</strong>,</p>'
    + '<p style="color:#374151;font-size:15px">This is a reminder that the reverse auction to supply a total quantity of <strong>' + room.quantity + ' ' + product + '(s)</strong> is starting in <strong>5 minutes</strong>.</p>'
    + '<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:20px;margin:20px 0">'
    + '<h2 style="margin:0 0 12px;font-size:15px;color:#dc2626">Your Credentials</h2>'
    + '<table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse">'
    + '<tr><td style="padding:5px 0;font-weight:700;width:120px">Email</td><td>' + vendor.email + '</td></tr>'
    + '<tr><td style="padding:5px 0;font-weight:700">Password</td><td><span style="font-family:monospace;font-size:22px;font-weight:900;color:#dc2626;letter-spacing:5px;background:#fee2e2;padding:4px 12px;border-radius:4px">' + accessPassword + '</span></td></tr>'
    + '<tr><td style="padding:5px 0;font-weight:700">Starts At</td><td>' + fmt(room.startTime) + '</td></tr>'
    + '</table></div>'
    + '<a href="' + loginUrl + '" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px">Join the Auction Now</a>'
    + '<hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0">'
    + '<p style="color:#6b7280;font-size:13px;margin:0">Regards,<br><strong>BID ON Procurement Team</strong></p>'
    + '</div></div></body></html>';
  await send(vendor.email, 'REMINDER: Auction Starting in 5 Minutes - ' + product, html);
};

exports.sendAuctionEnded = async ({ vendor, product, quantity, isWinner, winningBid }) => {
  const inner = isWinner
    ? '<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:20px;margin:20px 0"><h2 style="color:#166534;margin:0 0 10px">Congratulations! You Won!</h2><p style="color:#374151;font-size:14px;margin:0">Your bid of <strong>' + money(winningBid) + '</strong> won the auction to supply a total quantity of <strong>' + quantity + ' ' + product + '(s)</strong>. Our team will be in touch to coordinate the purchase order.</p></div>'
    : '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:20px 0"><p style="color:#374151;font-size:14px;margin:0">Thank you for participating in the auction to supply <strong>' + quantity + ' ' + product + '(s)</strong>. We appreciate your time and look forward to your participation in future auctions.</p></div>';
  const html = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif">'
    + '<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">'
    + '<div style="background:#111827;padding:28px 32px"><h1 style="color:#fff;margin:0;font-size:22px;font-weight:900">BID ON - Auction Concluded</h1></div>'
    + '<div style="padding:32px">'
    + '<p style="color:#374151;font-size:15px">Dear <strong>' + vendor.contactPerson + '</strong>,</p>'
    + '<p style="color:#374151;font-size:15px">The auction for <strong>' + product + '</strong> has concluded.</p>'
    + inner
    + '<hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0">'
    + '<p style="color:#6b7280;font-size:13px;margin:0">Regards,<br><strong>BID ON Procurement Team</strong></p>'
    + '</div></div></body></html>';
  await send(vendor.email, (isWinner ? 'You Won! - ' : 'Thank You - ') + 'Auction Concluded: ' + product, html);
};

exports.sendAuctionReopened = async ({ vendor, room, product, accessPassword, loginUrl, isExisting }) => {
  const headerColor = isExisting ? '#7c3aed' : '#111827';
  const credentialBg = isExisting ? '#f5f3ff' : '#f0fdf4';
  const credentialBorder = isExisting ? '#ddd6fe' : '#bbf7d0';
  const credentialColor = isExisting ? '#5b21b6' : '#166534';
  const credentialBgSpan = isExisting ? '#ede9fe' : '#dcfce7';

  const existingNote = isExisting
    ? '<div style="background:#fef9c3;border:1px solid #fde047;border-radius:8px;padding:14px 18px;margin:20px 0;font-size:13px;color:#854d0e"><strong>Your credentials remain the same</strong> as your previous session. Use them to log in again.</div>'
    : '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:14px 18px;margin:20px 0;font-size:13px;color:#92400e"><strong>Important:</strong> Login is only available within <strong>5 minutes before the auction starts</strong>. These credentials are unique to this auction.</div>';

  const html = '<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,sans-serif">'
    + '<div style="max-width:600px;margin:32px auto;background:#fff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden">'
    + '<div style="background:' + headerColor + ';padding:28px 32px"><h1 style="color:#fff;margin:0;font-size:22px;font-weight:900">BID ON — Auction Re-Opened</h1></div>'
    + '<div style="padding:32px">'
    + '<p style="color:#374151;font-size:15px">Dear <strong>' + vendor.contactPerson + '</strong>,</p>'
    + '<p style="color:#374151;font-size:15px">The auction for <strong>' + product + '</strong> has been <strong>re-opened</strong> by the administrator' + (isExisting ? '. You have been retained as a participant.' : '. You have been invited to participate.') + '</p>'
    + '<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:20px;margin:20px 0">'
    + '<h2 style="margin:0 0 14px;font-size:15px;color:#111">Updated Auction Details</h2>'
    + '<table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse">'
    + '<tr><td style="padding:5px 0;font-weight:700;width:140px">Product</td><td>' + product + '</td></tr>'
    + '<tr><td style="padding:5px 0;font-weight:700">New Start</td><td>' + fmt(room.startTime) + '</td></tr>'
    + '<tr><td style="padding:5px 0;font-weight:700">New End</td><td>' + fmt(room.endTime) + '</td></tr>'
    + '<tr><td style="padding:5px 0;font-weight:700">Base Price</td><td>' + money(room.basePrice) + '</td></tr>'
    + '</table></div>'
    + '<div style="background:' + credentialBg + ';border:1px solid ' + credentialBorder + ';border-radius:8px;padding:20px;margin:20px 0">'
    + '<h2 style="margin:0 0 14px;font-size:15px;color:' + credentialColor + '">Your Login Credentials</h2>'
    + '<table style="width:100%;font-size:14px;color:#374151;border-collapse:collapse">'
    + '<tr><td style="padding:5px 0;font-weight:700;width:140px">Email</td><td>' + vendor.email + '</td></tr>'
    + '<tr><td style="padding:5px 0;font-weight:700">Password</td><td><span style="font-family:monospace;font-size:22px;font-weight:900;color:' + credentialColor + ';letter-spacing:5px;background:' + credentialBgSpan + ';padding:4px 12px;border-radius:4px">' + accessPassword + '</span></td></tr>'
    + '</table></div>'
    + existingNote
    + '<a href="' + loginUrl + '" style="display:inline-block;background:' + headerColor + ';color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:700;font-size:15px">Access Auction Portal</a>'
    + '<hr style="border:none;border-top:1px solid #e5e7eb;margin:28px 0">'
    + '<p style="color:#6b7280;font-size:13px;margin:0">Regards,<br><strong>BID ON Procurement Team</strong></p>'
    + '</div></div></body></html>';

  await send(vendor.email, (isExisting ? 'Auction Re-Opened — Same Credentials Valid: ' : 'New Auction Invitation: ') + product, html);
};

exports.verifyConnection = async () => {
  try {
    await transporter.verify();
    console.log('[Email] SMTP connection verified');
    return true;
  } catch (err) {
    console.error('[Email] SMTP connection failed:', err.message);
    return false;
  }
};
