import Groq from "groq-sdk";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

export async function detectarIntencion(texto) {

    const textoLower = texto.toLowerCase().trim();

    try {

        const completion = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            temperature: 0,
            messages: [
                {
                    role: "system",
                    content: `
Eres un clasificador de intención para una ferretería.

REGLAS:

1. Si el mensaje menciona productos, materiales, herramientas o disponibilidad, devuelve:
{
"type":"material",
"materials":["producto detectado"]
}

Ejemplos:
"tienen pintura?" → material
"hay cemento?" → material
"precio de brocha" → material
"buenas noches, tendrá pintura disponible?" → material

2. Solo devuelve:
{
"type":"chat"
}

si es conversación pura.

Ejemplos:
"hola"
"cómo estás"
"gracias"

RESPONDE SOLO JSON VÁLIDO.
`
                },
                {
                    role: "user",
                    content: textoLower
                }
            ]
        });

        const raw = completion.choices[0].message.content.trim();

        const parsed = JSON.parse(raw);

        // Seguridad extra:
        if (
            parsed.type === "material" &&
            Array.isArray(parsed.materials) &&
            parsed.materials.length > 0
        ) {
            return parsed;
        }

        return { type: "chat" };

    } catch (err) {

        console.log("⚠️ Error router IA:", err.message);

        return { type: "chat" };
    }
}