# Aapka Waiter — Backend Server

MERN + Socket.io backend for **Aapka Waiter**, a QR-based table ordering and restaurant operations platform.

## Setup

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Update `MONGO_URI` in `.env`.
3. Install dependencies:
   ```bash
   npm install
   ```
4. Seed demo data:
   ```bash
   npm run seed
   ```
5. Start development server:
   ```bash
   npm run dev
   ```
6. Run End-to-End Realtime Flow Test (in a second terminal while `npm run dev` is running):
   ```bash
   npm run e2e
   ```

## Swapping Local Image Uploads to Cloudinary (Production)

Currently, `POST /api/v1/menu-items/upload-image` saves images to `/server/uploads` via `multer.diskStorage` and serves them at `/uploads/<filename>`.

To switch to **Cloudinary**:
1. Install `cloudinary` (`npm install cloudinary`) and add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` to `.env` and `src/config/env.js`.
2. In `src/middleware/upload.js`, replace `multer.diskStorage(...)` with `multer.memoryStorage()` (keeping the 3MB `fileSize` limit and `imageFileFilter`).
3. In `src/controllers/menuItem.controller.js` (`uploadMenuItemImage`), stream `req.file.buffer` to `cloudinary.uploader.upload_stream({ folder: 'aapka-waiter/menu' })` and return `result.secure_url` as `url`.

---
Designed & Developed by HeryxStudio
