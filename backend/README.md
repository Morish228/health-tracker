# Health Companion Backend

## Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Setup MongoDB:**
- Make sure MongoDB is running locally on port 27017
- Or update `MONGODB_URI` in `.env` file

3. **Configure environment:**
- Copy `.env.example` to `.env`
- Update `JWT_SECRET` with a secure random string

4. **Run development server:**
```bash
npm run dev
```

Server will run on `http://localhost:5000`

---

## API Endpoints

### Authentication

#### 1. Register User
```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "firstName": "John",
  "lastName": "Doe",
  "phone": "1234567890"
}
```

#### 2. Login
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

Response:
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "...",
      "email": "user@example.com",
      "role": "patient",
      "profile": {
        "firstName": "John",
        "lastName": "Doe"
      }
    }
  }
}
```

#### 3. Get Current User
```http
GET /api/auth/me
Authorization: Bearer <token>
```

#### 4. Update Profile
```http
PUT /api/auth/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "firstName": "John",
  "lastName": "Doe",
  "dateOfBirth": "1990-01-01",
  "gender": "male",
  "phone": "1234567890",
  "address": "123 Main St"
}
```

---

## Testing with cURL

### Register:
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123","firstName":"Test","lastName":"User","phone":"1234567890"}'
```

### Login:
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'
```

### Get Profile (replace TOKEN):
```bash
curl -X GET http://localhost:5000/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```
