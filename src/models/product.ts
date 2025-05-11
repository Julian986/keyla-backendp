import { Schema, model, Document, Types } from 'mongoose';
import isURL from 'validator/lib/isURL';

export interface IProduct extends Document {
  name: string;
  description: string;
  price: number;
  stock: number;
  category: string;
  brand: string;
  image: string;
  specifications: Map<string, string>;
  seller: Types.ObjectId;
  sellerType: 'official' | 'fictional' | 'user';
  currencyType: 'usd' | 'ars';
  condition: 'Used' | 'New';
  fictionalSellerIndex?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const ProductSchema = new Schema<IProduct>(
  {
    name: { 
      type: String, 
      required: [true, 'El nombre del producto es requerido'],
      trim: true,
      maxlength: [120, 'El nombre no puede exceder los 120 caracteres']
    },
    description: { 
      type: String,
      trim: true,
      maxlength: [1500, 'La descripción no puede exceder los 1500 caracteres']
    },
    price: { 
      type: Number, 
      required: [true, 'El precio es requerido'],
      min: [0, 'El precio no puede ser negativo'],
      set: (v: number) => Math.round(v * 100) / 100
    },
    stock: { 
      type: Number, 
      required: [true, 'El stock es requerido'],
      min: [0, 'El stock no puede ser negativo'],
      default: 0
    },
    category: { 
      type: String, 
      required: [true, 'La categoría principal es requerida'],
      enum: [
      'Components',
      'Peripherals & Setup', 
      'Laptops',
      'Mobile Devices'
      ]
    },
    brand: {
      type: String,
      required: [true, 'La marca es requerida'],
      trim: true,
      maxlength: [30, 'La marca no puede exceder los 30 caracteres']
    },
    image: {
      type: String,
      required: true,
      validate: {
        validator: (url: string) => url.startsWith('https://res.cloudinary.com/'),
        message: 'La imagen debe ser una URL válida de Cloudinary'
      }
    },
    specifications: {
      type: Map,
      of: String,
      required: false
    },
    seller: { 
      type: Schema.Types.ObjectId, 
      ref: 'User',
      required: [true, 'El vendedor es requerido'],
      index: true
    },
    sellerType: {
      type: String,
      required: [true, 'El tipo de vendedor es requerido'],
      enum: ['official', 'fictional', 'user'],
      default: 'user'
    },
    fictionalSellerIndex: {
      type: Number,
      required: function() {
        return this.sellerType === 'fictional';
      },
      min: 0
    },
    currencyType: {
      type: String,
      required: [true, 'El tipo de moneda es requerido'],
      enum: ['usd', 'ars'],
      default: 'usd' // Puedes establecer el valor por defecto según tu necesidad
    },
    condition: {
      type: String,
      required: [true, 'La condicion es requerida'],
      enum: ['Used', 'New'],
      default: 'Used'
    }
  },
  { 
    timestamps: true,
    toJSON: { 
      virtuals: true,
      transform: function(doc, ret) {
        ret.id = ret._id;
        delete ret._id;
        delete ret.__v;
        if (ret.specifications instanceof Map) {
          ret.specifications = Object.fromEntries(ret.specifications);
        }
        return ret;
      }
    },
    toObject: { virtuals: true }
  }
);

// Índices
ProductSchema.index({ 
  name: 'text', 
  description: 'text', 
  brand: 'text',
  'specifications': 'text' 
});
ProductSchema.index({ category: 1, subCategory: 1 });
ProductSchema.index({ price: 1, stock: 1 });
ProductSchema.index({ createdAt: -1 });
ProductSchema.index({ sellerType: 1 });


// Virtual para datos extendidos del vendedor
ProductSchema.virtual('sellerData', {
  ref: 'User',
  localField: 'seller',
  foreignField: '_id',
  justOne: true,
  options: { 
    select: 'name email image description rating' 
  }
});

// Métodos adicionales
ProductSchema.methods.withSeller = async function() {
  await this.populate('sellerData');
  return this;
};

// Métodos estáticos
ProductSchema.statics.findOfficialProducts = function() {
  return this.find({ sellerType: 'official' });
};

ProductSchema.statics.findUserProducts = function() {
  return this.find({ sellerType: 'user' });
};

ProductSchema.statics.findFictionalProducts = function() {
  return this.find({ sellerType: 'fictional' });
};

export const Product = model<IProduct>('Product', ProductSchema);