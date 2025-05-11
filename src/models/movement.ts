import { Schema, model, Document, Types } from 'mongoose';

// Interfaz de movimiento
interface IMovement extends Document {
    user: Types.ObjectId;
    type: 'purchase' | 'sale';
    product: {
        id: Types.ObjectId;
        name: string;
        price: number;
    };
    counterparty: {
        id: Types.ObjectId;
        name: string;
    };
    date: Date;
}

// Esquema de movimiento
const MovementSchema = new Schema<IMovement>({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['purchase', 'sale'], required: true },
    product: {
        id: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        name: { type: String, required: true },
        price: { type: Number, required: true }
    },
    counterparty: {
        id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        name: { type: String, required: true }
    },
    date: { type: Date, default: Date.now }
});

// Exportar el modelo
export const Movement = model<IMovement>('Movement', MovementSchema);
