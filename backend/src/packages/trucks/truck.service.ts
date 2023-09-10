import { type IService } from '~/libs/interfaces/interfaces.js';
import { HttpCode, HttpError, HttpMessage } from '~/libs/packages/http/http.js';

import { type UsersTrucksService } from '../users-trucks/users-trucks.js';
import { type TruckEntityT } from './libs/types/types.js';
import { TruckEntity } from './truck.entity.js';
import { type TruckRepository } from './truck.repository.js';

class TruckService implements IService {
  private repository: TruckRepository;

  private usersTrucksService: UsersTrucksService;

  public constructor(
    repository: TruckRepository,
    usersTrucksService: UsersTrucksService,
  ) {
    this.repository = repository;
    this.usersTrucksService = usersTrucksService;
  }

  public async findById(id: number): Promise<TruckEntityT | null> {
    const [truck = null] = await this.repository.findById(id);

    return truck ? TruckEntity.initialize(truck).toObject() : null;
  }

  public async findByUserId(userId: number): Promise<TruckEntityT[]> {
    const usersTruckRecords =
      await this.usersTrucksService.findByUserId(userId);

    if (!usersTruckRecords) {
      return [];
    }

    return await Promise.all(
      usersTruckRecords.map(async (userTruckRecord) => {
        const [truck = null] = await this.repository.findById(
          userTruckRecord.truckId,
        );

        if (!truck) {
          throw new HttpError({
            status: HttpCode.BAD_REQUEST,
            message: HttpMessage.TRUCK_DOES_NOT_EXIST,
          });
        }

        return TruckEntity.initialize(truck).toObject();
      }),
    );
  }

  public async create(
    payload: Omit<TruckEntityT, 'id'>,
  ): Promise<TruckEntityT> {
    const existingTruck = await this.repository.find(
      payload.licensePlateNumber,
    );

    if (existingTruck.length > 0) {
      throw new HttpError({
        status: HttpCode.BAD_REQUEST,
        message: HttpMessage.TRUCK_EXISTS,
      });
    }

    const [result] = await this.repository.create(payload);

    return TruckEntity.initialize(result).toObject();
  }

  public async update(
    id: number,
    payload: Partial<TruckEntityT>,
  ): Promise<TruckEntityT> {
    const truck = await this.findById(id);

    if (!truck) {
      throw new HttpError({
        status: HttpCode.BAD_REQUEST,
        message: HttpMessage.NOT_FOUND,
      });
    }

    const updatePayload = { ...truck, ...payload };

    const [result] = await this.repository.update(id, updatePayload);

    return TruckEntity.initialize(result).toObject();
  }

  public async delete(id: number): Promise<boolean> {
    return await this.repository.delete(id);
  }

  public async getAll(): Promise<TruckEntityT[]> {
    const result = await this.repository.findAll();

    return result.map((element) => TruckEntity.initialize(element).toObject());
  }
}

export { TruckService };
