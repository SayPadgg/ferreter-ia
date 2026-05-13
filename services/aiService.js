import dotenv from "dotenv";
dotenv.config();

import Groq from "groq-sdk";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

export async function detectarIntencion(texto) {

    try {

        const res = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
                {
                    role: "system",
                    content: `
Eres un clasificador de intención para un bot de ferretería.

CATEGORÍAS:
1. chat → saludos, conversación, preguntas generales
2. material → productos, precios, stock, disponibilidad

REGLAS ESTRICTAS:
- SOLO JSON válido
- NO reformules palabras
- NO completes nombres
- SOLO usa palabras EXACTAS del usuario

FORMATO:

CHAT:
{"type":"chat"}

MATERIAL:
{"type":"material","materials":["cemento"]}

Ejemplos:

"hola" → {"type":"chat"}
"cómo estás" → {"type":"chat"}
"pintura blanca" → {"type":"material","materials":["pintura blanca"]}
"bloque" → {"type":"material","materials":["bloque"]}

Si no estás seguro → chat
`
                },
                {
                    role: "user",
                    content: texto
                }
            ],
            temperature: 0
        });

        let content = res.choices[0].message.content
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

        const match = content.match(/\{[\s\S]*\}/);

        if (!match) return { type: "chat" };

        const result = JSON.parse(match[0]);

        if (!result.type) return { type: "chat" };

        if (result.type === "material" && !Array.isArray(result.materials)) {
            result.materials = [];
        }

        return result;

    } catch (err) {
        console.log("Router error:", err);
        return { type: "chat" };
    }
}