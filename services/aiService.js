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
Eres un extractor de materiales de ferretería.

REGLAS:
- SOLO devuelve un array JSON válido
- SIN texto adicional
- SIN explicaciones
- NO inventes productos

FORMATO:
["cemento","pintura"]

Si no hay materiales:
[]
`
                },
                {
                    role: "user",
                    content: texto
                }
            ],
            temperature: 0
        });

        let content = res.choices[0].message.content;

        // limpieza anti-errores
        content = content
            .replace(/```json/g, "")
            .replace(/```/g, "")
            .replace(/Respuesta:/g, "")
            .trim();

        // extraer SOLO el array real
        const match = content.match(/\[[\s\S]*?\]/);

        if (!match) return [];

        return JSON.parse(match[0]);

    } catch (err) {
        console.log("AI error:", err);
        return [];
    }
}