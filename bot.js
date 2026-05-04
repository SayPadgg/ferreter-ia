import express from "express";
import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";

import P from "pino";
import qrcode from "qrcode-terminal";

const app = express();
const PORT = process.env.PORT || 10000;

app.get("/", (req, res) => {
    res.send("Bot de WhatsApp activo ✅");
});

app.listen(PORT, () => {
    console.log(`🌐 Servidor web activo en puerto ${PORT}`);
    startBot(); // 👈 IMPORTANTE AQUÍ
});

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth");

    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: P({ level: "silent" })
    });

    sock.ev.on("creds.update", saveCreds);

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

        if (text.toLowerCase() === "hola") {
            await sock.sendMessage(msg.key.remoteJid, {
                text: "Hola 👋"
            });
        }
    });
}