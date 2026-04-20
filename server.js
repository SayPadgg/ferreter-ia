const express = require("express");
const app = express();

const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot activo en Render 🚀");
});

app.get("/hola", (req, res) => {
  res.send("Hola desde Render 😎");
});

app.listen(PORT, () => {
  console.log("Servidor corriendo en puerto " + PORT);
});