import mongoose from "mongoose";
import dotenv from "dotenv";
import { Product } from "../models/product";
import { User } from '../models/user';
import preFilledProducts from '../preFilledProducts.json';
import bcrypt from "bcryptjs";
import { validateSpecifications } from "../utils/productUtils";
import { shuffle } from 'lodash'; 

dotenv.config();

interface IPreFilledProduct {
    name: string;
    description: string;
    price: number;
    stock: number;
    category: string;
    brand: string;
    image: string;
    location?: string;
    specifications?: Record<string, string | undefined>;
    sellerType?: 'official' | 'fictional' | 'user';
    fictionalSellerIndex?: number;
}

const seedProducts = async (): Promise<void> => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/keylaDB');
        console.log("✅ Conectado a MongoDB");

        // 1. Crear usuarios (oficial y 6 ficticios individuales)
        const OFFICIAL_STORE_EMAIL = "tienda@keyla.com";
        const FICTIONAL_USERS = [
            {
                name: 'Carlos',
                email: "carlos.tech@example.com",
                plainPassword: 'carlos123',
                password: await bcrypt.hash('carlos123', 10),
                image: 'https://randomuser.me/api/portraits/men/32.jpg',
                location: 'Mar del Plata, Argentina',
                description: 'Vendedor individual de componentes electrónicos'
            },
            {
                name: 'Camila',
                email: "maria.gadgets@example.com",
                plainPassword: 'camila123',
                password: await bcrypt.hash('maria456', 10),
                image: 'https://randomuser.me/api/portraits/women/44.jpg',
                location: 'Buenos Aires, Argentina',
                description: 'Especialista en dispositivos inteligentes'
            },
            {
                name: 'Juan',
                email: "juan.electronica@example.com",
                plainPassword: 'juan123',
                password: await bcrypt.hash('juan789', 10),
                image: 'https://randomuser.me/api/portraits/men/75.jpg',
                location: 'Córdoba, Argentina',
                description: 'Técnico en reparación y venta de equipos'
            },
            {
                name: 'Julieta',
                email: "ana.computacion@example.com",
                plainPassword: 'julieta123',
                password: await bcrypt.hash('ana012', 10),
                image: 'https://randomuser.me/api/portraits/women/68.jpg',
                location: 'Rosario, Argentina',
                description: 'Vendedora de equipos de computación'
            },
            {
                name: 'Luis',
                email: "luis.gaming@example.com",
                plainPassword: 'luis123',
                password: await bcrypt.hash('luis345', 10),
                image: 'https://randomuser.me/api/portraits/men/91.jpg',
                location: 'Ciudad de México, México',
                description: 'Fanático y vendedor de productos gaming'
            },
            {
                name: 'Sofía',
                email: "sofia.audio@example.com",
                plainPassword: 'sofia123',
                password: await bcrypt.hash('sofia678', 10),
                image: 'https://randomuser.me/api/portraits/women/25.jpg',
                location: 'Madrid, España',
                description: 'Especialista en equipos de audio profesional'
            }
        ];

        // Mostrar credenciales de usuarios ficticios
        console.log('\n📋 Credenciales de usuarios ficticios:');
        FICTIONAL_USERS.forEach(user => {
            console.log(`👉 Email: ${user.email} | Contraseña: ${user.plainPassword}`);
        });

        // Crear/recuperar usuario oficial
        let officialUser = await User.findOne({ email: OFFICIAL_STORE_EMAIL });
        if (!officialUser) {
            officialUser = new User({
                name: 'Keyla\'s Official Store',
                email: OFFICIAL_STORE_EMAIL,
                password: await bcrypt.hash('keylaPass926', 10),
                description: 'Tienda oficial de productos tecnológicos Keyla',
                image: 'https://res.cloudinary.com/tu-cloud/image/upload/v123/store-profile.jpg',
                location: '',
                role: 'admin',
                verified: true
            });
            await officialUser.save();
            console.log('🛒 Usuario oficial creado');
        }

        // Crear usuarios ficticios individuales
        const fictionalUsers = await Promise.all(
            FICTIONAL_USERS.map(async userData => {
                let user = await User.findOne({ email: userData.email });
                if (!user) {
                    user = new User({
                        ...userData,
                        role: 'seller',
                        verified: true
                    });
                    await user.save();
                    console.log(`👤 Usuario ficticio ${userData.name} creado`);
                }
                return user;
            })
        );

        // 2. Limpiar productos precargados existentes
        await Product.deleteMany({ 
            $or: [
                { sellerType: 'official' },
                { sellerType: 'fictional' }
            ]
        });
        console.log('🧹 Productos precargados anteriores eliminados');

        // 3. Procesar y mezclar TODOS los productos
        const allProducts = (preFilledProducts as IPreFilledProduct[]);
        const shuffledProducts = shuffle(allProducts);

        // 4. Insertar productos uno por uno con fechas aleatorias
        const insertedProductIds: mongoose.Types.ObjectId[] = [];
        const allSellers = [...fictionalUsers, officialUser];
        
        for (const product of shuffledProducts) {
            let sellerId: mongoose.Types.ObjectId;
            
            // Determinar el vendedor
            if (product.sellerType === 'official') {
                sellerId = officialUser._id;
            } else {
                const sellerIndex = product.fictionalSellerIndex !== undefined ? 
                    Math.min(product.fictionalSellerIndex, fictionalUsers.length - 1) :
                    Math.floor(Math.random() * fictionalUsers.length);
                
                sellerId = fictionalUsers[sellerIndex]._id;
            }

            // Crear producto con fecha aleatoria en los últimos 30 días
            const newProduct = new Product({
                name: product.name.trim(),
                description: product.description.trim(),
                price: Math.round(product.price * 100) / 100,
                stock: Math.max(0, product.stock),
                category: validateCategory(product.category),
                brand: product.brand.trim(),
                image: product.image,
                specifications: validateSpecifications(product.specifications),
                seller: sellerId,
                sellerType: product.sellerType,
                fictionalSellerIndex: product.fictionalSellerIndex,
                createdAt: new Date(Date.now() - Math.floor(Math.random() * 1000 * 60 * 60 * 24 * 30)),
                updatedAt: new Date()
            });

            const savedProduct = await newProduct.save();
            insertedProductIds.push(savedProduct._id as mongoose.Types.ObjectId);

            // Actualizar usuario con el nuevo producto
            await User.findByIdAndUpdate(sellerId, {
                $addToSet: { products_for_sale: savedProduct._id }
            });

            // Pequeña pausa para asegurar diferentes timestamps
            await new Promise(resolve => setTimeout(resolve, 10));
        }

        console.log(`🎉 Carga completa: ${insertedProductIds.length} productos insertados mezclados`);

    } catch (error) {
        console.error('❌ Error durante la carga inicial:', error instanceof Error ? error.message : error);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

// Funciones de apoyo
const validateCategory = (category: string): string => {
    const validCategories = [
        'Components',
        'Peripherals & Setup', 
        'Laptops',
        'Mobile Devices'
    ];
    return validCategories.includes(category) ? category : 'Hardware & Components';
};

const processImage = async (imageUrl: string): Promise<string> => {
    try {
        if (imageUrl.includes('cloudinary.com')) {
            return imageUrl.replace('/upload/', '/upload/f_auto,q_80,w_800/');
        }
        return imageUrl;
    } catch {
        return 'https://res.cloudinary.com/tu-cloud/image/upload/v123/default-product.png';
    }
};

seedProducts();