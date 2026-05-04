import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    fetchLatestBaileysVersion
} from "@whiskeysockets/baileys";

import P from "pino";
import qrcode from "qrcode-terminal";

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

    // conexión + QR
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

    // 🔴 filtrar basura
    if (!msg.message) return;
    if (msg.key?.remoteJid === "status@broadcast") return;
    if (msg.key.fromMe) return;

    const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption;

    if (!text) return; // 👈 clave para eliminar undefined

    console.log("📩 Mensaje:", text);

    if (text.toLowerCase() === "hola") {
        await sock.sendMessage(msg.key.remoteJid, {
            text: "Hola 👋"
        });
    }
});
}

startBot();