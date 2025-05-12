import { Request, Response } from "express";
import Chat from "../models/chat";
import Message from "../models/message";
import { Product } from "../models/product";
import { AsyncHandler } from "../types/express";
import { Types } from "mongoose";

// 1. Verificar existencia de chat
export const checkChatExists = async (req: Request, res: Response) => {
  const { productId, sellerId } = req.query;
  const buyerId = req.user?.id;

  try {
    const chat = await Chat.findOne({
      "participants.buyer": buyerId,
      "participants.seller": sellerId,
      product: productId
    }).select("_id unreadCount");

    res.json({
      exists: !!chat,
      chatId: chat?._id,
      unreadCount: chat?.unreadCount || 0
    });
  } catch (error) {
    res.status(500).json({ error: "Error checking chat" });
  }
};

// 2. Iniciar chat con primer mensaje
export const initChat: AsyncHandler = async (req, res, next) => {
  const { productId, sellerId, initialMessage } = req.body;
  const buyerId = req.user?.id;

  if (!buyerId) {
    res.status(401).json({ error: "Usuario no autenticado" });
    return; 
  }
  if (!productId || !sellerId || !initialMessage) {
    res.status(400).json({ error: "Faltan campos requeridos" });
    return; 
  }

  try {
    // Validar que el producto existe
    const product = await Product.findById(productId);
    if (!product) {
      res.status(404).json({ error: "Producto no encontrado" });
      return; 
    }

    // Verificar si ya existe un chat
    const existingChat = await Chat.findOne({
      product: productId,
      'participants.buyer': buyerId,
      'participants.seller': sellerId
    });

    if (existingChat) {
      res.status(409).json({ 
        error: "Ya existe un chat para este producto",
        chatId: existingChat._id
      });
      return;
    }

    // Crear nuevo chat
    const chat = new Chat({
      participants: { 
        buyer: new Types.ObjectId(buyerId),
        seller: new Types.ObjectId(sellerId)
      },
      product: new Types.ObjectId(productId),
      unreadCount: new Map([[sellerId, 1]])
    });

    // Crear primer mensaje
    const message = new Message({
      chat: chat._id,
      sender: new Types.ObjectId(buyerId),
      content: initialMessage
    });

    // Guardar ambos en paralelo
    await Promise.all([chat.save(), message.save()]);

    // Actualizar lastMessage
    await Chat.findByIdAndUpdate(chat._id, { 
      lastMessage: message._id 
    });

    res.status(201).json({ 
      chat: {
        _id: chat._id,
        participants: chat.participants,
        product: chat.product
      },
      message: {
        _id: message._id,
        content: message.content,
        createdAt: message.createdAt
      }
    });
    return; 
  } catch (error: unknown) {
    const err = error as Error;
    console.error("Error detallado al crear chat:", err);
    res.status(500).json({ 
      error: "Error interno al crear chat",
      details: err.message 
    });
    return; 
  }
};

