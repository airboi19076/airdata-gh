
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({
      success: false,
      error: "Method not allowed"
    });
  }

  const apiKey = process.env.KINGFLEXY_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      success: false,
      error: "KiNG FLEXY API key is missing"
    });
  }

  try {
    const response = await fetch(
      "https://api.kingflexygh.com/api/v2/packages",
      {
        headers: {
          Authorization: apiKey,
          Accept: "application/json"
        }
      }
    );

    const result = await response.json();

    if (!response.ok || result.success === false) {
      return res.status(response.status).json({
        success: false,
        error: result.error?.message || "KiNG FLEXY request failed"
      });
    }

    return res.status(200).json(result);

  } catch (error) {
    console.error("KiNG FLEXY error:", error.message);

    return res.status(502).json({
      success: false,
      error: "Unable to connect to KiNG FLEXY"
    });
  }
}
