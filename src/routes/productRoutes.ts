import express from "express";
import { createProduct, getAllProducts, getProductById, updateProduct } from "../controllers/productController";
import auth from "../middleware/auth"; // Middleware para verificar autenticación
import { upload } from "../config/multerConfig";

const router = express.Router();

router.get("/", getAllProducts);
router.put("/:id", auth, upload.single("image"), updateProduct)

// Obtener un producto específico por ID
router.get("/:id", getProductById);  // Nueva ruta

// Ruta protegida para publicar un producto
router.post("/publish", auth, upload.single("image"), createProduct);

export default router;
