import mongoose from 'mongoose';
import { User } from './models/user';

const updateOldUsers = async () => {
    try {
        await mongoose.connect('mongodb+srv://julikeylus:lapassdeKeylus@cluster0.mdvcwi5.mongodb.net/keyla'); // Ajusta la URL de tu BD

        const result = await User.updateMany(
            { email: { $exists: false } }, // Busca usuarios sin description
            { $set: { email: '' } } // Agrega la imagen por defecto
        );

        console.log(`Usuarios actualizados: ${result.modifiedCount}`);
        mongoose.connection.close();
    } catch (error) {
        console.error('Error actualizando usuarios:', error);
    }
};

updateOldUsers();
