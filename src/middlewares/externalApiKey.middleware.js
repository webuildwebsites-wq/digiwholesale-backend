export const validateExternalApiKey = (req, res, next) => {
  const key = req.headers["x-retailer-api-key"];

  if (!key) {
    return res.status(401).json({
      success: false,
      message: "API key missing. Include x-retailer-api-key header.",
    });
  }

  const expectedKey = process.env.EXTERNAL_API_KEY;
  if (!expectedKey) {
    console.error("FATAL: EXTERNAL_API_KEY is not set in .env");
    return res.status(500).json({
      success: false,
      message: "Server configuration error.",
    });
  }

  if (key !== expectedKey) {
    return res.status(403).json({
      success: false,
      message: "Invalid API key.",
    });
  }

  next();
};
