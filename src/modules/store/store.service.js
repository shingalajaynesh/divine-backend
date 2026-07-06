import { z } from 'zod';

export const addAddressSchema = z.object({
  fullName: z.string().min(2).max(100),
  addressLine1: z.string().min(5).max(255),
  addressLine2: z.string().max(255).optional(),
  city: z.string().min(2).max(100),
  state: z.string().min(2).max(100),
  postalCode: z.string().min(4).max(20),
  phone: z.string().min(6).max(20)
});

export const cartItemInputSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(20)
});

export class StoreService {
  constructor(models, sequelize) {
    this.models = models;
    this.sequelize = sequelize;
  }

  // 1. Products Catalog
  async getProducts() {
    return this.models.Product.findAll({
      order: [['title', 'ASC']]
    });
  }

  // 2. Shopping Cart
  async getCart(userId) {
    return this.models.CartItem.findAll({
      where: { userId },
      include: [{ model: this.models.Product, as: 'product' }],
      order: [['createdAt', 'ASC']]
    });
  }

  async addToCart(userId, input) {
    const data = cartItemInputSchema.parse(input);
    
    const product = await this.models.Product.findByPk(data.productId);
    if (!product) throw new Error('Product not found');
    if (product.inventoryCount < data.quantity) {
      throw new Error(`Insufficient stock. Only ${product.inventoryCount} items left.`);
    }

    const [item, created] = await this.models.CartItem.findOrCreate({
      where: { userId, productId: data.productId },
      defaults: { quantity: data.quantity }
    });

    if (!created) {
      const newQty = item.quantity + data.quantity;
      if (product.inventoryCount < newQty) {
        throw new Error(`Cannot add more. Insufficient stock limit of ${product.inventoryCount}.`);
      }
      item.quantity = newQty;
      await item.save();
    }

    return item;
  }

  async updateCartQuantity(userId, input) {
    const data = cartItemInputSchema.parse(input);
    const product = await this.models.Product.findByPk(data.productId);
    if (!product) throw new Error('Product not found');
    if (product.inventoryCount < data.quantity) {
      throw new Error(`Insufficient stock. Only ${product.inventoryCount} items left.`);
    }

    const item = await this.models.CartItem.findOne({
      where: { userId, productId: data.productId }
    });
    if (!item) throw new Error('Cart item not found');

    item.quantity = data.quantity;
    await item.save();
    return item;
  }

  async removeFromCart(userId, productId) {
    const parsedPid = z.string().uuid().parse(productId);
    const count = await this.models.CartItem.destroy({
      where: { userId, productId: parsedPid }
    });
    return count > 0;
  }

  // 3. User Address
  async getAddresses(userId) {
    return this.models.UserAddress.findAll({
      where: { userId },
      order: [['createdAt', 'DESC']]
    });
  }

  async addAddress(userId, input) {
    const data = addAddressSchema.parse(input);
    return this.models.UserAddress.create({
      userId,
      ...data
    });
  }

  async deleteAddress(userId, id) {
    const parsedId = z.string().uuid().parse(id);
    const count = await this.models.UserAddress.destroy({
      where: { id: parsedId, userId }
    });
    return count > 0;
  }

  // 4. Checkout Order creation (no payment gateways)
  async placeOrder(userId, addressId) {
    const parsedAddressId = z.string().uuid().parse(addressId);
    
    // Verify address
    const address = await this.models.UserAddress.findOne({
      where: { id: parsedAddressId, userId }
    });
    if (!address) throw new Error('Shipping destination address not found');

    // Get cart
    const cart = await this.models.CartItem.findAll({
      where: { userId },
      include: [{ model: this.models.Product, as: 'product' }]
    });
    if (cart.length === 0) throw new Error('Your shopping cart is empty');

    return this.sequelize.transaction(async (t) => {
      let totalAmount = 0.0;
      const orderItemsToCreate = [];

      for (const item of cart) {
        const prod = await this.models.Product.findByPk(item.productId, { transaction: t });
        if (!prod) throw new Error(`Product ${item.productId} no longer exists`);
        
        if (prod.inventoryCount < item.quantity) {
          throw new Error(`Insufficient stock for "${prod.title}". Only ${prod.inventoryCount} items left.`);
        }

        // Decrement stock count
        prod.inventoryCount -= item.quantity;
        await prod.save({ transaction: t });

        const itemSubtotal = parseFloat(prod.price) * item.quantity;
        totalAmount += itemSubtotal;

        orderItemsToCreate.push({
          productId: prod.id,
          quantity: item.quantity,
          price: prod.price
        });
      }

      // Create Order
      const order = await this.models.StoreOrder.create({
        userId,
        addressId: parsedAddressId,
        totalAmount,
        status: 'processing'
      }, { transaction: t });

      // Create Order Items
      for (const orderItem of orderItemsToCreate) {
        await this.models.StoreOrderItem.create({
          orderId: order.id,
          ...orderItem
        }, { transaction: t });
      }

      // Clear Cart
      await this.models.CartItem.destroy({
        where: { userId },
        transaction: t
      });

      return order;
    });
  }

  async getMyOrders(userId) {
    return this.models.StoreOrder.findAll({
      where: { userId },
      include: [
        { model: this.models.UserAddress, as: 'address' },
        { 
          model: this.models.StoreOrderItem, 
          as: 'items',
          include: [{ model: this.models.Product, as: 'product' }]
        }
      ],
      order: [['createdAt', 'DESC']]
    });
  }
}
