import { Schema, model, Document, Types} from 'mongoose';

export interface IUser extends Document {
    _id: Types.ObjectId;
    name: string;
    email: string;
    password: string;
    products_for_sale: Types.ObjectId[];
    favourite_products: Types.ObjectId[];
    image?: string;
    description: string;
    location: string;  // Nueva propiedad
    phone: string;     // Nueva propiedad
}

const UserSchema = new Schema<IUser>({
    name: { type: String },
    email: { type: String, required: false },
    password: { type: String, required: true },
    products_for_sale: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    favourite_products: [{ type: Schema.Types.ObjectId, ref: 'Product' }],
    image: { type: String, default: 'https://res.cloudinary.com/dnnxgzqzv/image/upload/v1744123555/userProfile_ngsp8j.png' },
    description: { type: String, default: '' },
    location: { type: String, default: '' },  // Nueva propiedad con valor por defecto
    phone: { type: String, default: '' }      // Nueva propiedad con valor por defecto
});

export const User = model<IUser>('User', UserSchema);