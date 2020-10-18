import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

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
    const customerExists = await this.customersRepository.findById(customer_id);

    if (!customerExists) {
      throw new AppError('Customer not found.');
    }

    const existenProducts = await this.productsRepository.findAllById(products);

    if (!existenProducts.length) {
      throw new AppError('Products not found.');
    }

    const existenProductId = existenProducts.map(product => product.id);

    const checkExistenProductId = products.filter(
      product => !existenProductId.includes(product.id),
    );

    if (checkExistenProductId.length) {
      throw new AppError(
        `Could not find product ${checkExistenProductId[0].id}.`,
      );
    }

    const checkQtdFromProduct = products.filter(
      product =>
        existenProducts.filter(p => p.id === product.id)[0].quantity <
        product.quantity,
    );

    if (checkQtdFromProduct.length) {
      throw new AppError(
        `Quantity ${checkQtdFromProduct[0].quantity} not available for ${checkQtdFromProduct[0].id}.`,
      );
    }

    const serializeProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: existenProducts.filter(p => p.id === product.id)[0].price,
    }));

    const order = await this.ordersRepository.create({
      customer: customerExists,
      products: serializeProducts,
    });

    const orderedProductQtd = products.map(product => ({
      id: product.id,
      quantity:
        existenProducts.filter(p => p.id === product.id)[0].quantity -
        product.quantity,
    }));

    await this.productsRepository.updateQuantity(orderedProductQtd);

    return order;
  }
}

export default CreateOrderService;
