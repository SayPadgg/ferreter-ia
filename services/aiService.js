import Groq from "groq-sdk";

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

export async function detectarMaterialesIA(texto) {

    try {

        const res = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
                {
                    role: "system",
                    content: `
Extrae SOLO materiales de ferretería.

REGLAS:
- responde SOLO JSON
- si no hay materiales: []

Ejemplo:
["cemento","pintura","brocha"]
`
                },
                {
                    role: "user",
                    content: texto
                }
            ]
        });

        let content = res.choices[0].message.content
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

        return JSON.parse(content);

    } catch (e) {
        console.log("AI error:", e);
        return [];
    }
}