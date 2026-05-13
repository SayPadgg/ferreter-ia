export function normalizarTexto(texto = "") {

    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "") // acentos
        .replace(/[^a-z0-9\s]/g, "")     // símbolos
        .replace(/\s+/g, " ")
        .trim();
}