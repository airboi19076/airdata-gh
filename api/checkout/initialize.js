
const RETAIL_PRICES = {
  MTN: {
    1: 475, 2: 950, 3: 1425, 4: 1900, 5: 2375,
    6: 2850, 8: 3800, 10: 4750, 15: 7125,
    20: 9300, 25: 11625, 30: 13950, 40: 18600,
    50: 23250
  },

  'AirtelTigo iShare': {
    1: 430, 2: 860, 3: 1290, 4: 1720, 5: 2150,
    6: 2580, 7: 3010, 8: 3440, 10: 4300,
    15: 6450, 20: 8600
  },

  'AirtelTigo BigTime': {
    20: 7400, 25: 7900, 30: 8400, 40: 9900,
    50: 10900, 100: 17900, 200: 32300, 250: 41600
  },

  Telecel: {
    10: 4200, 15: 6300, 20: 8400, 25: 10500,
    30: 12600, 40: 16800, 50: 21000
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');

    return res.status(405).json({
      error: 'Method not allowed.'
    });
  }

  const network = String(req.body?.network || '').trim();
  const volume = Number(req.body?.volume_gb);
  const recipient = String(req.body?.recipient || '').trim();

  if (!RETAIL_PRICES[network]) {
    return res.status(400).json({
      error: 'Please select a valid network.'
    });
  }

  if (
    !Number.isInteger(volume) ||
    !RETAIL_PRICES[network][volume]
  ) {
    return res.status(400).json({
      error: 'The selected data bundle is not available.'
    });
  }

  if (!/^0\d{9}$/.test(recipient)) {
    return res.status(400).json({
      error: 'Enter a valid 10-digit Ghana phone number.'
    });
  }

  return res.status(503).json({
    success: false,
    error: 'Payments are temporarily unavailable while AirData GH updates its payment system. Please try again later.'
  });
}
