const axios = require('axios');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { access_token, refresh_token, realm_id } = req.body;

  if (!access_token || !realm_id) {
    return res.status(400).json({ error: 'Missing credentials' });
  }

  const QB_BASE = `https://quickbooks.api.intuit.com/v3/company/${realm_id}`;

  const qbGet = async (query, token) => {
    const response = await axios.get(
      `${QB_BASE}/query?query=${encodeURIComponent(query)}&minorversion=65`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/json',
        },
      }
    );
    return response.data;
  };

  try {
    let token = access_token;

    // Try to refresh if needed
    const refreshIfNeeded = async () => {
      const credentials = Buffer.from(
        `${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`
      ).toString('base64');

      const response = await axios.post(
        'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
        new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: refresh_token,
        }).toString(),
        {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        }
      );
      return response.data.access_token;
    };

    // Fetch all data
    let estimates, invoices, items;

    try {
      const [estData, invData, itemData] = await Promise.all([
        qbGet('SELECT * FROM Estimate MAXRESULTS 200', token),
        qbGet('SELECT * FROM Invoice MAXRESULTS 200', token),
        qbGet('SELECT * FROM Item MAXRESULTS 200', token),
      ]);

      estimates = estData?.QueryResponse?.Estimate || [];
      invoices = invData?.QueryResponse?.Invoice || [];
      items = itemData?.QueryResponse?.Item || [];

    } catch (err) {
      if (err.response?.status === 401) {
        token = await refreshIfNeeded();
        const [estData, invData, itemData] = await Promise.all([
          qbGet('SELECT * FROM Estimate MAXRESULTS 200', token),
          qbGet('SELECT * FROM Invoice MAXRESULTS 200', token),
          qbGet('SELECT * FROM Item MAXRESULTS 200', token),
        ]);
        estimates = estData?.QueryResponse?.Estimate || [];
        invoices = invData?.QueryResponse?.Invoice || [];
        items = itemData?.QueryResponse?.Item || [];
      } else {
        throw err;
      }
    }

    res.status(200).json({
      success: true,
      new_token: token !== access_token ? token : null,
      estimates,
      invoices,
      items,
      synced_at: new Date().toISOString(),
    });

  } catch (err) {
    console.error('Sync error:', err.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
};
