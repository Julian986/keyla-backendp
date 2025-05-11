import { Request, Response } from "express";
import { Product } from "../models/product";
import { User } from "../models/user";
import axios from "axios";
import fs from "fs";
import path from "path";
import FormData from "form-data";
import sharp from "sharp";
import { v4 as uuidv4 } from 'uuid';
import validator from 'validator';
import cloudinary from "../config/cloudinaryConfig";
import mongoose from "mongoose";
import fetch from "node-fetch";


export const getAllProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { category, subCategory, minPrice, maxPrice, brand } = req.query;
    
    const filter: any = {};
    
    if (category) filter.category = category;
    if (subCategory) filter.subCategory = subCategory;
    if (brand) filter.brand = { $regex: brand, $options: 'i' };
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = Number(minPrice);
      if (maxPrice) filter.price.$lte = Number(maxPrice);
    }

    const products = await Product.find(filter)
      .select('_id name description price stock category brand image specifications createdAt updatedAt seller sellerType fictionalSellerIndex currencyType condition')
      .populate({
        path: 'seller',
        select: '_id name email image location',
        transform: (doc) => doc ? {
          _id: doc._id,
          name: doc.name,
          email: doc.email,
          image: doc.image,
          location: doc.location
        } : null
      })
      .sort({ createdAt: -1 })
      .lean();

    // Transformar los productos con manejo seguro de specifications
    const transformedProducts = products.map(product => {
      let specifications: Record<string, string> | undefined;
      
      if (product.specifications) {
        if (product.specifications instanceof Map) {
          specifications = Object.fromEntries(product.specifications.entries());
        } else if (Array.isArray(product.specifications)) {
          specifications = Object.fromEntries(product.specifications);
        } else {
          // Si ya es un objeto, usarlo directamente
          specifications = product.specifications;
        }
      }

      return {
        ...product,
        specifications,
        createdAt: product.createdAt?.toISOString(),
        updatedAt: product.updatedAt?.toISOString()
      };
    });

    res.status(200).json(transformedProducts);
  } catch (error) {
    console.error("Error al obtener productos:", error);
    res.status(500).json({ 
      message: "Error al obtener productos",
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};

export const getProductById = async (req: Request, res: Response): Promise<void> => {
  console.log('Llego bien');
  try {
    const product = await Product.findById(req.params.id)
      .populate('seller', '_id name email image')
      .lean();

    if (!product) {
      res.status(404).json({ message: "Producto no encontrado" });
      return;
    }

    console.log('Producto desde la DB:', product);

    // Convertir specifications correctamente
    let specifications: Record<string, string> | undefined;
    
    if (product.specifications) {
      if (product.specifications instanceof Map) {
        specifications = Object.fromEntries(product.specifications.entries());
      } else if (Array.isArray(product.specifications)) {
        specifications = Object.fromEntries(product.specifications);
      } else {
        // Si ya es un objeto, usarlo directamente
        specifications = product.specifications;
      }
    }

    res.status(200).json({
      ...product,
      specifications,
      createdAt: product.createdAt?.toISOString(),
      updatedAt: product.updatedAt?.toISOString()
    });
  } catch (error) {
    console.error("Error al obtener producto:", error);
    res.status(500).json({ 
      message: "Error al obtener producto",
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};



export const createProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Verificación de usuario autenticado
    if (!req.user) {
      res.status(401).json({ message: "No autorizado" });
      return;
    }

    const userId = req.user.id;
    const user = await User.findById(userId);
    if (!user) {
      res.status(404).json({ message: "Usuario no encontrado" });
      return;
    }

      // Procesamiento de imagen (Cloudinary)
      let imageUrl = 'https://res.cloudinary.com/tu_cloud_name/image/upload/v_default_product.png';
      if (req.file) {
        const pngBuffer = await sharp(req.file.buffer)
          .resize(800, 800, { fit: 'inside' })
          .png({ quality: 90 })
          .toBuffer();

        const formData = new FormData();
        formData.append("image_file", pngBuffer, {
          filename: "product.webp",
          contentType: "image/webp"
        });
        formData.append("size", "auto");

        const removeBgResponse = await fetch("https://api.remove.bg/v1.0/removebg", {
          method: "POST",
          headers: {
            "X-Api-Key": process.env.REMOVE_BG_API_KEY!,
          },
          body: formData as any
        });

        if(!removeBgResponse.ok) {
          const error = await removeBgResponse.text();
          console.error("remove.bg error:", error);
          res.status(500).json({ message: "Error al procesar la imagen en remove.bg "});
          return;
        }

        const noBgBuffer = await removeBgResponse.buffer();

        const webpBuffer = await sharp(noBgBuffer)
          .resize(800, 800, { fit: 'inside' })
          .webp({ quality: 90 })
          .toBuffer();


     /*    const optimizedBuffer = await sharp(req.file.buffer)
          .resize(800, 800, { fit: 'inside' })
          .webp({ quality: 80 })
          .toBuffer(); */
  
        const result = await cloudinary.uploader.upload(
          `data:image/webp;base64,${webpBuffer.toString('base64')}`,
          { folder: 'marketplace-products' }
        );
        imageUrl = result.secure_url;
      }
  
      // Crear producto
      const newProduct = await Product.create({
        name: req.body.name,
        description: req.body.description,
        price: parseFloat(req.body.price),
        stock: parseInt(req.body.stock),
        category: req.body.category.trim(),
        brand: req.body.brand,
        currencyType: req.body.currencyType.trim(),
        condition: req.body.condition.trim(),
        image: imageUrl,
        seller: userId,
        sellerType: req.body.sellerType || 'user'
      });
  
      // Actualizar usuario (sin transacción)
      await User.findByIdAndUpdate(
        userId,
        { $push: { products_for_sale: newProduct._id } },
        { new: true }
      );
  
      res.status(201).json({
        ...newProduct.toObject(),
        seller: { id: user._id, name: user.name, image: user.image }
      });
  
    } catch (error) {
      console.error("Error al crear producto:", error);
      res.status(500).json({ 
        message: "Error al crear producto",
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  };


  export const updateProduct = async (req: Request, res: Response): Promise<void> => {
    try {
      // 1. Verificación de usuario autenticado y propietario del producto
      if (!req.user) {
        res.status(401).json({ message: "No autorizado" });
        return;
      }
  
      const productId = req.params.id;
      const userId = req.user.id;
  
      // Verificar que el producto exista y pertenezca al usuario
      const existingProduct = await Product.findOne({ 
        _id: productId, 
        seller: userId 
      });
  
      if (!existingProduct) {
        res.status(404).json({ 
          message: "Producto no encontrado o no tienes permisos para editarlo" 
        });
        return;
      }
  
      // 2. Procesamiento de imagen (si se envió una nueva)
      let imageUrl = existingProduct.image;
      if (req.file) {
        const pngBuffer = await sharp(req.file.buffer)
          .resize(800, 800, { fit: 'inside' })
          .png({ quality: 90 })
          .toBuffer();
  
        const formData = new FormData();
        formData.append("image_file", pngBuffer, {
          filename: "product.webp",
          contentType: "image/webp"
        });
        formData.append("size", "auto");
  
        const removeBgResponse = await fetch("https://api.remove.bg/v1.0/removebg", {
          method: "POST",
          headers: {
            "X-Api-Key": process.env.REMOVE_BG_API_KEY!,
          },
          body: formData as any
        });
  
        if (!removeBgResponse.ok) {
          const error = await removeBgResponse.text();
          console.error("remove.bg error:", error);
          res.status(500).json({ message: "Error al procesar la imagen en remove.bg" });
          return;
        }
  
        const noBgBuffer = await removeBgResponse.buffer();
        const webpBuffer = await sharp(noBgBuffer)
          .resize(800, 800, { fit: 'inside' })
          .webp({ quality: 90 })
          .toBuffer();
  
        const result = await cloudinary.uploader.upload(
          `data:image/webp;base64,${webpBuffer.toString('base64')}`,
          { folder: 'marketplace-products' }
        );
        imageUrl = result.secure_url;
      }
  
      // 3. Preparar datos de actualización
      const updateData: any = {
        name: req.body.name,
        description: req.body.description,
        price: parseFloat(req.body.price),
        stock: parseInt(req.body.stock),
        category: req.body.category?.trim(),
        brand: req.body.brand,
        currencyType: req.body.currencyType?.trim(),
        condition: req.body.condition?.trim(),
        image: imageUrl,
        updatedAt: new Date()
      };
  
      // Manejar especificaciones si se envían
      if (req.body.specifications) {
        try {
          const specs = typeof req.body.specifications === 'string' 
            ? JSON.parse(req.body.specifications) 
            : req.body.specifications;
          
          updateData.specifications = specs;
        } catch (error) {
          console.error("Error parsing specifications:", error);
        }
      }
  
      // 4. Actualizar el producto
      const updatedProduct = await Product.findByIdAndUpdate(
        productId,
        updateData,
        { new: true, runValidators: true }
      ).populate('seller', '_id name email image');
  
      if (!updatedProduct) {
        res.status(404).json({ message: "Producto no encontrado" });
        return;
      }
  
      // 5. Responder con el producto actualizado
      res.status(200).json({
        ...updatedProduct.toObject(),
        createdAt: updatedProduct.createdAt?.toISOString(),
        updatedAt: updatedProduct.updatedAt?.toISOString()
      });
  
    } catch (error) {
      console.error("Error al actualizar producto:", error);
      res.status(500).json({ 
        message: "Error al actualizar producto",
        error: error instanceof Error ? error.message : 'Error desconocido'
      });
    }
  };