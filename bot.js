const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const { obtenerInventario } = require("./services/sheetsService");
const { detectarMaterialesIA } = require("./services/aiService");
const {
    normalizarTexto,
    singularizar
} = require("./utils/text");

const client = new Client({
    authStrategy: new LocalAuth()
});

client.on("qr", qr => {
    qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
    console.log("🤖 Bot conectado");
});

client.on("message", async message => {

    const texto = message.body.trim();
    console.log("📩 Mensaje:", texto);

    const inventario = await obtenerInventario();

    // 🔥 DETECTAR PRODUCTOS (IA CONTROLADA)
    const materiales = await detectarMaterialesIA(texto);

    console.log("🔍 Detectados:", materiales);

    // =========================
    // SI HAY PRODUCTOS
    // =========================
    if (materiales.length > 0) {

        for (const material of materiales) {

            const matNorm =
                singularizar(normalizarTexto(material));

            let variantes = inventario.filter(i => {

                const prodNorm =
                    singularizar(normalizarTexto(i.Producto || ""));

                return prodNorm.includes(matNorm);
            });

            if (variantes.length === 0) {

                await message.reply(
                    `❌ No encontré "${material}" en el inventario.`
                );

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

            await message.reply(respuesta.trim());
        }

        return;
    }

    // =========================
    // SI NO HAY PRODUCTOS → IA NORMAL
    // =========================
    await message.reply("¿En qué te puedo ayudar con materiales de ferretería?");
});

client.initialize();