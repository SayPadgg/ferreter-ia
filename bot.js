import makeWASocket, {
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} from "@whiskeysockets/baileys";

import P from "pino";
import qrcode from "qrcode-terminal";

import { obtenerInventario } from "./services/sheetsService.js";
import { detectarMaterialesIA } from "./services/aiService.js";
import { normalizarTexto, singularizar } from "./utils/text.js";

import dotenv from "dotenv";
dotenv.config();

// =======================
// BOT STATE
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
    // QR
    // =======================
    sock.ev.on("connection.update", (update) => {

        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("📱 ESCANEA ESTE QR:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === "open") {
            console.log("✅ Bot conectado correctamente");
            restarting = false;
        }

        if (connection === "close") {

            if (restarting) return;
            restarting = true;

            const code = lastDisconnect?.error?.output?.statusCode;

            const shouldReconnect = code !== DisconnectReason.loggedOut;

            console.log("🔁 Reconectando:", shouldReconnect);

            if (shouldReconnect) {
                setTimeout(startBot, 5000);
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

        const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            "";

        const userId = msg.key.remoteJid;

        console.log("📩 Mensaje:", text);

        const inventario = await obtenerInventario();
        const materiales = await detectarMaterialesIA(text);

        console.log("🔍 Productos detectados:", materiales);

        // =======================
        // SI HAY PRODUCTOS
        // =======================
        if (materiales.length > 0) {

            for (const material of materiales) {

                const matNorm = singularizar(normalizarTexto(material));

                let resultados = inventario.filter(i => {

                    const prodNorm = singularizar(
                        normalizarTexto(i.Producto || "")
                    );

                    return prodNorm.includes(matNorm);
                });

                if (resultados.length === 0) {
                    await sock.sendMessage(userId, {
                        text: `❌ No encontré "${material}" en inventario`
                    });
                    continue;
                }

                let reply = `📌 Resultados para "${material}"\n\n`;

                resultados.forEach(p => {
                    reply += `📦 ${p.Producto}
💰 $${p.Precio}
📊 Stock: ${p.StockSucursal1 || 0}

`;
                });

                await sock.sendMessage(userId, { text: reply.trim() });
            }

            return;
        }

        // =======================
        // MENSAJE NORMAL
        // =======================
        await sock.sendMessage(userId, {
            text: "Hola 👋 dime qué material necesitas"
        });
    });
}

startBot();