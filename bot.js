import express from "express";
import dotenv from "dotenv";
import Groq from "groq-sdk";
import fs from "fs";

import makeWASocket, {
    fetchLatestBaileysVersion,
    DisconnectReason,
    initAuthCreds,
    BufferJSON
} from "@whiskeysockets/baileys";

import P from "pino";
import qrcode from "qrcode-terminal";

import { initializeApp } from "firebase/app";
import { getDatabase, ref, set, get } from "firebase/database";

dotenv.config();

// =======================
// FIREBASE CONFIG
// =======================
const firebaseConfig = {
    apiKey: process.env.FIREBASE_API_KEY,
    authDomain: process.env.FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.FIREBASE_DB_URL,
    projectId: process.env.FIREBASE_PROJECT_ID,
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getDatabase(firebaseApp);

// guardar sesión
async function saveSession(data) {
    await set(ref(db, "baileys/session"), JSON.parse(JSON.stringify(data, BufferJSON.replacer)));
}

// cargar sesión
async function loadSession() {
    const snapshot = await get(ref(db, "baileys/session"));
    return snapshot.exists()
        ? JSON.parse(JSON.stringify(snapshot.val()), BufferJSON.reviver)
        : null;
}

// =======================
// GROQ IA
// =======================
const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const systemPrompt = fs.readFileSync("prompt.txt", "utf-8");

// memoria IA
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
// EXPRESS
// =======================
const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
    res.send("Bot activo 🤖");
});

app.listen(PORT, () => {
    console.log("🌐 Servidor en puerto", PORT);
});

// =======================
// BOT WHATSAPP
// =======================
async function startBot() {

    let creds = await loadSession();

    if (!creds) {
        creds = initAuthCreds();
        console.log("🆕 Nueva sesión creada (primera vez)");
    } else {
        console.log("♻️ Sesión cargada desde Firebase");
    }

    const state = {
        creds,
        keys: {
            get: async () => ({}),
            set: async () => {}
        }
    };

    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: P({ level: "silent" })
    });

    // guardar sesión en Firebase cada cambio
    sock.ev.on("creds.update", async () => {
        await saveSession(state.creds);
        console.log("💾 Sesión guardada en Firebase");
    });

    // conexión
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("📱 Escanea este QR:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === "open") {
            console.log("✅ Bot conectado");
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