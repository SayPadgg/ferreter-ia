const Groq = require("groq-sdk");
const config = require("../config/config");
const promptSistema = require("../config/prompt");

const groq = new Groq({
    apiKey: config.GROQ_API_KEY
});

async function detectarMaterialesIA(mensaje) {

    try {

        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: `
Extrae los materiales de ferretería mencionados por el cliente.

Responde SOLO JSON.

Formato:
["material1","material2"]

Si no hay materiales responde:
[]
`
                },
                {
                    role: "user",
                    content: mensaje
                }
            ]
        });

        let respuesta = completion.choices[0].message.content;

        respuesta = respuesta
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

        return JSON.parse(respuesta);

    } catch (error) {

        console.log("Error detectando materiales:", error);

        return [];
    }
}

async function buscarMaterialSemantico(material, inventario) {

    try {

        const listaProductos = inventario.map(i => i.Producto).join("\n");

        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: `
El cliente busca un material de ferretería.

Debes elegir el producto del inventario más parecido.

Responde SOLO el nombre exacto del producto.

Inventario:
${listaProductos}
`
                },
                {
                    role: "user",
                    content: material
                }
            ]
        });

        return completion.choices[0].message.content.trim();

    } catch (error) {

        console.log("Error búsqueda semántica:", error);

        return null;
    }
}

async function responderIA(mensaje) {

    try {

        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: promptSistema },
                { role: "user", content: mensaje }
            ]
        });

        return completion.choices[0].message.content;

    } catch (error) {

        console.log("Error IA:", error);

        return "Lo siento, en este momento no puedo responder.";
    }
}

module.exports = {
    detectarMaterialesIA,
    buscarMaterialSemantico,
    responderIA
};