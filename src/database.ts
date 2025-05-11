import mongoose from "mongoose";
import dotenv from "dotenv"

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

if(!MONGO_URI) {
    throw new Error("Error la variable de entorno MONGO_URI no esta definida")
}

export const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI as string);
    console.log("🔥 MongoDB conectado");
  } catch (error) {
    console.error("Error al conectar MongoDB", error);
    process.exit(1);
  }
};
