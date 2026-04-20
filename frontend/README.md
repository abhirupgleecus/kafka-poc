You do not need a separate frontend `.env.local` file.

The frontend will work with:
- `backend/.env` (already present), or
- `project-root/.env`, or
- defaults.

## Optional frontend env file
If you still want one, create `frontend/.env.local` and set:
- `BACKEND_API_BASE_URL=http://localhost:8000`
- `NEXT_DEV_ALLOWED_ORIGINS=localhost,127.0.0.1,192.168.1.30`

## Scripts
- `npm run dev`
- `npm run build`
- `npm run start`
- `npm run lint`
