import Groq from "groq-sdk";
import dotenv from "dotenv";
dotenv.config();

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
Eres un clasificador de mensajes.

DEVUELVE SOLO JSON VÁLIDO.

FORMATOS POSIBLES:

1) CHAT:
{"type":"chat"}

2) MATERIAL:
{"type":"material","materials":["cemento","arena"]}

REGLAS:
- NO texto adicional
- NO explicaciones
- NO markdown
- SOLO JSON
`
                },
                {
                    role: "user",
                    content: texto
                }
            ],
            temperature: 0
        });

        let content = res.choices[0].message.content.trim();

        // 🔥 LIMPIEZA FUERTE
        content = content
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

        // 🔥 EXTRAER SOLO JSON REAL
        const jsonMatch = content.match(/\{[\s\S]*\}/);

        if (!jsonMatch) {
            return { type: "chat" };
        }

        return JSON.parse(jsonMatch[0]);

    } catch (err) {

        console.log("Router AI error:", err);

        return { type: "chat" };
    }
}