const { Client, LocalAuth } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const { obtenerInventario } = require("./services/sheets");
const {
    detectarMaterialesIA,
    buscarMaterialSemantico,
    responderIA
} = require("./services/ai");

const {
    normalizarTexto,
    singularizar
} = require("./utils/text");

// CLIENTE
const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: {
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
    }
});

// QR
client.on("qr", qr => {
    console.log("📲 Escanea este QR:");
    qrcode.generate(qr, { small: true });
});

// READY
client.on("ready", () => {
    console.log("🤖 Bot conectado a WhatsApp");
});

// MENSAJES
client.on("message", async message => {
    try {
        const texto = message.body.trim();

        const inventario = await obtenerInventario();
        const materialesIA = await detectarMaterialesIA(texto);

        if (materialesIA.length > 0) {
            for (const material of materialesIA) {

                const materialNormalizado =
                    singularizar(normalizarTexto(material));

                let variantes = inventario.filter(i => {
                    const productoNormalizado =
                        singularizar(normalizarTexto(i.Producto));
                    return productoNormalizado.includes(materialNormalizado);
                });

                if (variantes.length === 0) {
                    const sugerido =
                        await buscarMaterialSemantico(material, inventario);

                    if (sugerido) {
                        variantes = inventario.filter(i =>
                            i.Producto.toLowerCase() === sugerido.toLowerCase()
                        );
                    }
                }

                if (variantes.length > 0) {
                    let respuesta = `📌 Resultados para "${material}"\n\n`;

                    variantes.forEach(item => {
                        respuesta += `📦 ${item.Producto}
💰 Precio: $${item.Precio}
📊 Stock S1: ${item.StockSucursal1}
📊 Stock S2: ${item.StockSucursal2}\n\n`;
                    });

                    await message.reply(respuesta.trim());
                } else {
                    await message.reply(`No encontré "${material}"`);
                }
            }
            return;
        }

        const respuesta = await responderIA(texto);
        await message.reply(respuesta);

    } catch (err) {
        console.error(err);
        await message.reply("Error procesando mensaje");
    }
});

// START
client.initialize();