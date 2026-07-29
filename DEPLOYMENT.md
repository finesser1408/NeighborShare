# NeighbourShare - Render Deployment Guide

This guide explains how to deploy the NeighbourShare backend and frontend to Render.com using the provided blueprints.

## Prerequisites

- A Render.com account (free tier available)
- Git repository with the NeighbourShare code
- Both backend and frontend code in the same repository

## Deployment Steps

### 1. Backend Deployment (Django)

The backend uses the `backend/render.yaml` blueprint for automatic deployment.

**Services Created:**
- **Web Service**: Django application with Gunicorn
- **PostgreSQL Database**: Free tier database
- **Redis**: Free tier for Celery and caching

**Configuration:**
- Python 3.11+
- Gunicorn WSGI server (4 workers, 120s timeout)
- Automatic SSL/HTTPS
- Health checks enabled

**Environment Variables (auto-configured by blueprint):**
- `DEBUG=False`
- `SECRET_KEY` (auto-generated)
- `DJANGO_ALLOWED_HOSTS=.onrender.com`
- `USE_SQLITE=False`
- PostgreSQL credentials (linked to database)
- `REDIS_URL` (linked to Redis instance)
- `CORS_ALLOWED_ORIGINS=https://neighbourshare-frontend.onrender.com`
- `SITE_URL=https://neighbourshare-backend.onrender.com`

### 2. Frontend Deployment (React)

The frontend uses the `frontend/render.yaml` blueprint for automatic deployment.

**Configuration:**
- Static site deployment
- Build command: `npm install && npm run build`
- Output directory: `build`
- Automatic SSL/HTTPS

**Environment Variables:**
- `REACT_APP_API_URL=https://neighbourshare-backend.onrender.com`

## Manual Deployment via Render Dashboard

If you prefer manual setup instead of blueprints:

### Backend Setup

1. **Create PostgreSQL Database**
   - Go to Render Dashboard → New → PostgreSQL
   - Name: `neighbourshare-db`
   - Plan: Free
   - Save database credentials

2. **Create Redis Instance**
   - Go to Render Dashboard → New → Redis
   - Name: `neighbourshare-redis`
   - Plan: Free
   - Save connection string

3. **Create Web Service (Backend)**
   - Go to Render Dashboard → New → Web Service
   - Connect your Git repository
   - Root directory: `backend`
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `gunicorn neighbourshare.wsgi:application --bind 0.0.0.0:$PORT --workers 4 --timeout 120`
   - Add environment variables from the blueprint above

### Frontend Setup

1. **Create Web Service (Frontend)**
   - Go to Render Dashboard → New → Static Site
   - Connect your Git repository
   - Root directory: `frontend`
   - Build Command: `npm install && npm run build`
   - Publish Directory: `build`
   - Add environment variable: `REACT_APP_API_URL=https://neighbourshare-backend.onrender.com`

## Post-Deployment Steps

### 1. Run Database Migrations

After backend deployment, you need to run migrations:

```bash
# Access your backend service via Render Shell
python manage.py migrate
python manage.py createsuperuser
```

### 2. Configure Celery Worker (Optional)

For background tasks (time credits, QR processing), you may need a separate worker service:

```yaml
# Add to backend/render.yaml
- type: worker
  name: neighbourshare-celery
  env: python
  region: oregon
  plan: free
  buildCommand: pip install -r requirements.txt
  startCommand: celery -A neighbourshare worker -l info
  envVars:
    # Same env vars as web service
```

### 3. Update CORS Settings

After deployment, update the `CORS_ALLOWED_ORIGINS` in the backend environment variables to include your actual frontend URL.

## Monitoring

- **Backend Logs**: Available in Render Dashboard → Services → neighbourshare-backend → Logs
- **Frontend Logs**: Available in Render Dashboard → Services → neighbourshare-frontend → Logs
- **Database**: Available in Render Dashboard → Databases → neighbourshare-db

## Troubleshooting

### Backend Issues

**Problem:** Database connection errors
- **Solution:** Verify PostgreSQL credentials in environment variables
- Ensure `USE_SQLITE=False` is set

**Problem:** CORS errors
- **Solution:** Update `CORS_ALLOWED_ORIGINS` to include your frontend URL

**Problem:** Static files not loading
- **Solution:** Run `python manage.py collectstatic` in Render Shell

### Frontend Issues

**Problem:** API connection errors
- **Solution:** Verify `REACT_APP_API_URL` environment variable
- Check backend service is running

**Problem:** Build failures
- **Solution:** Check `npm install` and build logs
- Ensure all dependencies are in package.json

## Scaling

For production use, consider upgrading:

- **Backend**: Upgrade to paid plan for more RAM/CPU
- **Database**: Upgrade PostgreSQL plan for better performance
- **Redis**: Upgrade for more memory
- **Frontend**: Static sites are free, but consider CDN for global distribution

## Security Notes

- All services use automatic SSL/HTTPS
- SECRET_KEY is auto-generated for production
- Database credentials are managed by Render
- Never commit `.env` files to Git
- Use environment variables for all sensitive data

## Cost Estimate (Free Tier)

- **Backend Web Service**: Free
- **PostgreSQL Database**: Free (256MB)
- **Redis**: Free (25MB)
- **Frontend Static Site**: Free
- **Total**: $0/month (with limitations)

Free tier limitations:
- Backend spins down after 15 minutes of inactivity (cold starts)
- Database: 256MB RAM, 90 days of backups
- Redis: 25MB memory
- Static sites: Always active

## Support

For Render-specific issues:
- Render Documentation: https://render.com/docs
- Render Status: https://status.render.com
- Render Support: support@render.com
