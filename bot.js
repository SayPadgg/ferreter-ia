import dotenv from "dotenv";
dotenv.config();

import fs from "fs";
import express from "express";
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
// EXPRESS (Render Healthcheck)
// =========================
const app = express();

app.get("/", (req, res) => {
    res.send("MisopBot activo");
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`🌐 Servidor escuchando en puerto ${PORT}`);
});

// =========================
// SEND
// =========================
async function sendAndLog(sock, userId, message) {
    console.log("🤖 RESPUESTA BOT:");
    console.log(message.text || message);

    return sock.sendMessage(userId, message);
}

// =========================
// BOT START
// =========================
async function startBot() {

    const { state, saveCreds } = await useMultiFileAuthState("auth");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        auth: state,
        logger: P({ level: "silent" })
    });

    sock.ev.on("creds.update", saveCreds);

    // CONNECTION
    sock.ev.on("connection.update", (update) => {

        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("📱 ESCANEA QR:");
            qrcode.generate(qr, { small: true });
        }

        if (connection === "open") {
            console.log("✅ Bot conectado correctamente");
        }

        if (connection === "close") {

            const code = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect =
                code !== DisconnectReason.loggedOut;

            console.log("🔁 Reconectando:", shouldReconnect);

            if (shouldReconnect) {
                setTimeout(startBot, 5000);
            }
        }
    });

    // =========================
    // MESSAGES
    // =========================
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
        // MATERIAL SEARCH
        // =========================
        if (decision.type === "material") {

            const inventario = await obtenerInventario();

            const materiales = decision.materials || [];

            const materialesNorm = [
                ...new Set(
                    materiales
                        .map(m => normalizarTexto(m))
                        .filter(Boolean)
                )
            ];

            console.log("🔎 Buscando:", materialesNorm);

            let reply = "";
            let totalGlobal = 0;

            for (const mat of materialesNorm) {

                const resultados = inventario
                    .map(i => {

                        const prod = normalizarTexto(i.Producto || "");
                        const palabras = mat.split(" ");

                        let score = 0;

                        palabras.forEach(p => {
                            if (prod.includes(p)) score++;
                        });

                        return { item: i, score };
                    })
                    .filter(r => r.score > 0)
                    .sort((a, b) => b.score - a.score)
                    .map(r => r.item);

                console.log(`📦 ${mat} → ${resultados.length}`);

                if (resultados.length === 0) {

                    reply += `
❌ ${mat.toUpperCase()}
No encontrado en inventario 🔧

`;
                    continue;
                }

                totalGlobal += resultados.length;

                reply += `
━━━━━━━━━━━━━━━
📦 ${mat.toUpperCase()}
━━━━━━━━━━━━━━━

🟢 DISPONIBLES:

`;

                resultados.forEach(p => {

                    reply +=
`📦 ${p.Producto}
💰 $${p.Precio}
🏪 Sucursal 1: ${p.StockSucursal1 || 0}
🏪 Sucursal 2: ${p.StockSucursal2 || 0}

`;
                });
            }

            if (totalGlobal === 0) {

                await sendAndLog(sock, userId, {
                    text: "No encontré productos relacionados 🔧"
                });

                return;
            }

            await sendAndLog(sock, userId, { text: reply });

            return;
        }

    });
}

startBot();