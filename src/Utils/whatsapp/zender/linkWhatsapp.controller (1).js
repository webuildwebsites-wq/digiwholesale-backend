const axios = require("axios");
const StoreModel = require("../models/Store.model");

// const WA_API_BASE = "https://srv992111.hstgr.cloud/api";
const WA_API_BASE = "https://zendertesting.digibysr.in/api";

// ─── Helper: pick the right credential block based on type ───────────────────
// type: "utility" | "promotion"
const getCredentials = (store, type = "utility") => {
  return store?.whatsapp?.[type]?.credentials?.non_meta || null;
};

// ─── Helper: get apiKey from store ───────────────────────────────────────────
const getApiKey = (store, type = "utility") => {
  return getCredentials(store, type)?.apiKey || null;
};

// ─── Helper: get stored unique from store ────────────────────────────────────
const getUnique = (store, type = "utility") => {
  return getCredentials(store, type)?.unique || null;
};

// ─── Helper: save unique back to the store collection ───────────────────────
const saveUnique = async (storeNumber, unique, type = "utility") => {
  const field = `whatsapp.${type}.credentials.non_meta.unique`;

  await StoreModel.findOneAndUpdate(
    { storeNumber: storeNumber }, // match by storeNumber
    {
      $set: { [field]: unique },
    }
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Generate new WhatsApp QR code link
// GET /api/whatsapp/qr?type=utility   (type defaults to "utility")
// ─────────────────────────────────────────────────────────────────────────────
exports.generateQRCode = async (req, res) => {
  try {
    const store = req.store;
    const type = req.query.type === "promotion" ? "promotion" : "utility";

    const apiKey = getApiKey(store, type);

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: `No API key configured for ${type} WhatsApp.`,
      });
    }

    const response = await axios.get(`${WA_API_BASE}/create/wa.link`, {
      params: { secret: apiKey },
    });

    const data = response.data;


    if (!data?.data?.qrimagelink) {
      if (data?.message?.includes("maximum allowed")) {
        return res.status(400).json({
          success: false,
          message: "Maximum WhatsApp accounts reached for your plan.",
        });
      }

      return res.status(400).json({
        success: false,
        message: data?.message || "Could not generate QR code. Please try again.",
      });
    }

    // Extract token from infolink
    const token = data.data.infolink?.split("token=")[1] || null;

    return res.status(200).json({
      success: true,
      message: "QR code generated successfully",
      qrimagelink: data.data.qrimagelink,
      qrstring: data.data.qrstring,
      token,
      type,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Check if WhatsApp device is connected
// GET /api/whatsapp/status?token=xxx&type=utility
// ─────────────────────────────────────────────────────────────────────────────
exports.checkConnectionStatus = async (req, res) => {
  try {
    const store = req.store;
    const { token } = req.query;
    const type = req.query.type === "promotion" ? "promotion" : "utility";

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Token is required",
      });
    }

    const apiKey = getApiKey(store, type);

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: `No API key configured for ${type} WhatsApp.`,
      });
    }

    const response = await axios.get(`${WA_API_BASE}/get/wa.info`, {
      params: { token },
    });

    const data = response.data;

    if (data?.status !== 200) {
      return res.status(200).json({
        success: true,
        connected: false,
        message: "Device not connected yet. Please scan the QR code.",
      });
    }

    // Save unique back to store's non_meta credentials
    if (data?.data?.unique) {
      await saveUnique(store.storeNumber, data.data.unique, type);
    }

    return res.status(200).json({
      success: true,
      connected: true,
      message: "WhatsApp device connected successfully",
      phone: data.data?.wid?.split(":")[0] || null,
      type,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Relink existing WhatsApp account
// GET /api/whatsapp/relink?type=utility
// ─────────────────────────────────────────────────────────────────────────────
exports.relinkAccount = async (req, res) => {
  try {
    const store = req.store;
    const type = req.query.type === "promotion" ? "promotion" : "utility";

    const apiKey = getApiKey(store, type);
    const unique = getUnique(store, type);

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: `No API key configured for ${type} WhatsApp. Please add it in store settings.`,
      });
    }

    if (!unique) {
      return res.status(400).json({
        success: false,
        message: "No linked WhatsApp account found. Please link a new account first.",
      });
    }

    const response = await axios.get(`${WA_API_BASE}/create/wa.relink`, {
      params: { secret: apiKey, unique },
    });

    const data = response.data;

    // Already connected — no QR needed
    if (data?.data?.connection_status === "connected" && data?.data?.already_connected) {
      return res.status(200).json({
        success: true,
        already_connected: true,
        connected: true,
        message: "WhatsApp account is already connected",
        phone: data.data?.wid?.split(":")[0] || null,
        type,
      });
    }

    // QR required for relink
    if (data?.data?.qrimagelink) {
      return res.status(200).json({
        success: true,
        already_connected: false,
        connected: false,
        message: "Please scan the QR code to relink your WhatsApp account",
        qrimagelink: data.data.qrimagelink,
        qrstring: data.data.qrstring,
        phone: data.data?.wid?.split(":")[0] || null,
        type,
      });
    }

    return res.status(400).json({
      success: false,
      message: "Could not get relink QR code. Please try again.",
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



// ─────────────────────────────────────────────────────────────────────────────
// Remove/disconnect linked WhatsApp account
// DELETE /api/whatsapp/remove?type=utility
// ─────────────────────────────────────────────────────────────────────────────
exports.removeAccount = async (req, res) => {
  try {
    const store = req.store;
    const type = req.query.type === "promotion" ? "promotion" : "utility";

    const apiKey = getApiKey(store, type);
    const unique = getUnique(store, type);

    if (!apiKey) {
      return res.status(400).json({
        success: false,
        message: `No API key configured for ${type} WhatsApp.`,
      });
    }

    if (!unique) {
      return res.status(400).json({
        success: false,
        message: "No linked WhatsApp account found to remove.",
      });
    }

    const response = await axios.get(`${WA_API_BASE}/delete/wa.account`, {
      params: { secret: apiKey, unique },
    });

    const data = response.data;

    // NOTE: adjust this check once you confirm the exact success/failure shape
    // this endpoint returns — currently assuming a truthy 2xx axios response
    // without an explicit failure flag means success.
    if (data?.success === false || data?.status === false) {
      return res.status(400).json({
        success: false,
        message: data?.message || "Could not remove WhatsApp account. Please try again.",
      });
    }

    // Clear stored unique so the store shows as disconnected
    await saveUnique(store.storeNumber, null, type);

    return res.status(200).json({
      success: true,
      message: "WhatsApp account removed successfully",
      type,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};



// ─── helper ───────────────────────────────────────────────────────────────────
// Calls /api/qrCodeLink which returns an image URL (used by the React QR display)
// Returns: { isLoggedIn, connectedNumeber, profileName, qrimagelink, data }
// const fetchQrCodeLink = (token) =>
//   axios.get("https://enotify.app/api/qrCodeLink", { params: { token } });


// ─── generateQRCode  (GET /whatsapp/qr) ───────────────────────────────────────
// exports.generateQRCode = async (req, res) => {
//   try {
//     const store = req.store;
//     const type  = req.query.type === "promotion" ? "promotion" : "utility";
//     const apiKey = getApiKey(store, type);          // ← your existing helper

//     if (!apiKey) {
//       return res.status(400).json({
//         success: false,
//         message: `No API key configured for ${type} WhatsApp.`,
//       });
//     }

//     const { data } = await fetchQrCodeLink(apiKey);

//     console.log("data => ", data.data.isLoggedIn)

//     if (!data) {
//       return res.status(400).json({ success: false, message: "Invalid response from WhatsApp service." });
//     }

//     // Already logged-in — tell the front-end so it can skip the QR step
//     if (data.data.isLoggedIn) {
//       return res.status(200).json({
//         success:   true,
//         connected: true,
//         phone:     data.connectedNumeber || null,
//         name:      data.profileName      || null,
//         message:   "WhatsApp already connected",
//         type,
//       });
//     }

//     // QR image URL available — React renders it with <img src={qrimagelink}>
//     if (data.data) {
//       return res.status(200).json({
//         success:      true,
//         connected:    false,
//         qrimagelink:  data.data,   // ← field the React page expects
//         message:      "Scan QR to connect",
//         token:        apiKey,             // ← React stores this for /status polling
//         type,
//       });
//     }

//     return res.status(400).json({ success: false, message: "Unable to generate QR." });

//   } catch (error) {
//     return res.status(500).json({ success: false, message: error.response?.data || error.message });
//   }
// };


// ─── checkConnectionStatus  (GET /whatsapp/status?token=...) ──────────────────
// React polls this every 10 s after QR is shown
// exports.checkConnectionStatus = async (req, res) => {
//   try {
//     const store  = req.store;
//     const type   = req.query.type === "promotion" ? "promotion" : "utility";
//     const apiKey = getApiKey(store, type);

//     if (!apiKey) {
//       return res.status(400).json({ success: false, message: `No API key configured for ${type} WhatsApp.` });
//     }

//     const { data } = await fetchQrCodeLink(apiKey);

//     console.log("Check status => ", data);

//     // isLoggedIn is the only reliable "connected" signal in this API
//     if (data?.isLoggedIn) {
//       return res.status(200).json({
//         success:   true,
//         connected: true,
//         phone:     data.connectedNumeber || null,
//         message:   "WhatsApp connected",
//         type,
//       });
//     }

//     return res.status(200).json({
//       success:   true,
//       connected: false,
//       message:   "Not connected yet. Please scan the QR.",
//       type,
//     });

//   } catch (error) {
//     return res.status(500).json({ success: false, message: error.message });
//   }
// };


// ─── relinkAccount  (GET /whatsapp/relink) ────────────────────────────────────
// exports.relinkAccount = async (req, res) => {
//   try {
//     const store  = req.store;
//     const type   = req.query.type === "promotion" ? "promotion" : "utility";
//     const apiKey = getApiKey(store, type);

//     if (!apiKey) {
//       return res.status(400).json({ success: false, message: `No API key configured for ${type} WhatsApp.` });
//     }

//     const { data } = await fetchQrCodeLink(apiKey);

//     if (!data) {
//       return res.status(400).json({ success: false, message: "Invalid response from WhatsApp service." });
//     }

//     // Already connected — no QR needed
//     if (data.isLoggedIn) {
//       return res.status(200).json({
//         success:           true,
//         connected:         true,
//         already_connected: true,
//         phone:             data.connectedNumeber || null,
//         message:           "Already connected",
//         type,
//       });
//     }

//     // Return QR image URL for relink
//     if (data.qrimagelink) {
//       return res.status(200).json({
//         success:           true,
//         connected:         false,
//         already_connected: false,
//         qrimagelink:       data.qrimagelink,   // ← field the React page expects
//         message:           "Scan QR to relink",
//         type,
//       });
//     }

//     return res.status(400).json({ success: false, message: "Unable to get relink QR." });

//   } catch (error) {
//     return res.status(500).json({ success: false, message: error.message });
//   }
// };