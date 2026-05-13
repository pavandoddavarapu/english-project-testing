export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  const GEMINI_KEY = process.env.GEMINI_API_KEY;
  
  if (!GEMINI_KEY) {
    return res.status(200).json({ 
      status: "ERROR", 
      message: "GEMINI_API_KEY env variable is NOT SET in Vercel!" 
    });
  }

  // Mask the key for safety - show first 8 and last 4 chars
  const maskedKey = GEMINI_KEY.substring(0, 8) + "..." + GEMINI_KEY.substring(GEMINI_KEY.length - 4);

  try {
    // Try listing available models - this is the simplest API call
    const res2 = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_KEY}`
    );
    const data = await res2.json();

    if (!res2.ok) {
      return res.status(200).json({
        status: "KEY_INVALID",
        keyPreview: maskedKey,
        httpStatus: res2.status,
        error: data.error?.message || JSON.stringify(data)
      });
    }

    const modelNames = (data.models || []).map(m => m.name);
    const hasFlash = modelNames.some(n => n.includes('flash'));

    return res.status(200).json({
      status: "KEY_VALID",
      keyPreview: maskedKey,
      availableModels: modelNames,
      gemini15FlashAvailable: hasFlash
    });

  } catch (err) {
    return res.status(200).json({
      status: "FETCH_ERROR",
      keyPreview: maskedKey,
      error: err.message
    });
  }
}
