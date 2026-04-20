function normalizarTexto(texto) {

    return texto
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim();
}

function singularizar(palabra) {

    if (palabra.endsWith("es")) return palabra.slice(0, -2);
    if (palabra.endsWith("s")) return palabra.slice(0, -1);

    return palabra;
}

module.exports = {
    normalizarTexto,
    singularizar
};