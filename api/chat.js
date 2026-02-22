onst axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { question, estimates, invoices, items } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'No question provided' });
  }

  const context = buildContext(estimates || [], invoices || [], items || []);

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        system: `คุณเป็น AI ผู้ช่วยสำหรับธุรกิจซ่อมเรือและต่อเรือของ Chareon Marine
คุณมีข้อมูลจาก QuickBooks ดังต่อไปนี้:

${context}

หน้าที่ของคุณ:
1. ค้นหาและแสดงข้อมูลงานเก่าตามที่ถาม
2. คำนวณราคาเฉลี่ยและสรุปข้อมูล  
3. ร่างใบเสนอราคาใหม่โดยอิงจากราคางานเก่า
4. ตอบเป็นภาษาไทย ชัดเจน กระชับ
5. ใช้ HTML table แสดงข้อมูลหลายรายการ เช่น <table><thead><tr><th>ลูกค้า</th><th>งาน</th><th>ราคา</th><th>วันที่</th></tr></thead><tbody>...</tbody></table>
6. เมื่อร่างใบเสนอราคา ให้แสดงรายละเอียดครบถ้วน`,
        messages: [{ role: 'user', content: question }],
      },
      {
        headers: {
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json',
        },
      }
    );

    res.status(200).json({
      reply: response.data.content?.[0]?.text || 'ไม่ได้รับการตอบกลับ',
    });

  } catch (err) {
    console.error('Claude error:', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
};

function buildContext(estimates, invoices, items) {
  const estSummary = estimates.slice(0, 50).map(e => ({
    id: e.Id,
    customer: e.CustomerRef?.name,
    date: e.TxnDate,
    total: e.TotalAmt,
    status: e.TxnStatus,
    memo: e.CustomerMemo?.value,
    lines: e.Line?.filter(l => l.DetailType === 'SalesItemLineDetail').map(l => ({
      item: l.SalesItemLineDetail?.ItemRef?.name,
      qty: l.SalesItemLineDetail?.Qty,
      rate: l.SalesItemLineDetail?.UnitPrice,
      amount: l.Amount,
      desc: l.Description,
    })),
  }));

  const invSummary = invoices.slice(0, 50).map(i => ({
    id: i.Id,
    customer: i.CustomerRef?.name,
    date: i.TxnDate,
    total: i.TotalAmt,
    balance: i.Balance,
    lines: i.Line?.filter(l => l.DetailType === 'SalesItemLineDetail').map(l => ({
      item: l.SalesItemLineDetail?.ItemRef?.name,
      amount: l.Amount,
      desc: l.Description,
    })),
  }));

  return `
=== ESTIMATES จำนวน ${estimates.length} รายการ ===
${JSON.stringify(estSummary, null, 2)}

=== INVOICES จำนวน ${invoices.length} รายการ ===
${JSON.stringify(invSummary, null, 2)}

=== ITEMS จำนวน ${items.length} รายการ ===
${JSON.stringify(items.map(i => ({ name: i.Name, type: i.Type, price: i.UnitPrice })), null, 2)}
`;
}
