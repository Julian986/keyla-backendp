import { Request, Response} from "express";
import { User } from "../models/user";
import exp from "constants";
import { Product } from "../models/product";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { Types } from "mongoose";
import { uploadImage } from '../utils/imageUploader';


export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
    try {
        const users = await User.find({})
            .select('_id name email image')
            .lean();

            const formattedUsers = users.map(user => ({
                id: user._id.toString(),
                name: user.name,
                email: user.email || '', // En caso de que email sea undefined
                image: user.image || 'https://via.placeholder.com/150?text=No+Image',
                sales: 0, // Valor por defecto
                purchases: 0, // Valor por defecto
                status: 'active' // Valor por defecto
            }))

            res.json(formattedUsers);
    } catch (err) {
        console.error("Error al obtener usuarios:", err);
        res.status(500).json({ message: "Error en el servidor" });
    }
};

// Función para obtener el perfil del usuario
export const getUserProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        if (!req.user) {
            res.status(401).json({ message: "No autorizado" });
            return;
        }

        const user = await User.findById(req.user.id).select("_id name email description image phone location");
        if (!user) {
            res.status(404).json({ message: "Usuario no encontrado" });
            return;
        }

        res.json({ _id: user._id, name: user.name, email: user.email, description: user.description, image: user.image, phone: user.phone, location: user.location });
    } catch (err: any) {
        console.error("Error al obtener usuario:", err);
        res.status(500).json({ message: "Error en el servidor" });
    }
};
// Versión mejorada del backend
export const viewUserProfile = async (req: Request, res: Response): Promise<void> => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId)
            .select("name email description image location phone")
            .populate("products_for_sale");
            
        if (!user) {
            res.status(404).json({ message: "Usuario no encontrado" });
            return;
        }

        // Envía solo los productos populados para consistencia
        res.json({ 
            user,
            products: user.products_for_sale 
        });
    } catch (err: any) {
        console.error("Error al obtener perfil del usuario:", err);
        res.status(500).json({ message: "Error en el servidor" });
    }
};

export const updateUserProfile = async (req: Request, res: Response): Promise<void> => {
    try {
      console.log('Incoming request to update user profile');
      console.log('Request body:', req.body);
      console.log('Request file:', req.file);
      
      if (!req.user) {
        console.warn('Unauthorized attempt - no user in request');
        res.status(401).json({ message: "No autorizado" });
        return; 
      }
  
      const user = await User.findById(req.user.id);
      if (!user) {
        console.warn(`User not found with ID: ${req.user.id}`);
        res.status(404).json({ message: "Usuario no encontrado" });
        return; 
      }
  
      // Actualizar campos básicos
      if (req.body.name !== undefined) user.name = req.body.name;
      if (req.body.email !== undefined) user.email = req.body.email;
      if (req.body.description !== undefined) user.description = req.body.description;
      if (req.body.phone !== undefined) user.phone = req.body.phone;
      if (req.body.location !== undefined) user.location = req.body.location;
  
      // Manejar imagen
      if (req.file) {
        console.log('Processing new image upload...');
        try {
          // Verifica el tipo MIME del archivo
          if (!req.file.mimetype.startsWith('image/')) {
            throw new Error('El archivo debe ser una imagen');
          }
      
          const imageUrl = await uploadImage(req.file, 'user-profiles');
          console.log('Image uploaded to:', imageUrl);
          user.image = imageUrl;
        } catch (error) {
          console.error("Error uploading image:", {
            error,
            message: error instanceof Error ? error.message : 'Error desconocido',
            file: {
              originalname: req.file.originalname,
              mimetype: req.file.mimetype,
              size: req.file.size
            }
          });
          
          res.status(400).json({ 
            success: false,
            message: "Error al subir la imagen",
            error: error instanceof Error ? error.message : 'Error desconocido'
          });
          return;
        }
      
      } else if (req.body.image && req.body.image.startsWith('http')) {
        console.log('Using existing image URL:', req.body.image);
        user.image = req.body.image;
      }
  
      const updatedUser = await user.save();
      console.log('User successfully updated');
  
      // Eliminar campos sensibles
      const userResponse = updatedUser.toObject();
      delete (userResponse as any).password;
      delete (userResponse as any).__v;
  
      res.json({ 
        success: true,
        message: "Usuario actualizado", 
        user: userResponse 
      });
    } catch (err: any) {
      console.error("Error updating user:", {
        error: err,
        message: err.message,
        stack: err.stack
      });
      res.status(500).json({ 
        success: false,
        message: "Error en el servidor",
        error: err.message,
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined
      });
    }
  };

