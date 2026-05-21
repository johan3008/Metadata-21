var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_dotenv = __toESM(require("dotenv"), 1);
import_dotenv.default.config();
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use(import_express.default.json({ limit: "50mb" }));
  app.use(import_express.default.urlencoded({ limit: "50mb", extended: true }));
  app.post("/api/proxy/gemini", async (req, res) => {
    const { model, key, payload } = req.body;
    const modelName = model || "gemini-2.0-flash";
    const apiKey = String(key || "").trim();
    console.log(`[PROXY] Gemini Request: model=${modelName}, hasKey=${!!apiKey}`);
    if (!apiKey) {
      return res.status(400).json({ error: { message: "API Key Gemini kosong atau tidak valid" } });
    }
    if (apiKey.length < 10) {
      return res.status(400).json({ error: { message: "Format API Key Gemini terlalu pendek / tidak sahih" } });
    }
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      console.log(`[PROXY] Gemini Downstream Status: ${response.status}`);
      let rawText = "";
      try {
        rawText = await response.text();
      } catch (e) {
        rawText = "";
      }
      let data = {};
      let parseOk = false;
      if (rawText) {
        try {
          data = JSON.parse(rawText);
          parseOk = true;
        } catch (_) {
        }
      }
      if (!response.ok) {
        console.error("[PROXY] Gemini Downstream Error Response Status:", response.status);
        if (parseOk) {
          console.error("[PROXY] parsed error:", JSON.stringify(data));
        } else {
          console.error("[PROXY] raw error text:", rawText);
        }
        let errMsg = "Terjadi kesalahan pada Google API";
        if (data?.error?.message) {
          errMsg = data.error.message;
        } else if (typeof data?.error === "string") {
          errMsg = data.error;
        } else if (rawText) {
          errMsg = rawText.slice(0, 300);
        } else {
          errMsg = `HTTP Error Code: ${response.status}`;
        }
        if (response.status === 400) {
          if (errMsg.toLowerCase().includes("key") || errMsg.toLowerCase().includes("not valid") || errMsg.toLowerCase().includes("invalid")) {
            errMsg = `Kunci API tidak valid (API Key Salah). Mohon periksa kembali Kunci Gemini Anda dari Google AI Studio!`;
          } else {
            errMsg = `Bad Request (400): ${errMsg}`;
          }
        } else if (response.status === 403) {
          if (errMsg.toLowerCase().includes("location") || errMsg.toLowerCase().includes("not supported") || errMsg.toLowerCase().includes("region")) {
            errMsg = `Wilayah IP server saat ini tidak didukung oleh model "${modelName}". Silakan ganti model ke "gemini-1.5-flash" atau gunakan kunci cadangan lain!`;
          } else {
            errMsg = `Akses Ditolak (403 Forbidden): ${errMsg}`;
          }
        } else if (response.status === 404) {
          errMsg = `Model "${modelName}" tidak ditemukan atau dinonaktifkan di wilayah Anda (404 Not Found). Silakan pilih "gemini-1.5-flash" karena model tersebut didukung secara universal!`;
        } else if (response.status === 429) {
          errMsg = `Batas Kuota Tercapai (429 Rate Limit Meredup): ${errMsg}. Harap tunggu sebentar lalu coba lagi.`;
        }
        return res.status(response.status).json({
          error: {
            message: errMsg,
            raw: data?.error || data || rawText
          }
        });
      }
      if (parseOk) {
        return res.status(200).json(data);
      } else {
        return res.status(200).json({ customText: rawText });
      }
    } catch (error) {
      console.error("[PROXY] Gemini Network Error:", error);
      return res.status(500).json({
        error: { message: `Koneksi Jaringan Gagal: ${error?.message || "Internal server error"}` }
      });
    }
  });
  app.post("/api/proxy/groq", async (req, res) => {
    const { key, payload } = req.body;
    const apiKey = String(key || "").trim();
    console.log(`[PROXY] Groq Request: model=${payload?.model || "default"}, hasKey=${!!apiKey}`);
    if (!apiKey) {
      return res.status(400).json({ error: { message: "API Key Groq kosong atau tidak valid" } });
    }
    if (apiKey.length < 10) {
      return res.status(400).json({ error: { message: "Format API Key Groq terlalu pendek / tidak sahih" } });
    }
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });
      console.log(`[PROXY] Groq Downstream Status: ${response.status}`);
      let rawText = "";
      try {
        rawText = await response.text();
      } catch (e) {
        rawText = "";
      }
      let data = {};
      let parseOk = false;
      if (rawText) {
        try {
          data = JSON.parse(rawText);
          parseOk = true;
        } catch (_) {
        }
      }
      if (!response.ok) {
        console.error("[PROXY] Groq Downstream Error Response Status:", response.status);
        if (parseOk) {
          console.error("[PROXY] parsed error:", JSON.stringify(data));
        } else {
          console.error("[PROXY] raw error text:", rawText);
        }
        let errMsg = "Terjadi kesalahan pada Groq API";
        if (data?.error?.message) {
          errMsg = data.error.message;
        } else if (typeof data?.error === "string") {
          errMsg = data.error;
        } else if (rawText) {
          errMsg = rawText.slice(0, 300);
        } else {
          errMsg = `HTTP Error Code: ${response.status}`;
        }
        if (response.status === 401 || response.status === 403) {
          errMsg = `API Key Groq tidak valid atau Kedaluwarsa. Mohon masukkan Kunci Groq yang valid dari dashboard Groq Console!`;
        } else if (response.status === 404) {
          errMsg = `Model Groq "${payload?.model || "default"}" atau endpoint tidak ditemukan (404 Not Found). Silakan pastikan model aktif terpilih!`;
        } else if (response.status === 429) {
          errMsg = `Batas Kuota Groq Terlampaui (429 Rate Limit): ${errMsg}. Silakan tunggu sebentar atau ganti kunci!`;
        }
        return res.status(response.status).json({
          error: {
            message: errMsg,
            raw: data?.error || data || rawText
          }
        });
      }
      if (parseOk) {
        return res.status(200).json(data);
      } else {
        return res.status(200).json({ customText: rawText });
      }
    } catch (error) {
      console.error("[PROXY] Groq Network Error:", error);
      return res.status(500).json({
        error: { message: `Koneksi Jaringan Gagal: ${error?.message || "Internal server error"}` }
      });
    }
  });
  app.post("/api/proxy/mistral", async (req, res) => {
    const { key, payload } = req.body;
    const apiKey = String(key || "").trim();
    console.log(`[PROXY] Mistral Request: model=${payload?.model || "default"}, hasKey=${!!apiKey}`);
    if (!apiKey) {
      return res.status(400).json({ error: { message: "API Key Mistral kosong atau tidak valid" } });
    }
    if (apiKey.length < 10) {
      return res.status(400).json({ error: { message: "Format API Key Mistral terlalu pendek / tidak sahih" } });
    }
    try {
      const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify(payload)
      });
      console.log(`[PROXY] Mistral Downstream Status: ${response.status}`);
      let rawText = "";
      try {
        rawText = await response.text();
      } catch (e) {
        rawText = "";
      }
      let data = {};
      let parseOk = false;
      if (rawText) {
        try {
          data = JSON.parse(rawText);
          parseOk = true;
        } catch (_) {
        }
      }
      if (!response.ok) {
        console.error("[PROXY] Mistral Downstream Error Response Status:", response.status);
        if (parseOk) {
          console.error("[PROXY] parsed error:", JSON.stringify(data));
        } else {
          console.error("[PROXY] raw error text:", rawText);
        }
        let errMsg = "Terjadi kesalahan pada Mistral AI API";
        if (data?.error?.message) {
          errMsg = data.error.message;
        } else if (typeof data?.error === "string") {
          errMsg = data.error;
        } else if (rawText) {
          errMsg = rawText.slice(0, 300);
        } else {
          errMsg = `HTTP Error Code: ${response.status}`;
        }
        if (response.status === 401 || response.status === 403) {
          errMsg = `API Key Mistral tidak valid atau Kedaluwarsa. Mohon masukkan Kunci Mistral yang valid dari dashboard Mistral AI!`;
        } else if (response.status === 404) {
          errMsg = `Model Mistral "${payload?.model || "default"}" atau endpoint tidak ditemukan (404 Not Found). Silakan pastikan model aktif terpilih!`;
        } else if (response.status === 429) {
          errMsg = `Batas Kuota Mistral Terlampaui (429 Rate Limit): ${errMsg}. Silakan tunggu sebentar atau ganti kunci!`;
        }
        return res.status(response.status).json({
          error: {
            message: errMsg,
            raw: data?.error || data || rawText
          }
        });
      }
      if (parseOk) {
        return res.status(200).json(data);
      } else {
        return res.status(200).json({ customText: rawText });
      }
    } catch (error) {
      console.error("[PROXY] Mistral Network Error:", error);
      return res.status(500).json({
        error: { message: `Koneksi Jaringan Gagal: ${error?.message || "Internal server error"}` }
      });
    }
  });
  app.post("/api/generate-metadata", async (req, res) => {
    const { imageDescription } = req.body;
    if (!process.env.GROQ_API_KEY) {
      return res.status(500).json({ error: { message: "GROQ_API_KEY is not configured on server" } });
    }
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content: "Kamu AI metadata generator Adobe Stock."
            },
            {
              role: "user",
              content: imageDescription
            }
          ],
          temperature: 0.4
        })
      });
      const data = await response.json();
      if (!response.ok) {
        return res.status(response.status).json(data);
      }
      return res.status(200).json({ content: data.choices[0].message.content });
    } catch (error) {
      return res.status(500).json({ error: { message: error.message } });
    }
  });
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running internally on port ${PORT}`);
  });
}
startServer().catch((error) => {
  console.error("Failed to start full-stack server:", error);
});
//# sourceMappingURL=server.cjs.map
