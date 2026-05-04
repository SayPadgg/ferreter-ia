import express from "express";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import fs from "fs";

import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";

import P from "pino";
import qrcode from "qrcode-terminal";

dotenv.config();

// =======================
// IA (GROQ)
// =======================
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const systemPrompt = fs.readFileSync("prompt.txt", "utf-8");

async function askAI(message) {
    const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
            {
                role: "system",
                content: systemPrompt
            },
            {
                role: "user",
                content: message
            }
        ]
    });

    return completion.choices[0].message.content;
}

// =======================
// EXPRESS (Render stable)
// =======================
const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
    res.send("Bot de WhatsApp activo con IA 🤖");
});

// =======================
// WHATSAPP BOT
// =======================
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth");

    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: P({ level: "silent" })
    });

    // guardar sesión
    sock.ev.on("creds.update", saveCreds);

    // conexión
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("📱 Escanea este QR:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === "open") {
            console.log("✅ Bot conectado correctamente");
        }

        if (connection === "close") {
            const shouldReconnect =
                lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;

            console.log("🔁 Reconectando:", shouldReconnect);

            if (shouldReconnect) startBot();
        }
    });

    // mensajes
    sock.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0];

        if (!msg.message) return;
        if (msg.key?.remoteJid === "status@broadcast") return;
        if (msg.key.fromMe) return;

        const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            msg.message.videoMessage?.caption;

        if (!text) return;

        console.log("📩 Mensaje:", text);

        try {
            const response = await askAI(text);

            await sock.sendMessage(msg.key.remoteJid, {
                text: response
            });

        } catch (err) {
            console.error("❌ Error IA:", err);

            await sock.sendMessage(msg.key.remoteJid, {
                text: "Hubo un error procesando tu mensaje 🤖"
            });
        }
    });
}

// =======================
// START SERVER + BOT
// =======================
app.listen(PORT, () => {
    console.log(`🌐 Servidor web activo en puerto ${PORT}`);
    startBot();
});