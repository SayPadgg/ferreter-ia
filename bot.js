import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import Groq from "groq-sdk";

import makeWASocket, {
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    DisconnectReason
} from "@whiskeysockets/baileys";

import P from "pino";
import qrcode from "qrcode-terminal";

import { obtenerInventario } from "./services/sheetsService.js";
import { detectarIntencion } from "./services/aiRouter.js";
import { normalizarTexto } from "./utils/text.js";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const prompt = fs.readFileSync("./prompt.txt", "utf-8");

// =========================
// LOG + SEND
// =========================
async function sendAndLog(sock, userId, message) {
    console.log("🤖 RESPUESTA BOT:");
    console.log(message.text || message);

    return sock.sendMessage(userId, message);
}

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

        const decision = await detectarIntencion(text);

        console.log("🧠 INTENCIÓN:", decision);

        // =========================
        // CHAT
        // =========================
        if (decision.type === "chat") {

            const res = await groq.chat.completions.create({
                model: "llama-3.1-8b-instant",
                messages: [
                    { role: "system", content: prompt },
                    { role: "user", content: text }
                ],
                temperature: 0.3
            });

            const reply = res.choices[0].message.content;

            await sendAndLog(sock, userId, { text: reply });

            return;
        }

        // =========================
        // MATERIAL SEARCH FIXED
        // =========================
        if (decision.type === "material") {

            const inventario = await obtenerInventario();

            const materiales = decision.materials || [];

            const materialesNorm = [...new Set(
                materiales.map(m => normalizarTexto(m))
            )];

            console.log("🔎 Buscando:", materialesNorm);

            let reply = "";
            let totalGlobal = 0;

            for (const mat of materialesNorm) {

                // 🔥 FIX IMPORTANTE: NO cruzar materiales entre sí
                const resultados = inventario.filter(i => {

                    const prod = normalizarTexto(i.Producto || "");

                   return (
                        prod.includes(mat) ||
                        mat.includes(prod) ||
                        prod.split(" ").some(w => mat.includes(w)) ||
                        mat.split(" ").some(w => prod.includes(w))
                    );
                });

                console.log(`📦 ${mat} → ${resultados.length}`);

                if (resultados.length === 0) {
                    reply += `\n❌ ${mat.toUpperCase()}\nNo encontrado en inventario 🔧\n`;
                    continue;
                }

                totalGlobal += resultados.length;

                reply += `\n━━━━━━━━━━━━━━━\n`;
                reply += `📦 ${mat.toUpperCase()}\n`;
                reply += `━━━━━━━━━━━━━━━\n\n`;

                const conStock = resultados.filter(p => (p.StockSucursal1 || 0) > 0);
                const sinStock = resultados.filter(p => (p.StockSucursal1 || 0) <= 0);

                if (conStock.length > 0) {

                    reply += `🟢 DISPONIBLES:\n\n`;

                    conStock.forEach(p => {
                        reply += `📦 ${p.Producto}
💰 $${p.Precio}
📊 Stock: ${p.StockSucursal1 || 0}

`;
                    });
                }

                if (sinStock.length > 0) {

                    reply += `⚠️ SIN STOCK:\n\n`;

                    sinStock.forEach(p => {
                        reply += `📦 ${p.Producto}
💰 $${p.Precio}
📊 0 unidades ❌

`;
                    });
                }
            }

            if (totalGlobal === 0) {

                await sendAndLog(sock, userId, {
                    text: "No encontré ninguno de los productos solicitados 🔧"
                });

                return;
            }

            await sendAndLog(sock, userId, { text: reply });

            return;
        }

    });
}

startBot();