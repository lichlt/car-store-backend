import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, ILike, FindOptionsWhere } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { User, UserStatus } from './entities/user.entity';
import { Role } from './entities/role.entity';
import { Permission } from './entities/permission.entity';
import { PaginatedResult, paginate } from '../../common/dto/pagination.dto';
import {
  ListUsersDto,
  CreateUserDto,
  UpdateUserDto,
  UpdateRoleDto,
} from './users.dto';

// ──────────────────────────────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────────────────────────────
const BCRYPT_ROUNDS = 12;
const SUPER_ADMIN_ROLE_CODE = 'SUPER_ADMIN';

// ──────────────────────────────────────────────────────────────────────────────
// UsersService
// ──────────────────────────────────────────────────────────────────────────────
@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,

    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,

    @InjectRepository(Permission)
    private readonly permissionRepo: Repository<Permission>,
  ) {}

  // ─── List / search users ───────────────────────────────────────────────────
  async findAll(dto: ListUsersDto): Promise<PaginatedResult<User>> {
    const where: FindOptionsWhere<User>[] = [];
    const baseWhere: FindOptionsWhere<User> = {};

    if (dto.status) baseWhere.status = dto.status;
    if (dto.roleId) baseWhere.role = { id: dto.roleId };

    if (dto.search) {
      // Fan out the search across multiple fields
      const searchValue = `%${dto.search}%`;
      where.push(
        { ...baseWhere, email: ILike(searchValue) },
        { ...baseWhere, username: ILike(searchValue) },
        { ...baseWhere, fullName: ILike(searchValue) },
      );
    } else {
      where.push(baseWhere);
    }

    const [items, total] = await this.userRepo.findAndCount({
      where,
      relations: ['role'],
      // passwordHash is select:false on the entity — won't be returned
      order: { createdAt: 'DESC' },
      skip: ((dto.page ?? 1) - 1) * (dto.limit ?? 20),
      take: dto.limit ?? 20,
    });

    return paginate(items, total, dto);
  }

  // ─── Find by ID ────────────────────────────────────────────────────────────
  async findById(id: string): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id },
      relations: ['role', 'role.permissions'],
    });

    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  // ─── Create user ───────────────────────────────────────────────────────────
  async create(dto: CreateUserDto, _actorId: string): Promise<User> {
    // Uniqueness checks
    const [existingEmail, existingUsername] = await Promise.all([
      this.userRepo.findOne({ where: { email: dto.email.toLowerCase().trim() } }),
      this.userRepo.findOne({ where: { username: dto.username } }),
    ]);

    if (existingEmail) throw new ConflictException('EMAIL_ALREADY_EXISTS');
    if (existingUsername) throw new ConflictException('USERNAME_ALREADY_EXISTS');

    const role = await this.roleRepo.findOne({ where: { id: dto.roleId } });
    if (!role) throw new NotFoundException(`Role ${dto.roleId} not found`);

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    const user = this.userRepo.create({
      email: dto.email.toLowerCase().trim(),
      username: dto.username,
      passwordHash,
      fullName: dto.fullName,
      phone: dto.phone,
      role,
      status: UserStatus.ACTIVE,
    });

    return this.userRepo.save(user);
  }

  // ─── Update user profile ───────────────────────────────────────────────────
  async update(id: string, dto: UpdateUserDto): Promise<User> {
    const user = await this.findById(id);

    // Protect last SUPER_ADMIN from being deactivated
    if (
      dto.status &&
      dto.status !== 'ACTIVE' &&
      user.role?.code === SUPER_ADMIN_ROLE_CODE
    ) {
      await this.guardLastSuperAdmin(id);
    }

    // Email uniqueness check
    if (dto.email && dto.email.toLowerCase().trim() !== user.email) {
      const existing = await this.userRepo.findOne({
        where: { email: dto.email.toLowerCase().trim() },
      });
      if (existing) throw new ConflictException('EMAIL_ALREADY_EXISTS');
    }

    Object.assign(user, {
      ...(dto.email && { email: dto.email.toLowerCase().trim() }),
      ...(dto.username !== undefined && { username: dto.username }),
      ...(dto.fullName !== undefined && { fullName: dto.fullName }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.avatarUrl !== undefined && { avatarUrl: dto.avatarUrl }),
      ...(dto.status !== undefined && { status: dto.status }),
    });

    return this.userRepo.save(user);
  }

  // ─── Update role ───────────────────────────────────────────────────────────
  async updateRole(id: string, dto: UpdateRoleDto): Promise<User> {
    const user = await this.findById(id);

    // Prevent removing the role from the last SUPER_ADMIN
    if (user.role?.code === SUPER_ADMIN_ROLE_CODE) {
      const newRole = await this.roleRepo.findOne({ where: { id: dto.roleId } });
      if (newRole?.code !== SUPER_ADMIN_ROLE_CODE) {
        await this.guardLastSuperAdmin(id);
      }
    }

    const role = await this.roleRepo.findOne({ where: { id: dto.roleId } });
    if (!role) throw new NotFoundException(`Role ${dto.roleId} not found`);

    user.role = role;
    return this.userRepo.save(user);
  }

  // ─── Soft delete ───────────────────────────────────────────────────────────
  async remove(id: string): Promise<void> {
    const user = await this.findById(id);

    if (user.role?.code === SUPER_ADMIN_ROLE_CODE) {
      await this.guardLastSuperAdmin(id);
    }

    // TypeORM soft-delete sets deletedAt
    await this.userRepo.softDelete(id);
  }

  // ─── Roles & permissions ───────────────────────────────────────────────────
  async findRoles(): Promise<Role[]> {
    return this.roleRepo.find({ relations: ['permissions'], order: { name: 'ASC' } });
  }

  async findPermissions(): Promise<Permission[]> {
    return this.permissionRepo.find({ order: { code: 'ASC' } });
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Throws 409 if the user being acted upon is the last active SUPER_ADMIN.
   * Call this before any destructive or demotion operation.
   */
  private async guardLastSuperAdmin(excludeUserId: string): Promise<void> {
    const activeSuperAdmins = await this.userRepo
      .createQueryBuilder('u')
      .innerJoin('u.role', 'r')
      .where('r.code = :code', { code: SUPER_ADMIN_ROLE_CODE })
      .andWhere('u.status = :status', { status: 'ACTIVE' })
      .andWhere('u.deletedAt IS NULL')
      .andWhere('u.id != :id', { id: excludeUserId })
      .getCount();

    if (activeSuperAdmins === 0) {
      throw new ConflictException('CANNOT_MODIFY_LAST_SUPER_ADMIN');
    }
  }
}
