const axios = require("axios");
const FormData = require("form-data");


// old not using now
exports.sendWhatsappMessageUniversal = async (
  unique,
  apiKey,
  type = "text",
  recipient,
  message = "",
  mediaUrl = "",
  mediaType = "image",
  documentUrl = "",
  documentName = "document.pdf",
  documentType = "pdf",
  priority = 2
) => {
  try {
    const form = new FormData();

    // Required fields
    form.append("secret", apiKey);
    form.append("account", unique);
    form.append("recipient", recipient);
    form.append("type", type);
    form.append("message", message);
    form.append("priority", priority);

    // 🔹 MEDIA
    if (type === "media" && mediaUrl) {
      form.append("media_url", mediaUrl);      // API expects 'media_url'
      form.append("media_type", mediaType);    // Must be 'image', 'video', or 'audio'
    }

    // 🔹 DOCUMENT
    if (type === "document" && documentUrl) {
      form.append("document_url", documentUrl);      // API expects 'document_url'
      form.append("document_name", documentName);    // Must include extension
      form.append("document_type", documentType);    // 'pdf', 'doc', etc.
    }

    const response = await axios.post(
      // "https://srv992111.hstgr.cloud/api/send/whatsapp",
      "https://zendertesting.digibysr.in/api/send/whatsapp",
      form,
      {
        headers: form.getHeaders(),
        maxBodyLength: Infinity
      }
    );

    return response.data;

  } catch (error) {
    console.error(
      "WhatsApp API Error:",
      error.response?.data || error.message
    );

    return {
      success: false,
      error: error.response?.data || error.message
    };
  }
};



// exports.sendWhatsappMessageUniversal = async ({
//   token = "vgsve8grnuqwiwghi6eqm3zv",
//   recipient,
//   type = "text", // text | file | fileWithCaption
//   message = "",
//   fileUrl = ""
// }) => {
//   try {
//     let url = "";


//     // 🔹 TEXT MESSAGE
//     if (type === "text") {
//       url = `https://enotify.app/api/sendText?token=${token}&phone=${recipient}&message=${encodeURIComponent(message)}`;
//     }

//     // 🔹 FILE (image/pdf/etc)
//     else if (type === "file") {
//       url = `https://enotify.app/api/sendFiles?token=${token}&phone=${recipient}&link=${encodeURIComponent(fileUrl)}`;
//     }

//     // 🔹 FILE WITH CAPTION
//     else if (type === "fileWithCaption") {
//       url = `https://enotify.app/api/sendFileWithCaption?token=${token}&phone=${recipient}&link=${encodeURIComponent(fileUrl)}&message=${encodeURIComponent(message)}`;
//     }

//     else {
//       throw new Error("Invalid message type");
//     }

//     const response = await axios.get(url);

//     return response.data;

//   } catch (error) {
//     console.error("WhatsApp API Error:", error.response?.data || error.message);

//     return {
//       success: false,
//       error: error.response?.data || error.message
//     };
//   }
// };