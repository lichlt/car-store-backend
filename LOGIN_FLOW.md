# Quy trình Đăng nhập & Quản lý Phiên (Authentication & Session Flow)

Tài liệu chi tiết được đặt tại: [docs/login-flow.md](./docs/login-flow.md)

Hệ thống sử dụng cơ chế xác thực phiên **MOLToken (AES-256-GCM Encrypted Token + In-Memory Redis Session)** giống chuẩn `car-store-api` và tương thích 100% với `car-store-web`.

### Sơ đồ luồng đăng nhập

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Người dùng (Admin)
    participant Web as Frontend (car-store-web)
    participant API as Backend (NestJS)
    participant DB as PostgreSQL
    participant Redis as Redis Cache
    participant Mail as SMTP (Gmail)

    %% BƯỚC 1: REQUEST OTP
    Note over Admin,Mail: BƯỚC 1: Xác thực Email & Password -> Nhận OTP
    Admin->>Web: Nhập email & password
    Web->>API: POST /api/login { email, password }
    API->>DB: Tìm User (email, status = ACTIVE) & passwordHash
    API->>API: bcrypt.compare(password, passwordHash)
    API->>DB: Huỷ các OTP challenge cũ (used_at = NOW)
    API->>API: Sinh OTP 6 số ngẫu nhiên
    API->>DB: Lưu SHA-256 hash của OTP vào login_otp_tokens (TTL: 10m)
    API-->>Mail: Gửi email chứa OTP đến hòm thư Admin
    API-->>Web: Trả về HTTP 202 { challengeId, expiresAt }
    Web-->>Admin: Hiển thị màn hình nhập OTP

    %% BƯỚC 2: VERIFY OTP
    Note over Admin,Redis: BƯỚC 2: Xác thực OTP -> Khởi tạo phiên MOLToken
    Admin->>Web: Nhập mã OTP 6 số
    Web->>API: POST /api/verify-login-otp { challengeId, otp } (Header: x-device-id)
    API->>DB: Tìm challenge trong login_otp_tokens
    API->>API: Kiểm tra attempts < 5 & so khớp mã băm SHA-256
    API->>DB: Đánh dấu used_at = NOW, update last_login_at
    API->>DB: Load User kèm Role và danh sách Permissions

    %% Khởi tạo MOLToken & Redis Session
    API->>API: Mã hoá AES-256-GCM payload tạo molToken
    API->>Redis: Lưu Active Session: mol:session:admin:{userId}:{deviceId} (TTL: 600s)
    API-->>Web: Trả về { admin, role, permissions, molToken }<br/>Set HttpOnly Cookie: "MOLToken" (10m)
    Web-->>Admin: Đăng nhập thành công, chuyển hướng vào Dashboard
```
