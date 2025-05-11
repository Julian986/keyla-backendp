// models/chat.ts
import { Schema, model, Document, Types } from 'mongoose';

interface IParticipants {
  buyer: Types.ObjectId;
  seller: Types.ObjectId;
}

export interface IChat extends Document {
  participants: IParticipants;
  product: Types.ObjectId;
  lastMessage?: Types.ObjectId;
  unreadCount: Map<string, number>;
  archived?: Map<string, boolean>;
  createdAt: Date;
  updatedAt: Date;
}

const chatSchema = new Schema<IChat>({
  participants: {
    buyer: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      validate: {
        validator: (v: Types.ObjectId) => Types.ObjectId.isValid(v),
        message: 'ID de comprador inválido'
      }
    },
    seller: { 
      type: Schema.Types.ObjectId, 
      ref: 'User', 
      required: true,
      validate: {
        validator: (v: Types.ObjectId) => Types.ObjectId.isValid(v),
        message: 'ID de vendedor inválido'
      }
    }
  },
  product: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  lastMessage: { type: Schema.Types.ObjectId, ref: 'Message' },
  unreadCount: {
    type: Map,
    of: Number,
    default: new Map()
  },
  archived: {
    type: Map,
    of: Boolean,
    default: new Map()
  }
}, { timestamps: true });

// Nuevo índice único basado en participantes y producto
chatSchema.index(
  { 
    product: 1, 
    'participants.buyer': 1, 
    'participants.seller': 1 
  }, 
  { unique: true }
);

export default model<IChat>('Chat', chatSchema);