import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomBytes, randomUUID } from 'crypto';

import {
  Lead,
  LeadStatus,
  NoteEntry,
  CommunicationEntry,
  StatusHistoryEntry,
} from './entities/lead.entity';
import { User } from '../users/entities/user.entity';
import {
  SubmitLeadDto,
  ListLeadsDto,
  UpdateLeadDto,
  UpdateLeadStatusDto,
  AssignLeadDto,
  AddNoteDto,
  AddCommunicationDto,
} from './leads.dto';
import { PaginatedResult, paginate } from '../../common/dto/pagination.dto';
import { RequestUser } from '../../common/types/jwt-payload.interface';

const ALLOWED_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  [LeadStatus.NEW]: [LeadStatus.CONTACTED],
  [LeadStatus.CONTACTED]: [LeadStatus.QUOTED, LeadStatus.REJECTED],
  [LeadStatus.QUOTED]: [LeadStatus.COMPLETED, LeadStatus.REJECTED],
  [LeadStatus.REJECTED]: [LeadStatus.CONTACTED],
  [LeadStatus.COMPLETED]: [],
};

@Injectable()
export class LeadsService {
  constructor(
    @InjectRepository(Lead)
    private readonly leadRepo: Repository<Lead>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  /**
   * Generates a unique reference number: LEAD-{YYYYMMDD}-{random6}
   */
  private generateReferenceNo(): string {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const random6 = randomBytes(3).toString('hex').toUpperCase();
    return `LEAD-${yyyy}${mm}${dd}-${random6}`;
  }

  /**
   * Public endpoint to submit a lead (e.g. from customer valuation form).
   */
  async submitLead(dto: SubmitLeadDto): Promise<Lead> {
    const lead = this.leadRepo.create({
      referenceNo: this.generateReferenceNo(),
      contact: dto.contact,
      carInfo: dto.carInfo,
      source: dto.source ?? 'direct',
      images: dto.images ?? [],
      status: LeadStatus.NEW,
      notes: [],
      communications: [],
      statusHistory: [],
    });

    return this.leadRepo.save(lead);
  }

  /**
   * Lists leads with filtering, search, and pagination for admin staff.
   */
  async findAll(dto: ListLeadsDto): Promise<PaginatedResult<Lead>> {
    const qb = this.leadRepo
      .createQueryBuilder('lead')
      .leftJoinAndSelect('lead.assignedTo', 'assignedTo')
      .orderBy('lead.createdAt', 'DESC');

    if (dto.status) {
      qb.andWhere('lead.status = :status', { status: dto.status });
    }

    if (dto.assignedTo) {
      qb.andWhere('assignedTo.id = :assignedTo', { assignedTo: dto.assignedTo });
    }

    if (dto.search && dto.search.trim().length > 0) {
      const term = `%${dto.search.trim()}%`;
      qb.andWhere(
        '(lead.referenceNo ILIKE :term OR lead.source ILIKE :term OR CAST(lead.contact AS text) ILIKE :term OR CAST(lead.carInfo AS text) ILIKE :term)',
        { term },
      );
    }

    const total = await qb.getCount();
    const items = await qb
      .skip((dto.page - 1) * dto.limit)
      .take(dto.limit)
      .getMany();

    return paginate(items, total, dto);
  }

  /**
   * Retrieves a single lead by UUID.
   */
  async findById(id: string): Promise<Lead> {
    const lead = await this.leadRepo.findOne({
      where: { id },
      relations: ['assignedTo'],
    });

    if (!lead) {
      throw new NotFoundException(`Lead with ID '${id}' not found`);
    }

    return lead;
  }

  /**
   * Updates lead general fields (contact, carInfo, nextFollowUpAt, quotedPriceCents).
   */
  async update(id: string, dto: UpdateLeadDto): Promise<Lead> {
    const lead = await this.findById(id);

    if (dto.contact !== undefined) {
      lead.contact = dto.contact;
    }
    if (dto.carInfo !== undefined) {
      lead.carInfo = dto.carInfo;
    }
    if (dto.nextFollowUpAt !== undefined) {
      lead.nextFollowUpAt = dto.nextFollowUpAt ? new Date(dto.nextFollowUpAt) : null;
    }
    if (dto.quotedPriceCents !== undefined) {
      lead.quotedPriceCents = dto.quotedPriceCents;
    }

    return this.leadRepo.save(lead);
  }

  /**
   * Updates lead status following strict business rules and records status transition history.
   */
  async updateStatus(
    id: string,
    dto: UpdateLeadStatusDto,
    actor: RequestUser,
  ): Promise<Lead> {
    const lead = await this.findById(id);
    const currentStatus = lead.status;
    const targetStatus = dto.status;

    if (currentStatus === targetStatus) {
      return lead;
    }

    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Invalid status transition from ${currentStatus} to ${targetStatus}`,
      );
    }

    // Reopening from REJECTED requires a reason
    if (
      currentStatus === LeadStatus.REJECTED &&
      targetStatus === LeadStatus.CONTACTED &&
      (!dto.reason || dto.reason.trim().length === 0)
    ) {
      throw new BadRequestException(
        'A reason is required when reopening a rejected lead',
      );
    }

    const historyEntry: StatusHistoryEntry = {
      from: currentStatus,
      to: targetStatus,
      actorId: actor.sub,
      actorName: actor.email,
      reason: dto.reason?.trim() ?? '',
      at: new Date().toISOString(),
    };

    lead.statusHistory = [...(lead.statusHistory || []), historyEntry];
    lead.status = targetStatus;

    if (targetStatus === LeadStatus.COMPLETED) {
      lead.completedAt = new Date();
    }

    return this.leadRepo.save(lead);
  }

  /**
   * Assigns a lead to an admin/staff member.
   */
  async assign(id: string, dto: AssignLeadDto): Promise<Lead> {
    const lead = await this.findById(id);
    const user = await this.userRepo.findOne({ where: { id: dto.assignedTo } });

    if (!user) {
      throw new NotFoundException(`User with ID '${dto.assignedTo}' not found`);
    }

    lead.assignedTo = user;
    return this.leadRepo.save(lead);
  }

  /**
   * Adds an internal note to the lead.
   */
  async addNote(id: string, dto: AddNoteDto, actor: RequestUser): Promise<Lead> {
    const lead = await this.findById(id);

    const note: NoteEntry = {
      id: randomUUID(),
      authorId: actor.sub,
      authorName: actor.email,
      body: dto.body.trim(),
      createdAt: new Date().toISOString(),
    };

    lead.notes = [...(lead.notes || []), note];
    return this.leadRepo.save(lead);
  }

  /**
   * Records a communication entry for the lead.
   */
  async addCommunication(
    id: string,
    dto: AddCommunicationDto,
    actor: RequestUser,
  ): Promise<Lead> {
    const lead = await this.findById(id);

    const communication: CommunicationEntry = {
      channel: dto.channel.trim(),
      summary: dto.summary.trim(),
      actorId: actor.sub,
      actorName: actor.email,
      occurredAt: dto.occurredAt,
    };

    lead.communications = [...(lead.communications || []), communication];
    return this.leadRepo.save(lead);
  }
}
