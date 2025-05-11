import { Request, Response, NextFunction } from "express";
import mongoose from "mongoose";

export const validateChatIds = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { buyerId, sellerId, productId } = req.body;

    if (!buyerId || !sellerId || !productId) {
      res.status(400).json({ message: "Todos los IDs son requeridos" });
      return;
    }

    if (!mongoose.Types.ObjectId.isValid(buyerId)) {
      res.status(400).json({ message: "ID de comprador inválido" });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(sellerId)) {
      res.status(400).json({ message: "ID de vendedor inválido" });
      return;
    }
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      res.status(400).json({ message: "ID de producto inválido" });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};