// 3. Obtener mensajes (paginados)
// 3. Obtener mensajes (paginados)
export const getChatMessages = async (req: Request, res: Response) => {
  const { chatId } = req.params;
  const userId = req.user?.id;

  // Validación básica
  if (!Types.ObjectId.isValid(chatId)) {
    res.status(400).json({ error: "ID de chat inválido" });
    return;
  }


  try {
    // Verificar que el usuario pertenece al chat
    const chat = await Chat.findOne({
      _id: new Types.ObjectId(chatId),
      $or: [
        { "participants.buyer": new Types.ObjectId(userId) },
        { "participants.seller": new Types.ObjectId(userId) }
      ]
    })
    .populate("participants.buyer", "name image avatar")
    .populate("participants.seller", "name image avatar");

    
    if (!chat) {
      res.status(404).json({ error: "Chat no encontrado o no tienes acceso" });
      return;
    }

    // Paginación
    const messages = await Message.find({ chat: chat._id })
      .populate({
        path: 'sender',
        select: 'name image avatar',
        options: { lean: true },
        transform: (doc) => {
          if (!doc) {
            return {
              _id: 'deleted-user',
              name: 'Usuario eliminado',
              image: '/default-avatar.png'
            };
          }
          return {
            _id: doc._id,
            name: doc.name,
            image: doc.image || doc.avatar || '/default-avatar.png'
          };
        }
      })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    res.json({
      success: true,
      messages: messages.reverse(),
      chatInfo: {
        product: chat.product,
        participants: {
          buyer: chat.participants.buyer,
          seller: chat.participants.seller
        }
      }
    });
  } catch (error:any) {
    console.error("Error en getChatMessages:", error);
    res.status(500).json({ 
      error: "Error al obtener mensajes",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 4. Enviar mensaje (HTTP)
export const sendMessage = async (req: Request, res: Response) => {
  const { chatId } = req.params;
  const { content } = req.body;
  const senderId = req.user?.id;

  try {
    const chat = await Chat.findById(chatId);
    if (!chat)  {
      res.status(404).json({ error: "Chat not found" });
      return;
    }

    // Crear mensaje
    const message = new Message({
      chat: chatId,
      sender: senderId,
      content
    });

    const savedMessage = await message.save();
const populatedMessage = await savedMessage.populate("sender", "name image");

res.status(201).json({ message: populatedMessage });


    // Actualizar chat usando el método del modelo
    chat.lastMessage = message._id;
    const receiverId = chat.participants.buyer.equals(senderId) 
      ? chat.participants.seller.toString()
      : chat.participants.buyer.toString();

    // Actualizar contador de forma segura
     const currentCount = chat.unreadCount.get(receiverId) || 0;
    chat.unreadCount.set(receiverId, currentCount + 1);
    


    await chat.save();

    res.status(201).json({ message });
  } catch (error) {
    res.status(500).json({ error: "Error sending message" });
  }
};

// 5. Listar chats del usuario (con paginación)
export const getChatsList = async (req: Request, res: Response) => {
  const userId = req.user?.id;

  try {
    const chats = await Chat.aggregate([
      {
        $match: {
          $or: [
            { "participants.buyer": new Types.ObjectId(userId) },
            { "participants.seller": new Types.ObjectId(userId) }
          ],
          [`archived.${userId}`]: { $ne: true }
        }
      },
      {
        $lookup: {
          from: "messages",
          let: { chatId: "$_id" },
          pipeline: [
            { $match: { $expr: { $eq: ["$chat", "$$chatId"] } } },
            { $sort: { createdAt: -1 } },
            { $limit: 1 }
          ],
          as: "lastMessage"
        }
      },
      { $unwind: { path: "$lastMessage", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "users",
          localField: "participants.buyer",
          foreignField: "_id",
          as: "buyerInfo"
        }
      },
      { $unwind: "$buyerInfo" },
      {
        $lookup: {
          from: "users",
          localField: "participants.seller",
          foreignField: "_id",
          as: "sellerInfo"
        }
      },
      { $unwind: "$sellerInfo" },
      {
        $lookup: {
          from: "products",
          localField: "product",
          foreignField: "_id",
          as: "productInfo"
        }
      },
      { $unwind: "$productInfo" },
      {
        $project: {
          _id: 1,
          archived: 1,
          createdAt: 1,
          updatedAt: 1,
          unreadCount: 1,
          "lastMessage.content": 1,
          "lastMessage.createdAt": 1,
          "participants.buyer": {
            _id: "$buyerInfo._id",
            name: "$buyerInfo.name",
            avatar: "$buyerInfo.avatar"
          },
          "participants.seller": {
            _id: "$sellerInfo._id",
            name: "$sellerInfo.name",
            avatar: "$sellerInfo.avatar"
          },
          "product": {
            _id: "$productInfo._id",
            name: "$productInfo.name",
            image: "$productInfo.image",
            price: "$productInfo.price"
          }
        }
      },
      { $sort: { updatedAt: -1 } }
    ]);

    res.json({ chats });
  } catch (error) {
    console.error("Error fetching chats:", error);
    res.status(500).json({ error: "Error fetching chats" });
  }
};

// 6. Marcar como leído
export const markAsRead = async (req: Request, res: Response) => {
  const { chatId } = req.params;
  const userId = req.user?.id;
  try {
    // Actualizar mensajes no leídos
    await Message.updateMany(
      { 
        chat: chatId, 
        sender: { $ne: userId }, 
        read: false 
      },
      { $set: { read: true } }
    );

    // Resetear contador
    await Chat.findByIdAndUpdate(chatId, {
      $set: { [`unreadCount.${userId}`]: 0 }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Error marking as read" });
  }
};

// 7. Archivar chat
export const archiveChat = async (req: Request, res: Response) => {
  const { chatId } = req.params;
  const userId = req.user?.id;

  try {
    await Chat.findByIdAndUpdate(chatId, {
      $set: { [`archived.${userId}`]: true }
    });

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Error archiving chat" });
  }
};



export const getChatInfo = async (req: Request, res: Response) => {
  const { chatId } = req.params;
  const userId = req.user?.id;

  try {
    const chat = await Chat.findOne({
      _id: chatId,
      $or: [
        { "participants.buyer": userId },
        { "participants.seller": userId }
      ]
    })
    .populate("participants.buyer", "name image avatar")
    .populate("participants.seller", "name image avatar")
    .populate("product", "name image");

    if (!chat) {
      res.status(404).json({ error: "Chat no encontrado" });
      return; 
    }

    res.json({
      chatInfo: {
        product: chat.product,
        participants: {
          buyer: chat.participants.buyer,
          seller: chat.participants.seller
        }
      }
    });
  } catch (error) {
    console.error("Error obteniendo información del chat:", error);
    res.status(500).json({ error: "Error al obtener información del chat" });
  }
};