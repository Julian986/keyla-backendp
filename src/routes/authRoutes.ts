import express from "express";
import { signUp, logIn, getUserProfile } from "../controllers/authController";
import auth from "../middleware/auth";

const router = express.Router();

router.post("/login", async (req, res) => {
    try {
      await logIn(req, res);
    } catch (error) {
      console.error("Error en login:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  
router.post("/signup", async (req, res) => {
    try {
      await signUp(req, res);
    } catch (error) {
      console.error("Error en signup:", error);
      res.status(500).json({ message: "Error interno del servidor" });
    }
  });
  

// Ruta protegida que usa el middleware de autenticación
router.get('/me', auth, async (req, res) => {
  try {
    await getUserProfile(req, res);
  } catch (error) {
    console.error("Error al obtener perfil de usuario:", error);
    res.status(500).json({ message: "Error interno del servidor" });
  }
});

export default router;
