import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';
import Product from '@modules/products/infra/typeorm/entities/Product';
import Customer from '@modules/customers/infra/typeorm/entities/Customer';

import { IProduct as IProductOrder } from '@modules/orders/dtos/ICreateOrderDTO';
import { request } from 'express';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    const mapIdProduct: {
      [id: string]: IProductOrder;
    } = {};

    products?.forEach(p => {
      mapIdProduct[p.id] = { product_id: p.id, quantity: p.quantity, price: 0 };
    });

    if (!customer) {
      throw new AppError('Customer not found', 400);
    }
    const productsFound = await this.productsRepository.findAllById(products);

    if (!productsFound || productsFound.length !== products.length) {
      throw new AppError('Produto(s) não encontrado(s)', 400);
    }
    const productsOrder: Array<IProductOrder> = [];
    productsFound.forEach(product => {
      const productOrder = mapIdProduct[product.id];
      if (product.quantity < productOrder.quantity) {
        throw new AppError(
          'Quantidade de itens insuficientes para o pedido',
          400,
        );
      }
      product.quantity = product.quantity - productOrder.quantity;
      productOrder.price = product.price;
      productsOrder.push(productOrder);
    });
    await this.productsRepository.updateQuantity(productsFound);

    const order = await this.ordersRepository.create({
      customer,
      products: productsOrder,
    });

    return order;
  }
}

export default CreateOrderService;
