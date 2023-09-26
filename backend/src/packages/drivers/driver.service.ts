import { type IService } from '~/libs/interfaces/interfaces.js';
import {
  type GeolocationCacheService,
  type GeolocationLatLng,
} from '~/libs/packages/geolocation-cache/geolocation-cache.js';
import { HttpCode, HttpError, HttpMessage } from '~/libs/packages/http/http.js';
import { type UsersTrucksService } from '~/packages/users-trucks/users-trucks.service';

import { UserGroupKey } from '../auth/libs/enums/enums.js';
import { DriverEntity } from '../drivers/driver.entity.js';
import { type DriverRepository } from '../drivers/driver.repository.js';
import {
  type DriverAddPayloadWithBusinessId,
  type DriverAddResponseWithGroup,
  type DriverCreateUpdateResponseDto,
  type DriverEntityT,
  type DriverGetAllResponseDto,
  type DriverGetDriversPayloadWithBusinessId,
  type DriverUpdatePayload,
} from '../drivers/libs/types/types.js';
import { type FileVerificationStatusService } from '../file-verification-status/file-verification-status.js';
import { type GroupService } from '../groups/group.service.js';
import { type UserService } from '../users/user.service.js';
import { convertToDriverUser } from './libs/helpers/helpers.js';

class DriverService implements IService {
  private driverRepository: DriverRepository;

  private userService: UserService;

  private groupService: GroupService;

  private geolocationCacheService: GeolocationCacheService;

  private fileVerificationStatusService: FileVerificationStatusService;

  private usersTrucksService: UsersTrucksService;

  public constructor({
    driverRepository,
    userService,
    groupService,
    geolocationCacheService,
    usersTrucksService,
    fileVerificationStatusService,
  }: {
    driverRepository: DriverRepository;
    userService: UserService;
    groupService: GroupService;
    geolocationCacheService: GeolocationCacheService;
    usersTrucksService: UsersTrucksService;
    fileVerificationStatusService: FileVerificationStatusService;
  }) {
    this.driverRepository = driverRepository;
    this.userService = userService;
    this.groupService = groupService;
    this.geolocationCacheService = geolocationCacheService;
    this.usersTrucksService = usersTrucksService;
    this.fileVerificationStatusService = fileVerificationStatusService;
  }

  public async getGeolocationById(id: number): Promise<GeolocationLatLng> {
    const foundDriver = await this.findById(id);

    if (!foundDriver) {
      throw new HttpError({
        message: HttpMessage.DRIVER_DOES_NOT_EXIST,
        status: HttpCode.NOT_FOUND,
      });
    }

    const geolocation = this.geolocationCacheService.getCache(id);

    if (!geolocation) {
      throw new HttpError({
        message: HttpMessage.DRIVER_LOCATION_UNKNOWN,
        status: HttpCode.BAD_REQUEST,
      });
    }

    return geolocation;
  }

  public async findByLicenseFileId(
    driverLicenseFileId: number,
  ): Promise<DriverEntityT | null> {
    const [driver = null] = await this.driverRepository.find({
      driverLicenseFileId,
    });

    return driver;
  }

  public async findById(id: number): Promise<DriverEntityT | null> {
    const [driver = null] = await this.driverRepository.find({ id });

    return driver;
  }

  public async findByUserId(userId: number): Promise<DriverEntityT | null> {
    const [driver = null] = await this.driverRepository.find({ userId });

    return driver;
  }

  public async findAllByBusinessId({
    businessId,
    query,
  }: DriverGetDriversPayloadWithBusinessId): Promise<DriverGetAllResponseDto> {
    const items = await this.driverRepository.findAllByBusinessId(
      businessId,
      query,
    );
    const total = await this.driverRepository.getTotal(businessId);

    return {
      items: items.map((item) => convertToDriverUser(item)),
      total,
    };
  }

  public async create({
    payload,
    businessId,
    driverLicenseFileId,
  }: DriverAddPayloadWithBusinessId & {
    driverLicenseFileId: DriverEntityT['driverLicenseFileId'];
  }): Promise<DriverAddResponseWithGroup> {
    const {
      password,
      email,
      lastName,
      firstName,
      phone,
      driverLicenseNumber,
      truckIds,
    } = payload;

    const { result: doesDriverExist } = await this.driverRepository.checkExists(
      {
        driverLicenseNumber,
      },
    );

    if (doesDriverExist) {
      throw new HttpError({
        status: HttpCode.BAD_REQUEST,
        message: HttpMessage.DRIVER_LICENSE_ALREADY_EXISTS,
      });
    }

    const userByPhone = await this.userService.findByPhone(phone);

    if (userByPhone) {
      throw new HttpError({
        status: HttpCode.BAD_REQUEST,
        message: HttpMessage.USER_PHONE_ALREADY_EXISTS,
      });
    }

    const userByEmail = await this.userService.findByEmail(email);

    if (userByEmail) {
      throw new HttpError({
        status: HttpCode.BAD_REQUEST,
        message: HttpMessage.USER_EMAIL_ALREADY_EXISTS,
      });
    }

    const group = await this.groupService.findByKey(UserGroupKey.DRIVER);

    if (!group) {
      throw new HttpError({
        status: HttpCode.BAD_REQUEST,
        message: HttpMessage.INVALID_GROUP,
      });
    }

    const user = await this.userService.create({
      password,
      email,
      lastName,
      firstName,
      phone,
      groupId: group.id,
    });
    const driver = await this.driverRepository.create(
      DriverEntity.initializeNew({
        driverLicenseNumber,
        businessId,
        userId: user.id,
        driverLicenseFileId,
      }),
    );

    await this.usersTrucksService.addTrucksToDriver(user.id, truckIds);

    const driverObject = driver.toObject();

    return { ...user, ...driverObject, group, possibleTruckIds: truckIds };
  }

  public async update({
    driverId,
    payload,
  }: {
    driverId: DriverUpdatePayload['driverId'];
    payload: DriverUpdatePayload['payload'] & {
      driverLicenseFileId: DriverEntityT['driverLicenseFileId'];
    };
  }): Promise<DriverCreateUpdateResponseDto> {
    const { password, email, lastName, firstName, phone, driverLicenseNumber } =
      payload;

    const foundDriver = await this.findById(driverId);

    if (!foundDriver) {
      throw new HttpError({
        message: HttpMessage.DRIVER_DOES_NOT_EXIST,
        status: HttpCode.NOT_FOUND,
      });
    }

    const user = await this.userService.update(foundDriver.userId, {
      password,
      email,
      lastName,
      firstName,
      phone,
    });

    const driver = await this.driverRepository.update({
      id: foundDriver.id,
      payload: { driverLicenseNumber },
    });

    const driverObject = driver.toObject();

    return { ...user, ...driverObject };
  }

  public async delete(id: number): Promise<boolean> {
    const foundDriver = await this.findById(id);

    if (!foundDriver) {
      throw new HttpError({
        message: HttpMessage.DRIVER_DOES_NOT_EXIST,
        status: HttpCode.NOT_FOUND,
      });
    }

    const isDriverDeleted = await this.driverRepository.delete(id);

    if (isDriverDeleted) {
      return await this.userService.delete(foundDriver.userId);
    } else {
      throw new HttpError({
        message: HttpMessage.CANNOT_DELETE,
        status: HttpCode.BAD_REQUEST,
      });
    }
  }
}

export { DriverService };
