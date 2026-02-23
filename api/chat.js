const axios = require('axios');

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

  const context = buildContext(estimates || [], invoices || [], items || [], question);

  try {
    const response = await axios.post(
      'https://api.anthropic.com/v1/messages',
      {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system: `คุณเป็น AI ผู้ช่วยสำหรับธุรกิจซ่อมเรือและต่อเรือของ Chareon Marine
คุณมีข้อมูลจาก QuickBooks:

${context}

ตอบเป็นภาษาไทย กระชับ ชัดเจน ใช้ HTML table เมื่อแสดงหลายรายการ`,
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

function buildContext(estimates, invoices, items, question) {
  const q = question.toLowerCase();
  
  // Filter relevant estimates
  const filteredEst = estimates.filter(e => {
    const text = JSON.stringify(e).toLowerCase();
    return q.split(' ').some(word => word.length > 2 && text.includes(word));
  }).slice(0, 20);

  const useEst = filteredEst.length > 0 ? filteredEst : estimates.slice(0, 20);

  const estSummary = useEst.map(e => ({
    customer: e.CustomerRef?.name,
    date: e.TxnDate,
    total: e.TotalAmt,
    memo: e.CustomerMemo?.value,
    lines: e.Line?.filter(l => l.DetailType === 'SalesItemLineDetail').map(l => ({
      item: l.SalesItemLineDetail?.ItemRef?.name,
      qty: l.SalesItemLineDetail?.Qty,
      rate: l.SalesItemLineDetail?.UnitPrice,
      amount: l.Amount,
      desc: l.Description,
    })).slice(0, 8),
  }));

  const invSummary = invoices.slice(0, 20).map(i => ({
    customer: i.CustomerRef?.name,
    date: i.TxnDate,
    total: i.TotalAmt,
    lines: i.Line?.filter(l => l.DetailType === 'SalesItemLineDetail').map(l => ({
      item: l.SalesItemLineDetail?.ItemRef?.name,
      amount: l.Amount,
      desc: l.Description,
    })).slice(0, 5),
  }));

  return `ESTIMATES (${estimates.length} total, showing ${useEst.length}):
${JSON.stringify(estSummary)}

INVOICES (showing 20):
${JSON.stringify(invSummary)}

ITEMS:
${JSON.stringify(items.slice(0, 30).map(i => ({ name: i.Name, price: i.UnitPrice })))}`;
}
