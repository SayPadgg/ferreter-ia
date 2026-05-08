import makeWASocket, {
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} from "@whiskeysockets/baileys";

import pino from "pino";
import dotenv from "dotenv";

import { obtenerInventario } from "./services/sheetsService.js";
import { detectarMaterialesIA } from "./services/aiService.js";
import { normalizarTexto, singularizar } from "./utils/text.js";

dotenv.config();

// =======================
// BOT
// =======================
async function startBot() {

    const { state, saveCreds } = await useMultiFileAuthState("auth");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: pino({ level: "silent" })
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", (update) => {

        const { connection, lastDisconnect } = update;

        if (connection === "open") {
            console.log("🤖 Bot conectado correctamente");
        }

        if (connection === "close") {

            const code = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = code !== DisconnectReason.loggedOut;

            console.log("🔁 Reconectando:", shouldReconnect);

            if (shouldReconnect) startBot();
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
            msg.message.imageMessage?.caption;

        if (!text) return;

        console.log("📩 Mensaje:", text);

        const inventario = await obtenerInventario();
        const materiales = await detectarMaterialesIA(text);

        console.log("🔍 Detectados:", materiales);

        if (materiales.length > 0) {

            for (const material of materiales) {

                const matNorm = singularizar(normalizarTexto(material));

                let variantes = inventario.filter(i => {

                    const prodNorm = singularizar(
                        normalizarTexto(i.Producto || "")
                    );

                    return prodNorm.includes(matNorm);
                });

                if (variantes.length === 0) {

                    await sock.sendMessage(msg.key.remoteJid, {
                        text: `❌ No encontré "${material}" en el inventario.`
                    });

                    continue;
                }

                let respuesta = `📌 Resultados para "${material}"\n\n`;

                variantes.forEach(item => {

                    respuesta +=
`📦 ${item.Producto}
💰 Precio: $${item.Precio}
📊 Stock: ${item.StockSucursal1 || 0}

`;
                });

                await sock.sendMessage(msg.key.remoteJid, {
                    text: respuesta.trim()
                });
            }

            return;
        }

        await sock.sendMessage(msg.key.remoteJid, {
            text: "¿En qué te puedo ayudar con materiales de ferretería?"
        });
    });
}

startBot();