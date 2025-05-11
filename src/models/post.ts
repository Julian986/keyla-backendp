import { Schema, model, Document } from 'mongoose';

interface IPost extends Document {
    title: string;
    description: string;
    image?: string;
    author: {
        id: string;
        name: string;
    };
    created_at: Date;
}

const PostSchema = new Schema<IPost>({
    title: { type: String, required: true },
    description: { type: String, required: true },
    image: { type: String },
    author: {
        id: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        name: { type: String, required: true }
    },
    created_at: {type: Date, default: Date.now}
});

export const Post = model<IPost>('Post', PostSchema);