export const getUserProducts = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        
        if (!userId) {
            res.status(401).json({ message: "No autorizado" });
            return;
        }

        const user = await User.findById(userId).populate({
            path: 'products_for_sale',
            select: '_id name price brand image category stock seller description currencyType condition createdAt updatedAt', // Selecciona todos los campos necesarios
            transform: (doc) => {
                if (doc) {
                    return {
                        ...doc.toObject(),
                        _id: doc._id.toString(), // Convertir ObjectId a string
                        seller: doc.seller ? doc.seller.toString() : null // Si seller es ObjectId
                    };
                }
                return doc;
            }
        });

        if (!user) {
            res.status(404).json({ message: "Usuario no encontrado" });
            return;
        }

        // Filtra productos inválidos
        const validProducts = user.products_for_sale.filter(p => p !== null && p._id !== undefined);

        res.json(validProducts);
    } catch (error) {
        console.error("Error en getUserProducts:", error);
        res.status(500).json({ 
            message: "Error al obtener productos",
            error: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
};

// --------------------- Productos Favoritos ---------------------

export const getUserFavourites = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        
        if (!userId) {
            res.status(401).json({ message: "No autorizado" });
            return; 
        }

        const user = await User.findById(userId).populate({
            path: 'favourite_products',
            select: '_id name price brand image category stock seller', // Selecciona los campos que necesitas
            transform: (doc) => {
                // Transforma el documento para convertir ObjectId a string
                if (doc) {
                    return {
                        ...doc.toObject(),
                        _id: doc._id.toString(), // Convertir ObjectId a string
                        seller: doc.seller ? doc.seller.toString() : null // Si seller es ObjectId
                    };
                }
                return doc;
            }
        });

        if (!user) {
            res.status(404).json({ message: "Usuario no encontrado" });
            return; 
        }

        // Filtra cualquier producto que sea null/undefined (por si hay IDs inválidos)
        const validFavourites = user.favourite_products.filter(p => p !== null && p._id !== undefined);

        res.json(validFavourites);
    } catch (error) {
        console.error("Error en getUserFavourites:", error);
        res.status(500).json({ 
            message: "Error al obtener productos favoritos",
            error: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
};

  export const addFavouriteProduct = async (req: Request, res: Response) => {
    try {
        console.log("Datos recibidos:", req.body);
        const userId = req.user?.id;
        const { productId } = req.body;

        if (!userId) {
            res.status(401).json({ message: "No autorizado" });
            return;
        }

        if (!productId) {
            res.status(400).json({ message: "productId es requerido" });
            return;
        }

        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ message: "Usuario no encontrado" });
            return;
        }

        if (!mongoose.Types.ObjectId.isValid(productId)) {
            res.status(400).json({ message: "ID de producto no válido" });
            return;
        }

        if (user.favourite_products.includes(productId)) {
            res.status(400).json({ message: "El producto ya está en favoritos" });
            return;
        }

        user.favourite_products.push(productId);
        await user.save();

        res.json({ 
            success: true,
            message: "Producto añadido a favoritos",
            favourites: user.favourite_products 
        });
    } catch (error: unknown) {
        console.error("Error en addFavouriteProduct:", error);
        const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
        res.status(500).json({ 
            message: "Error al añadir producto a favoritos",
            error: errorMessage
        });
    }
}

export const removeFavouriteProduct = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        const { productId } = req.body;

        // Validación mejorada
        if (!userId) {
            res.status(401).json({ message: "No autorizado" });
            return; 
        }

        if (!productId || !Types.ObjectId.isValid(productId)) {
            res.status(400).json({ message: "ID de producto no válido" });
            return; 
        }

        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ message: "Usuario no encontrado" });
            return; 
        }

        const productObjectId = new Types.ObjectId(productId);
        
        user.favourite_products = user.favourite_products.filter(
            favId => !favId.equals(productObjectId)
        );

        await user.save();

        res.json({ 
            success: true,
            message: "Producto eliminado de favoritos"
        });
    } catch (error) {
        console.error("Error:", error);
        res.status(500).json({ message: "Error en el servidor" });
    }
};


// --------------------- Productos a la venta ---------------------
export const removeProductForSale = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        const { productId } = req.body;

        // Validación mejorada
        if (!userId) {
            res.status(401).json({ 
                success: false,
                message: "No autorizado" 
            });
            return;
        }

        if (!productId || !mongoose.Types.ObjectId.isValid(productId)) {
            res.status(400).json({ 
                success: false,
                message: "ID de producto no válido" 
            });
            return;
        }

        const user = await User.findById(userId);
        if (!user) {
            res.status(404).json({ 
                success: false,
                message: "Usuario no encontrado" 
            });
            return;
        }

        // Convertir a ObjectId para comparación
        const productObjectId = new mongoose.Types.ObjectId(productId);

        // Verificar que el producto pertenece al usuario
        if (!user.products_for_sale.some(id => id.equals(productObjectId))) {
            res.status(403).json({ 
                success: false,
                message: "No tienes permiso para eliminar este producto" 
            });
            return;
        }

        // Eliminar de la lista del usuario
        user.products_for_sale = user.products_for_sale.filter(
            id => !id.equals(productObjectId)
        );
        await user.save();

        // Eliminar el producto de la colección
        const deletedProduct = await Product.findByIdAndDelete(productObjectId);
        if (!deletedProduct) {
            res.status(404).json({ 
                success: false,
                message: "Producto no encontrado" 
            });
            return;
        }

        // Eliminar imagen si existe (opcional)
        if (deletedProduct.image) {
            try {
                const imagePath = path.join(__dirname, "..", "uploads", deletedProduct.image);
                if (fs.existsSync(imagePath)) {
                    fs.unlinkSync(imagePath);
                }
            } catch (fsError) {
                console.error("Error al eliminar imagen:", fsError);
            }
        }

        res.json({ 
            success: true,
            message: "Producto eliminado correctamente",
            productId: productId 
        });
    } catch (error) {
        console.error("Error en removeProductForSale:", error);
        res.status(500).json({ 
            success: false,
            message: "Error interno del servidor",
            error: error instanceof Error ? error.message : 'Error desconocido'
        });
    }
};