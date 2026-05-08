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
import qr from "qr-terminal";

dotenv.config();

// =======================
// IA
// =======================
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const systemPrompt = fs.readFileSync("prompt.txt", "utf-8");

const chatMemory = {};

async function askAI(userId, message) {

    if (!chatMemory[userId]) chatMemory[userId] = [];

    chatMemory[userId].push({ role: "user", content: message });

    if (chatMemory[userId].length > 10) chatMemory[userId].shift();

    const completion = await groq.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages: [
            { role: "system", content: systemPrompt },
            ...chatMemory[userId]
        ]
    });

    const reply = completion.choices[0].message.content;

    chatMemory[userId].push({ role: "assistant", content: reply });

    return reply;
}

// =======================
// EXPRESS (KEEP ALIVE BASE)
// =======================
const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (_, res) => {
    res.send("Bot activo 🤖");
});

app.listen(PORT, () => {
    console.log("🌐 Server running on", PORT);
});

// =======================
// BOT
// =======================
let restarting = false;

async function startBot() {

    const { state, saveCreds } = await useMultiFileAuthState("auth");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: P({ level: "silent" })
    });

    sock.ev.on("creds.update", saveCreds);

    // =======================
    // CONEXIÓN
    // =======================
    sock.ev.on("connection.update", (update) => {

        const { connection, lastDisconnect, qr } = update;

        if (qr) {

    console.clear();

    console.log("╔══════════════════════════════╗");
    console.log("║     ESCANEA EL QR BELOW     ║");
    console.log("╚══════════════════════════════╝");

    qr.generate(qr, {
        small: true
    });

    console.log("\n⚡ Si no se ve bien:");
    console.log("➡️ Haz zoom OUT en Render (80% o 67%)");
}

        if (connection === "open") {
            console.log("✅ Bot conectado correctamente");
            restarting = false;
        }

        if (connection === "close") {

            if (restarting) return;
            restarting = true;

            const code = lastDisconnect?.error?.output?.statusCode;

            const shouldReconnect =
                code !== DisconnectReason.loggedOut;

            console.log("🔁 Reconectando:", shouldReconnect);

            if (shouldReconnect) {
                setTimeout(() => {
                    startBot();
                }, 10000);
            }
        }
    });

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

            await sock.sendMessage(userId, { text: response });

        } catch (err) {
            console.error("❌ Error IA:", err);
        }
    });
}

startBot();