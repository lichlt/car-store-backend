import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes, randomUUID } from 'crypto';

import { Inquiry, InquiryStatus } from './entities/inquiry.entity';
import { Car } from '../cars/entities/car.entity';
import { User } from '../users/entities/user.entity';
import { NoteEntry, StatusHistoryEntry, LeadStatus } from '../leads/entities/lead.entity';
import {
  AddInquiryNoteDto,
  AssignInquiryDto,
  ListInquiriesDto,
  SubmitInquiryDto,
  UpdateInquiryStatusDto,
} from './inquiries.dto';
import { PaginatedResult, paginate } from '../../common/dto/pagination.dto';
import { RequestUser } from '../../common/types/jwt-payload.interface';

@Injectable()
export class InquiriesService {
  constructor(
    @InjectRepository(Inquiry)
    private readonly inquiryRepo: Repository<Inquiry>,
    @InjectRepository(Car)
    private readonly carRepo: Repository<Car>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Generates reference number: INQ-{YYYYMMDD}-{random6}
   */
  private generateReferenceNo(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const random6 = randomBytes(3).toString('hex').toUpperCase();
    return `INQ-${yyyy}${mm}${dd}-${random6}`;
  }

  /**
   * Public submission of customer inquiries.
   */
  async submitInquiry(dto: SubmitInquiryDto): Promise<Inquiry> {
    let car: Car | null = null;
    if (dto.carId) {
      car = await this.carRepo.findOne({ where: { id: dto.carId } });
    }

    const inquiry = this.inquiryRepo.create({
      referenceNo: this.generateReferenceNo(),
      type: dto.type,
      car,
      contact: dto.contact,
      preferredDate: dto.preferredDate ? new Date(dto.preferredDate) : null,
      status: InquiryStatus.NEW,
      notes: [],
      statusHistory: [],
    });

    return this.inquiryRepo.save(inquiry);
  }

  /**
   * Lists customer inquiries with filters, pagination, and relations.
   */
  async findAll(dto: ListInquiriesDto): Promise<PaginatedResult<Inquiry>> {
    const qb = this.inquiryRepo
      .createQueryBuilder('inquiry')
      .leftJoinAndSelect('inquiry.car', 'car')
      .leftJoinAndSelect('inquiry.assignedTo', 'assignedTo')
      .orderBy('inquiry.createdAt', 'DESC');

    if (dto.type) {
      qb.andWhere('inquiry.type = :type', { type: dto.type });
    }

    if (dto.status) {
      qb.andWhere('inquiry.status = :status', { status: dto.status });
    }

    if (dto.assignedTo) {
      qb.andWhere('assignedTo.id = :assignedTo', { assignedTo: dto.assignedTo });
    }

    const total = await qb.getCount();
    const items = await qb
      .skip((dto.page - 1) * dto.limit)
      .take(dto.limit)
      .getMany();

    return paginate(items, total, dto);
  }

  /**
   * Retrieves single inquiry by UUID.
   */
  async findById(id: string): Promise<Inquiry> {
    const inquiry = await this.inquiryRepo.findOne({
      where: { id },
      relations: ['car', 'assignedTo'],
    });

    if (!inquiry) {
      throw new NotFoundException(`Inquiry with ID '${id}' not found`);
    }

    return inquiry;
  }

  /**
   * Updates status of an inquiry and appends to statusHistory.
   */
  async updateStatus(
    id: string,
    dto: UpdateInquiryStatusDto,
    actor: RequestUser,
  ): Promise<Inquiry> {
    const inquiry = await this.findById(id);

    if (inquiry.status === dto.status) {
      return inquiry;
    }

    const historyEntry: StatusHistoryEntry = {
      from: inquiry.status as unknown as LeadStatus,
      to: dto.status as unknown as LeadStatus,
      actorId: actor.sub,
      actorName: actor.email,
      reason: dto.reason?.trim() ?? '',
      at: new Date().toISOString(),
    };

    inquiry.statusHistory = [...(inquiry.statusHistory || []), historyEntry];
    inquiry.status = dto.status;

    return this.inquiryRepo.save(inquiry);
  }

  /**
   * Assigns an inquiry to staff member.
   */
  async assign(id: string, dto: AssignInquiryDto): Promise<Inquiry> {
    const inquiry = await this.findById(id);
    const user = await this.userRepo.findOne({ where: { id: dto.assignedTo } });

    if (!user) {
      throw new NotFoundException(`User with ID '${dto.assignedTo}' not found`);
    }

    inquiry.assignedTo = user;
    return this.inquiryRepo.save(inquiry);
  }

  /**
   * Adds an internal staff note to an inquiry.
   */
  async addNote(
    id: string,
    dto: AddInquiryNoteDto,
    actor: RequestUser,
  ): Promise<Inquiry> {
    const inquiry = await this.findById(id);

    const note: NoteEntry = {
      id: randomUUID(),
      authorId: actor.sub,
      authorName: actor.email,
      body: dto.body.trim(),
      createdAt: new Date().toISOString(),
    };

    inquiry.notes = [...(inquiry.notes || []), note];
    return this.inquiryRepo.save(inquiry);
  }

  /**
   * Soft deletes an inquiry.
   */
  async remove(id: string): Promise<void> {
    const inquiry = await this.findById(id);
    await this.inquiryRepo.softRemove(inquiry);
  }
}
