import { Server } from "socket.io";
import http from "http";
//import Chat, { IChat } from "@/models/chat";
import Message from "../models/message";
import mongoose from "mongoose";
import { Types } from "mongoose";
import jwt from "jsonwebtoken";
import { User } from "../models/user";

export const configureSocket = (server: http.Server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true
    },
    path: "/socket.io"
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error("No autorizado"));
      }

      console.log('Token recibido:', token);
      
  // Decodificar el token correctamente
  const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as { 
    user: { id: string },
    iat: number,
    exp: number 
  };
  
  console.log('Datos decodificados del token:', decoded);
  
  if (!decoded.user?.id) {
    throw new Error("Estructura de token inválida");
  }

  socket.data.userId = new Types.ObjectId(decoded.user.id).toString();
  console.log('userId establecido en socket:', socket.data.userId);
  
      next();
    } catch (error) {
      console.error("Error en autenticación Socket.io:", error);
      next(new Error("Token inválido"));
    }
  });

  io.on("connection", (socket) => {
    console.log(`Usuario conectado: ${socket.id}`);
    
    // Unirse a una sala de chat específica
    socket.on("join-chat", async (chatId: string) => {
      try {
        socket.join(chatId);
        console.log(`Usuario unido al chat: ${chatId}`);
      } catch (error) {
        socket.emit("error", "Error al unirse al chat");
      }
    });
    
    // Manejar nuevo mensaje (versión simplificada)
    socket.on("send-message", async ({ chatId, content }, callback) => {
      try {
        console.log('Iniciando send-message...');
        
        // 1. Obtener y validar userId
        if (!socket.data.userId) throw new Error("Usuario no autenticado");
        const userId = new Types.ObjectId(socket.data.userId);
        
        // 2. Consulta directa a la colección con fallback
        let user;
        try {
          // Intenta con el modelo primero
          user = await User.findById(userId)
            .select('name image avatar')
            .lean();
          
          // Si no funciona, consulta directa a la colección
          if (!user) {
            console.log('Intentando consulta directa a la colección...');
            user = await mongoose.connection.db?.collection('users')
              .findOne({ _id: userId }, { projection: { name: 1, image: 1, avatar: 1 } });
          }
        } catch (err) {
          console.error('Error buscando usuario:', err);
        }
    
        // Datos por defecto si no se encuentra
        if (!user) {
          console.warn('Usuario no encontrado, usando datos por defecto');
          user = {
            _id: userId,
            name: 'Usuario',
            image: '/default-avatar.png'
          };
        }
    
        // 3. Crear y guardar mensaje
        const message = new Message({
          chat: chatId,
          sender: userId,
          content
        });
        
        const savedMessage = await message.save();
    
        // 4. Emitir mensaje
        io.to(chatId).emit("receive-message", {
          ...savedMessage.toObject(),
          sender: user
        });
        
        callback({ status: 'success' });
      } catch (error:any) {
        console.error("Error en send-message:", error);
        callback({ status: 'error', error: error.message });
      }
    });
    
    socket.on("disconnect", () => {
      console.log(`Usuario desconectado: ${socket.id}`);
    });
  });
  
  return io;
};