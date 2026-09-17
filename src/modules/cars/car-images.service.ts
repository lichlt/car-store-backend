import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { deleteFromCloudinary, uploadToCloudinary } from '../../config/cloudinary.config';
import { CarImage } from './entities/car-image.entity';
import { Car } from './entities/car.entity';

@Injectable()
export class CarImagesService {
  private readonly logger = new Logger(CarImagesService.name);

  constructor(
    @InjectRepository(CarImage)
    private readonly carImageRepo: Repository<CarImage>,

    @InjectRepository(Car)
    private readonly carRepo: Repository<Car>,
  ) {}

  async uploadImages(
    carId: string,
    files: Express.Multer.File[],
  ): Promise<CarImage[]> {
    if (!files || files.length === 0) {
      throw new BadRequestException('No files uploaded');
    }

    const car = await this.carRepo.findOne({
      where: { id: carId },
      relations: ['images'],
    });

    if (!car) {
      throw new NotFoundException(`Car with ID "${carId}" not found`);
    }

    const existingImages = car.images ?? [];
    if (existingImages.length + files.length > 10) {
      throw new BadRequestException(
        `Exceeded limit of 10 images per car. Car currently has ${existingImages.length} images; cannot upload ${files.length} more.`,
      );
    }

    let hasCover = existingImages.some((img) => img.isCover);
    let currentPosition = existingImages.reduce(
      (max, img) => Math.max(max, img.position),
      -1,
    );

    const newCarImages: CarImage[] = [];

    for (const file of files) {
      const uploadResult = await uploadToCloudinary(file.buffer, {
        folder: `carstore/cars/${carId}`,
        resource_type: 'image',
      });

      const isCover = !hasCover;
      if (isCover) {
        hasCover = true;
      }
      currentPosition++;

      const imageRecord = this.carImageRepo.create({
        car,
        publicId: uploadResult.public_id,
        url: uploadResult.url,
        secureUrl: uploadResult.secure_url,
        altText: `${car.variant || 'Car'} photo`,
        width: uploadResult.width,
        height: uploadResult.height,
        bytes: uploadResult.bytes,
        mimeType: file.mimetype,
        position: currentPosition,
        isCover,
      });

      newCarImages.push(imageRecord);
    }

    return this.carImageRepo.save(newCarImages);
  }

  async updateOrder(carId: string, imageIds: string[]): Promise<void> {
    const car = await this.carRepo.findOne({ where: { id: carId } });
    if (!car) {
      throw new NotFoundException(`Car with ID "${carId}" not found`);
    }

    const images = await this.carImageRepo.find({
      where: { car: { id: carId } },
    });

    const imageMap = new Map(images.map((img) => [img.id, img]));

    for (const id of imageIds) {
      if (!imageMap.has(id)) {
        throw new BadRequestException(
          `Image with ID "${id}" does not belong to car "${carId}"`,
        );
      }
    }

    for (let index = 0; index < imageIds.length; index++) {
      const img = imageMap.get(imageIds[index]);
      if (img) {
        img.position = index;
      }
    }

    await this.carImageRepo.save(images);
  }

  async setCover(carId: string, imageId: string): Promise<void> {
    const car = await this.carRepo.findOne({ where: { id: carId } });
    if (!car) {
      throw new NotFoundException(`Car with ID "${carId}" not found`);
    }

    const images = await this.carImageRepo.find({
      where: { car: { id: carId } },
    });

    const target = images.find((img) => img.id === imageId);
    if (!target) {
      throw new NotFoundException(
        `Image with ID "${imageId}" does not belong to car "${carId}"`,
      );
    }

    for (const img of images) {
      img.isCover = img.id === imageId;
    }

    await this.carImageRepo.save(images);
  }

  async removeImage(carId: string, imageId: string): Promise<void> {
    const image = await this.carImageRepo.findOne({
      where: { id: imageId, car: { id: carId } },
      relations: ['car'],
    });

    if (!image) {
      throw new NotFoundException(
        `Image with ID "${imageId}" not found for car "${carId}"`,
      );
    }

    try {
      await deleteFromCloudinary(image.publicId);
    } catch (error) {
      this.logger.warn(
        `Failed to delete image ${image.publicId} from Cloudinary: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    const wasCover = image.isCover;
    await this.carImageRepo.remove(image);

    if (wasCover) {
      const remainingImages = await this.carImageRepo.find({
        where: { car: { id: carId } },
        order: { position: 'ASC' },
      });

      if (remainingImages.length > 0) {
        remainingImages[0].isCover = true;
        await this.carImageRepo.save(remainingImages[0]);
      }
    }
  }
}
