import express from "express";
import cors from "cors";
import { connectDB } from "./database";
import dotenv from "dotenv";
import authRoutes from "./routes/authRoutes";
import auth from "./middleware/auth"; // Importa el middleware de autenticación
import userRoutes from './routes/userRoutes';
import path from "path";
import http from "http";
import { Server, Socket } from "socket.io";
import Message from "./models/message";
import productRoutes from './routes/productRoutes'
import mongoose from "mongoose";
import { User } from "./models/user";
import { configureSocket } from "./sockets/socket";
import chatRoutes from './routes/chatRoutes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4500;

// Crear un servidor HTTP para Socket.IO
const server = http.createServer(app);

const io = configureSocket(server);

const uploadsPath = path.join(__dirname, '..', 'uploads');
app.use('/uploads', express.static(uploadsPath));
console.log("Ruta a la carpeta uploads: ", uploadsPath);

// Configuración de CORS: Permitir solo el origen del frontend con credenciales
app.use(cors({
  origin: process.env.FRONTEND_URL, // Permitir solo este origen
  credentials: true, // Permitir el envío de cookies o headers de autenticación
}));

// Middlewares
app.use(express.json());

// Conectar a MongoDB
connectDB();

// Rutas
app.get("/", (req, res) => {
  res.send("Servidor funcionando!");
});

app.use("/auth", authRoutes);
app.use("/user", userRoutes);
app.use("/products", productRoutes);
app.use("/chat", chatRoutes);

// Guardar io en app para acceso en rutas
app.set("io", io);


// Iniciar servidors
server.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
