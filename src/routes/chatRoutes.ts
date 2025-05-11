import express from "express";
import {
  checkChatExists,
  initChat,
  getChatMessages,
  sendMessage,
  getChatsList,
  markAsRead,
  archiveChat,
  getChatInfo
} from "../controllers/chatController"
import auth from "@/middleware/auth";

const router = express.Router();

// 1. Verificar existencia de chat
router.get("/check", auth, checkChatExists);

// 2. Iniciar nuevo chat (con primer mensaje)
router.post("/init", auth, initChat);

// 3. Obtener mensajes de un chat
router.get("/:chatId/messages", auth, getChatMessages);

// 4. Enviar mensaje (HTTP o Socket.io)
router.post("/:chatId/messages", auth, sendMessage);

// 5. Listar chats del usuario
router.get("/", auth, getChatsList);

// 6. Marcar mensajes como leídos
router.patch("/:chatId/read", auth, markAsRead);

// 7. Archivar chat
router.patch("/:chatId/archive", auth, archiveChat);

// Obtener info para el chat
router.get("/:chatId", auth, getChatInfo);

export default router;