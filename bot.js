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
// IA GROQ
// =======================
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const systemPrompt = fs.readFileSync("prompt.txt", "utf-8");

// memoria en RAM
const chatMemory = {};

// =======================
// FUNCIÓN IA
// =======================
async function askAI(userId, message) {

    if (!chatMemory[userId]) {
        chatMemory[userId] = [];
    }

    chatMemory[userId].push({
        role: "user",
        content: message
    });

    if (chatMemory[userId].length > 10) {
        chatMemory[userId].shift();
    }

    const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
            { role: "system", content: systemPrompt },
            ...chatMemory[userId]
        ]
    });

    const reply = completion.choices[0].message.content;

    chatMemory[userId].push({
        role: "assistant",
        content: reply
    });

    return reply;
}

// =======================
// EXPRESS SERVER
// =======================
const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
    res.send("Bot WhatsApp activo 🤖");
});

app.listen(PORT, () => {
    console.log("🌐 Servidor corriendo en puerto", PORT);
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
        logger: P({ level: "silent" }),
        keepAliveIntervalMs: 30000
    });

    // guardar sesión
    sock.ev.on("creds.update", saveCreds);

    // =======================
    // CONEXIÓN
    // =======================
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

            const statusCode = lastDisconnect?.error?.output?.statusCode;

            const shouldReconnect =
                statusCode !== DisconnectReason.loggedOut;

            console.log("🔁 Reconectando:", shouldReconnect);

            if (shouldReconnect) {
                setTimeout(() => startBot(), 5000);
            }
        }
    });

    // =======================
    // KEEP ALIVE (ANTI SLEEP)
    // =======================
    setInterval(() => {
        console.log("💓 keep alive");
    }, 60000);

    // =======================
    // MENSAJES
    // =======================
    sock.ev.on("messages.upsert", async ({ messages }) => {

        const msg = messages[0];

        if (!msg.message) return;
        if (msg.key.fromMe) return;
        if (msg.key.remoteJid === "status@broadcast") return;

        const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            msg.message.videoMessage?.caption;

        if (!text) return;

        console.log("📩 Mensaje:", text);

        try {
            const userId = msg.key.remoteJid;
            const response = await askAI(userId, text);

            await sock.sendMessage(userId, {
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

startBot();