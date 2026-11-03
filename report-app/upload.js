import { google } from 'googleapis';
import stream from 'stream';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  try {
    const { items } = req.body;

    // 1. ประกอบโครง HTML พร้อมกด Print A4
    let sectionsHtml = '';
    items.forEach(item => {
      let imgsTag = item.images.map(src => `<div><img src="${src}"></div>`).join('');
      sectionsHtml += `
        <div class="print-sec">
          <div class="print-title">${item.title}</div>
          <div class="print-grid">${imgsTag}</div>
        </div>
      `;
    });

    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8">
      <style>
        @page { size: A4; margin: 15mm 12mm; }
        body { font-family: sans-serif; margin: 0; color: #111; }
        h1 { font-size: 18pt; border-bottom: 2px solid #333; padding-bottom: 8px; margin-bottom: 15px; }
        .print-sec { margin-bottom: 18px; page-break-inside: avoid; }
        .print-title { font-size: 12pt; font-weight: bold; margin-bottom: 6px; }
        .print-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        .print-grid img { width: 100%; aspect-ratio: 1/1; object-fit: cover; border: 1px solid #bbb; border-radius: 4px; }
      </style>
      </head><body>
        <h1>ใบแนบรูปภาพเบิกจ่าย</h1>
        ${sectionsHtml}
      </body></html>`;

    // 2. เชื่อมต่อ Google Drive ผ่าน Service Account
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY),
      scopes: ['https://www.googleapis.com/auth/drive'],
    });
    const drive = google.drive({ version: 'v3', auth });

    // แปลง String เป็น Stream สำหรับอัปโหลด
    const bufferStream = new stream.PassThrough();
    bufferStream.end(Buffer.from(fullHtml, 'utf-8'));

    const fileName = `เบิกจ่าย_${new Date().toISOString().slice(0,10)}_${Date.now().toString().slice(-4)}.html`;

    const driveRes = await drive.files.create({
      requestBody: {
        name: fileName,
        mimeType: 'text/html',
        parents: [process.env.DRIVE_FOLDER_ID], // โฟลเดอร์ Download ของคุณ
      },
      media: {
        mimeType: 'text/html',
        body: bufferStream,
      },
      fields: 'id, webViewLink',
    });

    return res.status(200).json({ success: true, url: driveRes.data.webViewLink });

  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
}