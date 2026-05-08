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
Extrae SOLO materiales mencionados por el usuario.

REGLAS:
- NO inventes productos
- NO generes listas largas
- Si no hay productos reales responde: []

FORMATO:
["cemento","pintura"]
`
                },
                {
                    role: "user",
                    content: texto
                }
            ]
        });

        let content = res.choices[0].message.content;

        content = content
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .trim();

        return JSON.parse(content);

    } catch (err) {

        console.log("Error IA detectando:", err);
        return [];
    }
}