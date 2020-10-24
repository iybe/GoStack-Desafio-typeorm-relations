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
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Id nao corresponde ao de nenhum Cliente');
    }

    const productsExistents = await this.productsRepository.findAllById(
      products,
    );

    if (productsExistents.length !== products.length) {
      throw new AppError('Produtos não existentes foram passados');
    }

    const productsInfoJoin = productsExistents.map(productExistent => {
      const product = products.find(prod => prod.id === productExistent.id);
      let quantity;
      let quantityRequirid;
      if (!product) {
        quantityRequirid = 0;
        quantity = -1;
      } else {
        quantityRequirid = product.quantity;
        quantity = productExistent.quantity - product.quantity;
      }
      return {
        ...productExistent,
        product_id: productExistent.id,
        price: productExistent.price,
        quantityActual: productExistent.quantity,
        quantityRequirid,
        quantity,
      };
    });

    const checkQuantityProducts = productsInfoJoin.every(
      product => product.quantity >= 0,
    );

    if (!checkQuantityProducts) {
      throw new AppError('Quantidade Pedida, não está disponivel');
    }

    const productsParsed = productsInfoJoin.map(product => {
      return {
        product_id: product.product_id,
        price: product.price,
        quantity: product.quantityRequirid,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: productsParsed,
    });

    const productsParsedTOUpdate = productsInfoJoin.map(product => {
      const {
        created_at,
        id,
        name,
        order_products,
        price,
        product_id,
        quantity,
        updated_at,
      } = product;
      return {
        created_at,
        id,
        name,
        order_products,
        price,
        product_id,
        quantity,
        updated_at,
      };
    });

    await this.productsRepository.updateQuantity(productsParsedTOUpdate);

    return order;
  }
}

export default CreateOrderService;
