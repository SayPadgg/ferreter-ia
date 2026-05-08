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

    sock.ev.on("connection.update", (update) => {

        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("📱 ESCANEA ESTE QR:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === "open") {
            console.log("✅ Bot conectado correctamente");
        }

        if (connection === "close") {

            const code = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = code !== DisconnectReason.loggedOut;

            console.log("🔁 Reconectando:", shouldReconnect);

            if (shouldReconnect) {
                setTimeout(startBot, 5000);
            }
        }
    });

    sock.ev.on("messages.upsert", async ({ messages }) => {

        const msg = messages[0];
        if (!msg.message || msg.key.fromMe) return;

        const text =
            msg.message.conversation ||
            msg.message.extendedTextMessage?.text ||
            msg.message.imageMessage?.caption ||
            "";

        const userId = msg.key.remoteJid;

        console.log("📩 Mensaje:", text);

        const inventario = await obtenerInventario();

        let materiales = await detectarMaterialesIA(text);

        console.log("🔍 IA detectó:", materiales);

        // 🔥 FILTRO REAL CONTRA INVENTARIO
        const inventarioNormalizado = inventario.map(i => ({
            ...i,
            norm: normalizarTexto(i.Producto || "")
        }));

        const materialesValidos = materiales.filter(m =>
            inventarioNormalizado.some(i =>
                i.norm.includes(normalizarTexto(m))
            )
        );

        console.log("✅ Materiales válidos:", materialesValidos);

        // =========================
        // SI HAY RESULTADOS
        // =========================
        if (materialesValidos.length > 0) {

            for (const material of materialesValidos) {

                const matNorm = normalizarTexto(material);

                const resultados = inventario.filter(i =>
                    normalizarTexto(i.Producto || "").includes(matNorm)
                );

                let reply = `📌 Resultados para "${material}"\n\n`;

                resultados.forEach(p => {
                    reply += `📦 ${p.Producto}
💰 $${p.Precio}
📊 Stock: ${p.StockSucursal1 || 0}

`;
                });

                await sock.sendMessage(userId, { text: reply });
            }

            return;
        }

        // =========================
        // SI NO HAY MATERIAL
        // =========================
        await sock.sendMessage(userId, {
            text: "Hola 👋 dime qué material necesitas de ferretería"
        });
    });
}

startBot();