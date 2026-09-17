import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { ActivityLog } from './entities/activity-log.entity';
import { ListAuditLogsDto, LogActivityDto } from './audit.dto';
import { PaginatedResult, PaginationDto, paginate } from '../../common/dto/pagination.dto';

const SENSITIVE_KEY_PATTERNS = [
  'password',
  'passwordhash',
  'token',
  'refreshtoken',
  'accesstoken',
  'secret',
  'apikey',
  'otp',
  'creditcard',
  'cvv',
];

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase();
  return SENSITIVE_KEY_PATTERNS.some((pattern) => lower.includes(pattern));
}

function redactSensitiveData(val: unknown): unknown {
  if (val === null || val === undefined) {
    return val;
  }

  if (Array.isArray(val)) {
    return val.map((item) => redactSensitiveData(item));
  }

  if (typeof val === 'object') {
    const record = val as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};

    for (const [k, v] of Object.entries(record)) {
      if (isSensitiveKey(k)) {
        sanitized[k] = '[REDACTED]';
      } else {
        sanitized[k] = redactSensitiveData(v);
      }
    }
    return sanitized;
  }

  return val;
}

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(ActivityLog)
    private readonly activityLogRepo: Repository<ActivityLog>,
  ) {}

  /**
   * Appends an immutable audit log entry after stripping out sensitive fields.
   */
  async log(dto: LogActivityDto): Promise<ActivityLog> {
    const sanitizedDiff = dto.diff
      ? (redactSensitiveData(dto.diff) as Record<string, unknown>)
      : null;

    const logEntry = this.activityLogRepo.create({
      actor: dto.actor,
      action: dto.action,
      module: dto.module,
      entityId: dto.entityId ?? null,
      diff: sanitizedDiff,
      requestId: dto.requestId ?? null,
    });

    return this.activityLogRepo.save(logEntry);
  }

  /**
   * Returns a paginated list of activity logs ordered newest to oldest.
   */
  async findAll(
    dto: PaginationDto | ListAuditLogsDto,
  ): Promise<PaginatedResult<ActivityLog>> {
    const filterDto = dto as ListAuditLogsDto;
    const qb = this.activityLogRepo
      .createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC');

    if (filterDto.module) {
      qb.andWhere('log.module = :module', { module: filterDto.module });
    }

    if (filterDto.action) {
      qb.andWhere('log.action = :action', { action: filterDto.action });
    }

    if (filterDto.entityId) {
      qb.andWhere('log.entityId = :entityId', { entityId: filterDto.entityId });
    }

    const total = await qb.getCount();
    const items = await qb
      .skip((dto.page - 1) * dto.limit)
      .take(dto.limit)
      .getMany();

    return paginate(items, total, dto);
  }
}
