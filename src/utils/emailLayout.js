import { studentLogoUrl } from '../config/email.js';

export const renderEmailHeader = () => {
  const logo = studentLogoUrl
    ? `<img src="${studentLogoUrl.replace(/&/g, '&amp;').replace(/"/g, '&quot;')}" alt="TRAC logo" width="88" height="88" style="display:block;width:88px;height:88px;object-fit:contain;border:0;margin:0 auto 10px;">`
    : '';

  return `
    <div style="text-align:center;margin:0 0 20px;">
      ${logo}
      <h2 style="color:#1B5E20;font-family:Arial,sans-serif;font-size:24px;line-height:1.25;margin:0;">TRAC Request</h2>
    </div>
  `;
};