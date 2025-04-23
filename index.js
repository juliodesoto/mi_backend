import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import session from "express-session";
import path from "path";
import { fileURLToPath } from "url";

import {
  leerDecisiones,
  crearDecision,
  borrarDecision,
  editarDecision,
  editarResultado,
  editarExito,
} from "./db.js";

// Configuración base
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const servidor = express();

// Usuarios
const listaUsuarios = [
  { usuario: "Robert_Fripp", password: "Kingoftheking", tipo: "admin" },
  { usuario: "Robert_Wyatt", password: "RockBottom", tipo: "normal" }
];

// Middlewares
servidor.use(cors({
  origin: "https://mi-frontend.onrender.com", 
  credentials: true
}));

servidor.use(express.urlencoded({ extended: true }));
servidor.use(express.json());

/*
servidor.use(session({
  secret: "abc123",
  resave: true,
  saveUninitialized: false
}));
*/

servidor.use(session({
  secret: "abc123",
  resave: true,
  saveUninitialized: false,
  cookie: {
    sameSite: "none",
    secure: true
  }
}));


// Servir archivos estáticos
servidor.use(express.static(path.join(__dirname, "public")));

// Configurar EJS para renderizar vistas
servidor.set("view engine", "ejs");
servidor.set("views", path.join(__dirname, "views"));

// Comprobar si hay sesión activa
servidor.get("/session", (req, res) => {
  if (req.session.usuario && req.session.tipo) {
    res.json({
      usuario: req.session.usuario,
      tipo: req.session.tipo
    });
  } else {
    res.json({});
  }
});

// Login y logout
servidor.get("/", (req, res) => {
  if (!req.session.usuario) {
    return res.redirect("/login");
  }
  res.render("index", { usuario: req.session.usuario });
});

servidor.get("/login", (req, res) => {
  if (req.session.usuario) {
    return res.redirect("/");
  }
  res.render("login", { error: false });
});

servidor.post("/login", (req, res) => {
  const { usuario, password } = req.body;

  const usuarioEncontrado = listaUsuarios.find(
    u => u.usuario === usuario && u.password === password
  );

  if (usuarioEncontrado) {
    req.session.usuario = usuarioEncontrado.usuario;
    req.session.tipo = usuarioEncontrado.tipo;
    return res.json({ usuario: req.session.usuario, tipo: req.session.tipo });
  } else {
    return res.status(401).json({ error: "Credenciales incorrectas" });
  }
});

servidor.get("/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ cerrado: true });
  });
});

// Entorno de pruebas
if (process.env.PRUEBAS) {
  servidor.use("/pruebas", express.static("./pruebas"));
}

// Obtener todas las decisiones por tipo de usuario)
servidor.get("/decisiones", async (req, res) => {
  try {
    if (!req.session.tipo) {
      return res.status(401).json({ error: "No autenticado" });
    }
    const todas = await leerDecisiones();
    const filtradas = todas.filter(d => d.tipo === req.session.tipo);
    res.json(filtradas);
  } catch (error) {
    console.error("Error en GET /decisiones:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Crear una nueva decisión
servidor.post("/decisiones/nueva", async (req, res) => {
  let { texto, resultado = null, exito = null } = req.body;

  if (typeof texto !== "string") {
    return res.status(400).json({ error: "Texto debe ser una cadena" });
  }

  texto = texto.trim();

  if (!texto) {
    return res.status(400).json({ error: "Texto inválido" });
  }

  try {
    const nuevaDecision = await crearDecision({
      texto,
      resultado,
      exito,
      tipo: req.session.tipo
    });
    res.status(200).json(nuevaDecision);
  } catch (error) {
    console.error("Error al crear decisión:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Eliminar una decisión

/*
servidor.delete("/decisiones/borrar/:id", async (req, res, next) => {
  try {
    const count = await borrarDecision(req.params.id);
    if (count) {
      return res.status(204).send("");
    }
    next();
  } catch (error) {
    console.error("Error al borrar:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

*/

servidor.delete("/decisiones/borrar/:id", async (req, res, next) => {
  if (!req.session.tipo) {
    return res.status(401).json({ error: "No autenticado" });
  }

  try {
    const count = await borrarDecision(req.params.id);
    if (count) {
      return res.status(204).send("");
    }
    next();
  } catch (error) {
    console.error("Error al borrar:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Editar el resultado de una decisión
servidor.put("/decisiones/editar/resultado/:id", async (req, res) => {
  const { resultado } = req.body;
  const { id } = req.params;

  if (!resultado || typeof resultado !== "string") {
    return res.status(400).json({ error: "Resultado inválido" });
  }

  try {
    const updatedDecision = await editarResultado(id, resultado);
    if (!updatedDecision) {
      return res.status(404).json({ error: "Decisión no encontrada" });
    }
    res.status(200).json(updatedDecision);
  } catch (error) {
    console.error("Error al editar resultado:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Editar el texto de una decisión
servidor.put("/decisiones/editar/texto/:id", async (req, res) => {
  const { texto } = req.body;
  const { id } = req.params;

  if (typeof texto !== "string" || texto.trim() === "") {
    return res.status(400).json({ error: "Texto inválido" });
  }

  try {
    const updatedDecision = await editarDecision(id, texto);
    if (!updatedDecision) {
      return res.status(404).json({ error: "Decisión no encontrada" });
    }
    res.status(200).json(updatedDecision);
  } catch (error) {
    console.error("Error al editar texto:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Editar el éxito de una decisión
servidor.put("/decisiones/editar/exito/:id", async (req, res) => {
  const { exito } = req.body;

  if (typeof exito !== "boolean") {
    return res.status(400).json({ error: "El valor de éxito debe ser un booleano" });
  }

  try {
    const updatedDecision = await editarExito(req.params.id, exito);
    if (!updatedDecision) {
      return res.status(404).json({ error: "Decisión no encontrada" });
    }
    res.status(200).json(updatedDecision);
  } catch (error) {
    console.error("Error al editar éxito:", error);
    res.status(500).json({ error: "Error en el servidor" });
  }
});

// Manejo de errores
servidor.use((error, req, res, next) => {
  console.error("Error en la petición:", error);
  res.status(400).json({ error: "Error en la petición" });
});

// Error 404 para recursos no encontrados
servidor.use((req, res) => {
  res.status(404).json({ error: "Recurso no encontrado" });
});

// Iniciar el servidor
const PORT = process.env.PORT || 3000;
servidor.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});