const axios = require('axios');

module.exports = async (req, res) => {
  const { code, realmId, error } = req.query;

  if (error) {
    return res.redirect('/?error=' + error);
  }

  if (!code) {
    return res.status(400).json({ error: 'No code provided' });
  }

  try {
    const credentials = Buffer.from(
      `${process.env.QB_CLIENT_ID}:${process.env.QB_CLIENT_SECRET}`
    ).toString('base64');

    const response = await axios.post(
      'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer',
      new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: process.env.QB_REDIRECT_URI,
      }).toString(),
      {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
      }
    );

    const { access_token, refresh_token } = response.data;

    // Redirect back to app with tokens
    const params = new URLSearchParams({
      access_token,
      refresh_token,
      realm_id: realmId,
    });

    res.redirect(`/?${params.toString()}`);
  } catch (err) {
    console.error('OAuth error:', err.response?.data || err.message);
    res.redirect('/?error=oauth_failed');
  }
};
