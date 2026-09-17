import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';

import { Car, CarStatus } from '../cars/entities/car.entity';
import { Lead } from '../leads/entities/lead.entity';
import { Inquiry, InquiryStatus } from '../inquiries/entities/inquiry.entity';
import { ActivityLog } from '../audit/entities/activity-log.entity';
import {
  DashboardQueryDto,
  DashboardStats,
  InventoryStatusBreakdown,
  LeadChartPoint,
} from './dashboard.dto';

interface DateCountRow {
  date: string;
  count: string | number;
}

interface StatusCountRow {
  status: string;
  count: string | number;
}

@Injectable()
export class DashboardService {
  constructor(private readonly dataSource: DataSource) {}

  /**
   * High-level KPI metrics across cars, leads, and inquiries.
   */
  async getStats(): Promise<DashboardStats> {
    const carRepo = this.dataSource.getRepository(Car);
    const leadRepo = this.dataSource.getRepository(Lead);
    const inquiryRepo = this.dataSource.getRepository(Inquiry);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalCars,
      availableCars,
      reservedCars,
      soldCars,
      newLeads,
      openInquiries,
    ] = await Promise.all([
      carRepo.count(),
      carRepo.count({ where: { status: CarStatus.AVAILABLE } }),
      carRepo.count({ where: { status: CarStatus.RESERVED } }),
      carRepo.count({ where: { status: CarStatus.SOLD } }),
      leadRepo
        .createQueryBuilder('lead')
        .where('lead.createdAt >= :thirtyDaysAgo', { thirtyDaysAgo })
        .getCount(),
      inquiryRepo
        .createQueryBuilder('inquiry')
        .where('inquiry.status IN (:...statuses)', {
          statuses: [
            InquiryStatus.NEW,
            InquiryStatus.CONTACTED,
            InquiryStatus.PROCESSING,
          ],
        })
        .getCount(),
    ]);

    return {
      totalCars,
      availableCars,
      reservedCars,
      soldCars,
      newLeads,
      openInquiries,
    };
  }

  /**
   * Inventory breakdown grouped by car status.
   */
  async getInventoryStats(): Promise<InventoryStatusBreakdown[]> {
    const carRepo = this.dataSource.getRepository(Car);

    const rows: StatusCountRow[] = await carRepo
      .createQueryBuilder('car')
      .select('car.status', 'status')
      .addSelect('COUNT(car.id)', 'count')
      .groupBy('car.status')
      .getRawMany<StatusCountRow>();

    const allStatuses = Object.values(CarStatus);
    const countMap = new Map<string, number>();
    for (const row of rows) {
      countMap.set(row.status, Number(row.count));
    }

    return allStatuses.map((status) => ({
      status,
      count: countMap.get(status) ?? 0,
    }));
  }

  /**
   * Lead submissions over time grouped by granularity (day, week, month).
   */
  async getLeadsChart(dto: DashboardQueryDto): Promise<LeadChartPoint[]> {
    const leadRepo = this.dataSource.getRepository(Lead);
    const granularity = dto.granularity ?? 'day';

    const now = new Date();
    const defaultFrom = new Date();
    defaultFrom.setDate(now.getDate() - 30);

    const fromDate = dto.from ? new Date(dto.from) : defaultFrom;
    const toDate = dto.to ? new Date(dto.to) : now;

    // PostgreSQL DATE_TRUNC bucket
    const truncField = granularity === 'month' ? 'month' : granularity === 'week' ? 'week' : 'day';

    const rawRows: DateCountRow[] = await leadRepo
      .createQueryBuilder('lead')
      .select(`TO_CHAR(DATE_TRUNC('${truncField}', lead.created_at), 'YYYY-MM-DD')`, 'date')
      .addSelect('COUNT(lead.id)', 'count')
      .where('lead.created_at >= :fromDate', { fromDate })
      .andWhere('lead.created_at <= :toDate', { toDate })
      .groupBy(`DATE_TRUNC('${truncField}', lead.created_at)`)
      .orderBy(`DATE_TRUNC('${truncField}', lead.created_at)`, 'ASC')
      .getRawMany<DateCountRow>();

    return rawRows.map((row) => ({
      date: row.date,
      count: Number(row.count),
    }));
  }

  /**
   * Retrieves the latest N activity logs for dashboard feed.
   */
  async getRecentActivities(limit: number = 10): Promise<ActivityLog[]> {
    const logRepo = this.dataSource.getRepository(ActivityLog);
    return logRepo.find({
      order: { createdAt: 'DESC' },
      take: Math.min(Math.max(limit, 1), 100),
    });
  }
}
