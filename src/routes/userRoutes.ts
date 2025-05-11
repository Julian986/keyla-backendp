import express from 'express';
import { getUserProducts, getUserProfile, updateUserProfile, addFavouriteProduct, removeFavouriteProduct, getUserFavourites, removeProductForSale, viewUserProfile, getAllUsers } from '../controllers/userController';
import auth from '../middleware/auth';
import multer from 'multer';

// Configuración básica de multer en memoria
const upload = multer({
  storage: multer.memoryStorage(), // Guarda el archivo en memoria como Buffer
  limits: {
    fileSize: 5 * 1024 * 1024 // Límite de 5MB
  }
});

const router = express.Router();

router.get('/all', getAllUsers);

router.get('/me', auth, async (req, res) => {
  try {
    await getUserProfile(req, res);
  } catch (error) {
    console.error("Error al obtener perfil de usuario:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

//router.put('/update', auth, updateUserProfile);
router.put('/update', auth, upload.single('image'), updateUserProfile);

// Endpoint para visitar el perfil de un usuario
router.get('/profile/:userId', viewUserProfile);

// Productos:

router.get("/products", auth, getUserProducts);

// Productos favoritos:

router.get("/favourites", auth, getUserFavourites);

router.post("/add-favourite", auth, addFavouriteProduct);

router.delete("/remove-favourite", auth, removeFavouriteProduct)


// Productos a la venta

router.delete("/remove-product-for-sale", auth, removeProductForSale)

export default router;