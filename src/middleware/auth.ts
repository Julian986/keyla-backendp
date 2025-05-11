import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

// Definir la estructura del token decodificado
interface DecodedToken {
    id: string;
    name?: string;
    email?: string;
    // Otros campos que necesites
}

// Extender el tipo Request para incluir la propiedad 'user'
declare global {
    namespace Express {
        interface Request {
            user?: DecodedToken;
        }
    }
}

// Middleware de autenticación mejorado
const auth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const token = req.header("x-auth-token") || 
    req.header("Authorization")?.replace("Bearer ", "");
    /* console.log('[Middleware] Token recibido:', token); */

    if (!token) {
        res.status(401).json({ message: "No hay token, autorización denegada" });
        return;
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret") as { user: { id: string } };
        
        if (!decoded.user || !decoded.user.id) {
            throw new Error("Token inválido - Falta ID de usuario");
        }

        req.user = { id: decoded.user.id };
        next();
    } catch (err) {
        res.status(401).json({ message: err instanceof Error ? err.message : "Token inválido" });
    }
};

export default auth;