
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      error: 'Method not allowed.'
    });
  }

  return res.status(410).json({
    received: false,
    error: 'This payment callback is temporarily unavailable.'
});
}
